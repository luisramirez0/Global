# Design

## Context

- C-01 dejó: Spring Boot 3.5.16 (Hibernate ORM 6.6), Gradle Groovy, `options.release = 17`, paquete base `ar.global.odonto` con paquetes de dominio vacíos (`consultorio`, `usuario`, `paciente`, `agenda`, `recordatorio`, `auditoria`, `common`), `ddl-auto: validate` en todos los perfiles, `open-in-view: false`, Flyway sobre `classpath:db/migration` (hoy vacío). Perfil `test`: `jdbc:h2:mem:global;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1` (la base en memoria se comparte entre contextos de Spring de la misma JVM). Perfil `dev`: MySQL 8 por variables de entorno.
- `OdontoApplicationTests`, `HealthControllerIT`, `CorsPolicyIT` y `SecurityDefaultDenyIT` levantan el contexto completo: en cuanto exista una `@Entity` sin su tabla, `validate` rompe el arranque. Esto condiciona el orden de implementación de los grupos (D10).
- Motivación y alcance: ver `proposal.md`. Requisitos: ver `specs/`.
- Reglas duras que pesan: 2 (tenant), 5 (sin PII en logs), 6 (Flyway; no editar migraciones aplicadas), 7 (auditoría inmutable), 8 (H2 modo MySQL, SQL portable), 1 (entidades internas). Governance CRÍTICA.

## Goals / Non-Goals

**Goals:**
- Un único mecanismo de aislamiento que sea automático (no depende de que cada consulta se acuerde del filtro) y que falle cerrado.
- Defensa en profundidad: además del filtro en la aplicación, la base impide referencias cruzadas entre consultorios.
- Esquema definitivo para el MVP en `V1`/`V2`, portable H2 ↔ MySQL 8, validado por Hibernate.
- Un contrato (entidades + repositorios + `TenantContext`) documentado en este diseño para que C-03/C-04 puedan escribir sus tests mientras C-02 está en curso; arrancan sobre código real recién tras el merge del PR único (D10).

**Non-Goals:**
- Servicios, controllers y DTOs (C-03 en adelante). Reglas de negocio de turnos: solapamiento, máquina de estados, grilla (C-07). Aspecto que escribe auditoría (C-06). Normalización de teléfono E.164 y formato de DNI (C-05).
- Alta de consultorio (onboarding) y horarios por defecto: los provee C-04 usando el catálogo de prestaciones sugeridas de C-02.
- Cifrado en reposo de datos de salud (RN-DS-05, a definir) y features post-entrega C-17..C-22.
- Guard de base de datos para `audit_log` vía permisos de MySQL: se documenta para C-16 (D3), no se implementa acá.

## Decisions

### D1 — Aislamiento: `@TenantId` de Hibernate 6 + resolver fail-closed (recomendado)
`TenantEntity` (`@MappedSuperclass`) declara `@TenantId @Column(name = "consultorio_id", nullable = false, updatable = false) Long consultorioId`. Un `TenantIdentifierResolver implements CurrentTenantIdentifierResolver<Long>` lee `TenantContext` y se registra con un `HibernatePropertiesCustomizer` (`hibernate.tenant_identifier_resolver`).

Qué da Hibernate 6.6 con `@TenantId` (verificado en la documentación de 6.6; igual se cubre con tests, ver tareas 1.x):
- Agrega `consultorio_id = :tenant` a toda consulta HQL/Criteria/derivada de Spring Data, y desde 6.6 también a la carga por id (`findById`).
- Completa `consultorio_id` al persistir con el tenant de la sesión y rechaza (`PropertyValueException`) un valor asignado distinto al tenant en curso.
- El resolver se consulta al abrir la sesión (inicio de la transacción).

Comportamiento del resolver:
- `TenantContext` con valor → devuelve ese id.
- Modo sistema activo (`TenantContext.runAsSystem(...)`) → devuelve el centinela `SYSTEM` (`-1L`) y `isRoot(SYSTEM) == true`: Hibernate no aplica el filtro y acepta el `consultorio_id` asignado a mano.
- Ninguno de los dos → lanza `TenantNotSetException` (fail closed: no hay sesión, ni lectura ni escritura).

`TenantContext` (en `common.tenant`): `ThreadLocal<Long>` (no heredable), `set/get(): Optional<Long>/require()/clear()`, `runAs(id, Supplier)` y `runAsSystem(Supplier)` que restauran el estado previo en `finally`. C-03 lo pobla en el filtro JWT y lo limpia en `finally`. Tareas asíncronas o programadas deben usar `runAs` explícitamente (no hay propagación implícita).

Escrituras: el código nunca asigna `consultorio_id` en flujos con tenant; en modo sistema (alta de consultorio, seed) se crea el `Consultorio` y luego los dependientes dentro de `runAs(nuevoId, ...)`.

`Consultorio` no es `TenantEntity` (su `id` es el tenant): su repositorio extiende `Repository<Consultorio, Long>` y expone solo `findById` y `save`; el servicio de "mi consultorio" (C-04) busca por `TenantContext.require()`.

Alternativas:
- `@Filter` + aspecto/interceptor que lo habilita por sesión: no completa `consultorio_id` en inserts, en 6.6 la carga por id requiere configuración adicional, y si el aspecto no corre (tarea async, nuevo punto de entrada) falla **abierto**. Descartado.
- Specification base: cada método de repositorio debe acordarse de usarla; los métodos derivados (`findByDni`) y `findById` la saltean. Falla abierto. Descartado.
- Esquema/base por tenant: fuera de presupuesto y contra DD-02.

**Desvío aprobado (2026-11-23): construcción de repositorios en modo sistema.** Spring Data valida las consultas derivadas al arrancar abriendo un `EntityManager` temporal; el resolver fail-closed lanzaba `TenantNotSetException` y abortaba el arranque. `TenantAwareJpaRepositoryFactoryBean` (con `JpaRepositoriesConfig`) construye cada repositorio dentro de `runAsSystem`. Es un cuarto uso acotado del modo sistema (además de login, alta de consultorio y seed): solo corre al construir repositorios al arrancar, nunca durante requests ni ejecuta consultas de datos. Probado por `TenantContextAfterStartupIT` (tras arrancar el contexto no queda modo sistema ni tenant).

Trade-offs aceptados: las consultas SQL nativas **no** se filtran → regla del change: prohibidas sobre tablas de negocio salvo que reciban `consultorio_id` como parámetro y lo documenten (y regla 8). El modo sistema es un bypass consciente: solo se usa en login (búsqueda por email), alta de consultorio y seed, y cada uso queda acotado a un bloque.

### D2 — Integridad entre consultorios en la base: FK compuestas
Cada tabla padre referenciada declara `UNIQUE (consultorio_id, id)`; cada hija referencia `(consultorio_id, padre_id) → padre(consultorio_id, id)`. Ej.: `turno(consultorio_id, paciente_id) → paciente(consultorio_id, id)`. Así un turno de A con paciente de B es imposible aun con un bug en la aplicación. Las FK con columna nullable (`profesional.usuario_id`, `bloqueo_agenda.sillon_id`, `nota_clinica.turno_id`, `audit_log.usuario_id`) usan la semántica por defecto MATCH SIMPLE (no se verifican si la columna es NULL), igual en H2 y MySQL. JPA mapea solo `@ManyToOne(fetch = LAZY) @JoinColumn(name = "paciente_id")`; la FK compuesta es responsabilidad de la base (Hibernate `validate` no valida FKs). Todas las FK con `ON DELETE RESTRICT` (default).
- Alternativa: FK simple + confiar en el filtro → un solo bug filtra datos de salud. Trade-off: más índices y DDL más verboso; aceptable con 15 tablas.

### D3 — `audit_log` insert-only
- Entidad `AuditLog` con `@Immutable` (Hibernate ignora el dirty checking: modificar una entidad cargada no emite UPDATE).
- `hibernate.query.immutable_entity_update_query_handling_mode: exception` → un `UPDATE/DELETE` HQL sobre `AuditLog` lanza excepción.
- **Decisión 2026-11-23 (verificado en apply):** Hibernate 6.6 rechaza el `UPDATE` HQL sobre una entidad `@Immutable` con ese modo, pero **no** el `DELETE` HQL masivo. Se agrega `AuditLogStatementInspector` (`hibernate.session_factory.statement_inspector`, registrado en `TenantHibernateConfig`) que lanza `UnsupportedOperationException` ante todo SQL `UPDATE`/`DELETE` cuyo destino sea la tabla `audit_log` (coincidencia por identificador exacto, con esquema/comillas opcionales; `audit_log_backup` no coincide); `INSERT` y `SELECT` pasan. Alcance: solo el SQL emitido por Hibernate (HQL, nativo, entidades); JDBC directo no pasa por el inspector, por eso el `GRANT` de C-16 sigue siendo el guard real.
- `AuditLogRepository extends Repository<AuditLog, Long>` (no `JpaRepository`): solo `save`, `findById` y finders paginados. Un test por reflexión verifica que no expone métodos `delete*`/`update*`.
- `AuditLog` es tenant-scoped (`@TenantId`), pero no hereda de `TenantEntity` porque no tiene `updated_at` (lo inmutable no se actualiza): excepción deliberada a "toda tabla con `updated_at`".
- Guard de base: los triggers no son portables (en H2 son clases Java) → descartados. El guard real en MySQL es de permisos (`GRANT SELECT, INSERT` sin `UPDATE/DELETE` sobre `audit_log` para el usuario de la aplicación); se documenta en el handoff para C-16 (requiere separar usuario de migraciones y de aplicación).
- `detalle` es texto (JSON serializado por la aplicación en C-06), no el tipo `JSON` de MySQL (H2 lo trata distinto). Sin PII en `detalle` (regla 5; lo hace cumplir C-06).

### D4 — IDs: `BIGINT` autoincremental (`GenerationType.IDENTITY`)
- Portable (`BIGINT AUTO_INCREMENT` funciona en H2 modo MySQL y MySQL), índices chicos, legible en debugging.
- Alternativa UUID: `BINARY(16)` vs `UUID` nativo de H2 vs `CHAR(36)` complica la portabilidad y la validación de Hibernate; ventaja: no enumerable en URLs.
- Trade-off: los ids son enumerables en la API. Mitigación: el aislamiento por tenant (D1) hace que un id ajeno devuelva vacío (→ 404 en C-05+), que es el control IDOR real; un id opaco no reemplaza ese control. `IDENTITY` impide batch inserts en JDBC: irrelevante para el volumen del MVP.

### D5 — Fechas: UTC
- Instantes como `java.time.Instant` en columnas `DATETIME(6)` (portable; `DATETIME` es alias de `TIMESTAMP` en H2), con `hibernate.jdbc.time_zone: UTC` y `hibernate.type.preferred_instant_jdbc_type: TIMESTAMP` para que Hibernate escriba/lea UTC sin depender de la zona de la JVM ni del servidor. No se usa `TIMESTAMP` de MySQL (convierte con la zona de la sesión y tiene límite 2038).
- `fecha_nacimiento` → `LocalDate`/`DATE`; `hora_desde/hora_hasta` → `LocalTime`/`TIME` (hora local del consultorio, sin zona); `consultorio.zona_horaria` (default `America/Argentina/Buenos_Aires`, UTC-3 sin horario de verano) se usa en C-04/C-07/C-12 para convertir la grilla local a instantes UTC.
- `created_at/updated_at` con Spring Data JPA Auditing (`@CreatedDate/@LastModifiedDate`) y un `DateTimeProvider` respaldado por un bean `Clock` (UTC) → tests deterministas con reloj fijo. `@EnableJpaAuditing` en una `@Configuration` dedicada.
- Alternativa: guardar en hora local del consultorio (RN-AG-08 lo permite) → ambigüedad al crecer a clínicas en otras zonas. Descartado.

### D6 — Enums como `STRING` + `CHECK`
`@Enumerated(EnumType.STRING)` en columnas `VARCHAR(20)` con `CHECK (col IN (...))` (H2 y MySQL ≥ 8.0.16 los aplican). Enums: `Rol`, `EstadoTurno`, `CanalRecordatorio`, `EstadoRecordatorio`, `AccionAuditoria`. Alternativas: `ORDINAL` (reordenar el enum corrompe datos) o `ENUM` de MySQL (validación y portabilidad problemáticas). Trade-off: agregar un valor requiere migración nueva que reemplace el `CHECK` (aceptable y explícito).

### D7 — Sin soft delete genérico; `activo` donde hay historia
- `activo BOOLEAN NOT NULL DEFAULT TRUE` en consultorio, usuario, profesional, sillón, prestación y paciente (RN-PA-03). No se usa `@SoftDelete`/`@SQLDelete`+filtro global: los turnos históricos deben seguir viendo pacientes y prestaciones inactivos; cada caso de uso filtra `activo` explícitamente.
- Turnos no se borran (estado `CANCELADO`); notas clínicas, consentimientos y auditoría no se borran (C-08/C-06). Horarios y bloqueos sí se pueden borrar físicamente (configuración sin valor histórico clínico).
- La FK `RESTRICT` impide borrar físicamente un paciente con turnos/notas/consentimientos aunque un servicio lo intente.

### D8 — Seed
| Dato | Mecanismo | Por qué |
|---|---|---|
| Roles | enum `Rol` + `CHECK` | Fijos en el MVP; una tabla agregaría joins sin valor |
| Texto de consentimiento v1 | `INSERT` en `V2` sobre `consentimiento_texto(version PK, contenido, vigente_desde)` | Necesario en todos los entornos, versionado y auditable; `consentimiento_datos.version_texto` es FK |
| Prestaciones sugeridas | constante de código `PrestacionSugerida` (Consulta 30, Limpieza 45, Arreglo/obturación 60, Control 15) | Se copian por consultorio al crearlo (C-04); no son datos globales |
| Admin de desarrollo | `DevDataSeeder` (`ApplicationRunner`, `@Profile("dev")`), en `runAsSystem` + `runAs(consultorioDev)`, idempotente (si el email ya existe, no hace nada) | Contraseña desde `DEV_ADMIN_PASSWORD`, hasheada con `PasswordEncoder` en runtime |

- Alternativa descartada para el admin: migración Flyway dev-only (`db/dev`): obligaría a versionar un hash BCrypt de una contraseña conocida (credencial hardcodeada de hecho) y a configurar ubicaciones por perfil.
- Sin `DEV_ADMIN_PASSWORD` → el seeder no crea nada y loguea una advertencia sin credenciales.
- `PasswordEncoder`: C-02 define el bean `BCryptPasswordEncoder(12)` en `security/PasswordConfig` porque el seed lo necesita; C-03 lo reutiliza. Es zona de riesgo (regla 12): requiere review del revisor de seguridad (integrante-1/2) y se avisa en la descripción del PR (decisión Q2, ver Decisiones tomadas).
- Propiedades: `app.dev-admin.email: ${DEV_ADMIN_EMAIL:admin@dev.local}`, `app.dev-admin.password: ${DEV_ADMIN_PASSWORD:}` (record tipado, sin default para la contraseña).

### D9 — Turnos: solo tabla e índices (C-07 hace la lógica)
- Columnas: `inicio`, `fin` (`DATETIME(6)` UTC), `estado`, `es_sobreturno BOOLEAN DEFAULT FALSE`, `motivo_cancelacion`, `notas`, `version BIGINT` (`@Version`, bloqueo optimista para edición concurrente), `CHECK (fin > inicio)`.
- Índices: `(sillon_id, inicio)`, `(profesional_id, inicio)` → la consulta de solapamiento de C-07 (`sillon_id = ? AND inicio < :fin AND fin > :inicio AND estado NOT IN ('CANCELADO')`) hace range scan acotado por recurso; `(consultorio_id, inicio)` → vista de agenda por día/semana; `(paciente_id)` → historial del paciente. Las FK compuestas agregan índices `(consultorio_id, sillon_id)` etc.
- El bloqueo pesimista de DD-06 lo implementa C-07 (`PESSIMISTIC_WRITE` sobre la fila de `sillon`/`profesional`, portable); C-02 no agrega constraints de exclusión (MySQL no los tiene).
- `ficha_clinica` también lleva `version` (edición concurrente de anamnesis).

### D10 — Un único PR para todo C-02; los grupos son orden de implementación
Decisión (2026-11-23, Q1): C-02 se entrega en **un solo PR** con los cinco grupos de tareas. Los grupos son únicamente el orden de implementación (de adentro hacia afuera) y no se mergean por separado.

Por qué el orden interno sigue siendo este: con `ddl-auto: validate` y los `@SpringBootTest` de C-01, una entidad sin tabla rompe el arranque, y un repositorio Spring Data necesita la entidad gestionada; por eso el grupo 1 arma primero el mecanismo de tenant y las 7 tablas de cuenta y configuración, y recién después se agrega el resto:
- `TenantContext` + `TenantNotSetException` + resolver fail-closed + `TenantEntity` con `@TenantId`;
- migración `V1` (7 tablas de cuenta y configuración) con sus entidades y repositorios (`Consultorio`, `Usuario`, `Profesional`, `Sillon`, `Prestacion`, `HorarioAtencion`, `BloqueoAgenda`), `Rol` y la configuración JPA (UTC, auditing, `Clock`);
- la meta-anotación de tests `@PersistenceTest` (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + `@Import` de la configuración de tenant/auditing/clock);
- luego `V2` y el resto (grupos 2–5).

Trade-off aceptado: C-03 (Gimena) y C-04 (Renzo) quedan esperando a que este PR esté mergeado para construir sobre entidades reales; el camino crítico C-02 → C-03 se alarga lo que tarde el PR completo y su review. Mitigación: mientras C-02 está en curso, C-03 y C-04 pueden escribir sus tests contra este `design.md` (firma de `TenantContext`/`runAs`/`runAsSystem`, nombres de entidades y columnas de D2–D9, `@PersistenceTest`, `TenantFixtures`), sin esperar al merge. Al ser un solo PR, `V1` y `V2` se revisan juntas y pueden corregirse libremente antes del merge; recién al mergear quedan congeladas (regla 6) y cualquier corrección posterior es `V3`, por lo que el DDL completo se revisa con lupa en el PR.

### D11 — Columnas de texto largo y representación textual
- Textos clínicos y largos (`ficha_clinica.*`, `nota_clinica.texto`, `consentimiento_texto.contenido`, `audit_log.detalle`, `turno.notas`) como `TEXT` (portable; evita el límite de 65 535 bytes por fila de MySQL que superarían varios `VARCHAR(4000)` en utf8mb4). Si `validate` objeta el tipo en H2/MySQL, se ajusta el mapeo de la entidad (`@Lob`/`@JdbcTypeCode(SqlTypes.LONG32VARCHAR)`), no la migración; lo detecta el test de arranque.
- Email normalizado a minúsculas en la entidad (`@PrePersist/@PreUpdate`), porque la colación de MySQL es case-insensitive pero H2 no: así la unicidad es igual en ambos.
- `toString()` de entidades solo con clase e id; `equals/hashCode` por id (patrón seguro con proxies). No se agrega Lombok.
- `spring.jpa.show-sql: false` explícito y logger `org.hibernate.orm.jdbc.bind` fuera de `TRACE` (regla 5).

### D12 — Estrategia de tests
- Persistencia: `@PersistenceTest` contra H2 modo MySQL con las migraciones reales (regla 8); nunca mock de la base. Cada test de repositorio fija tenant con `TenantContext.runAs` y crea los consultorios A/B en `runAsSystem` con un helper `TenantFixtures`.
- Aislamiento: un test parametrizado recorre todas las entidades tenant-scoped (A vs B en `findAll`, `findById`, finder derivado).
- Violaciones de constraints (unicidad, CHECK, FK compuesta, borrado de paciente con turnos) con `JdbcTemplate` o `saveAndFlush` y `assertThatThrownBy(...).isInstanceOf(DataIntegrityViolationException.class)`.
- Unitarios puros sin Spring: `TenantContext`, resolver, `PrestacionSugerida`, `toString`.
- Commit real (no rollback) solo donde hace falta (inmutabilidad de `audit_log`, `@Immutable` se ve recién al flush/commit); esos tests limpian sus filas porque la base H2 se comparte entre contextos (`DB_CLOSE_DELAY=-1`).

## Risks / Trade-offs

- [El filtro `@TenantId` no cubre SQL nativo] → prohibido sobre tablas de negocio sin `consultorio_id` explícito; revisión en PR; FK compuestas como segunda barrera.
- [Modo sistema mal usado = bypass del aislamiento] → API acotada a bloque (`runAsSystem(Supplier)`), sin setter global; usos permitidos enumerados en D1; cada uso se justifica en el PR.
- [Comportamiento de `@TenantId` en carga por id o en sesión root distinto al documentado] → tests explícitos en el grupo 1 (`findById` cruzado, alta con tenant ajeno, root con valor asignado) antes de construir encima; si `findById` no filtra, se agrega un `TenantGuard` en un repositorio base (plan B) y se reporta.
- [Fuga del `ThreadLocal` entre requests del pool] → `runAs` restaura en `finally`; C-03 limpia en `finally` del filtro; test de limpieza tras excepción.
- [H2 modo MySQL ≠ MySQL] → solo SQL estándar (`CHECK`, FK compuestas, `DATETIME(6)`, `TEXT`, `BOOLEAN`, `BIGINT AUTO_INCREMENT`); sin `ENGINE`/`CHARSET` en el DDL (el charset `utf8mb4` viene del default de MySQL 8 / Compose); verificación manual con `docker compose up` contra MySQL antes de cerrar el PR (tarea 5.x, la ejecuta la persona; regla 9).
- [Tipos de columna vs `validate` (TEXT, BOOLEAN, DATETIME)] → el test de arranque lo detecta en H2; en MySQL, la verificación manual.
- [`V1`/`V2` congeladas tras el merge del PR único] → revisión de DDL obligatoria antes del merge; correcciones posteriores como `V3`.
- [Email único global impide que una persona sea usuaria de dos consultorios] → acorde a KB 04 y al MVP; clínicas multi-sede es post-entrega.

## Migration Plan

- Greenfield: no hay datos. Un solo PR con `V1` y `V2` (D10).
- Tras el merge, cada integrante con MySQL local: `docker compose up mysql` (si se pide) y arrancar en `dev`; Flyway aplica lo pendiente. Si alguien aplicó una versión preliminar de una migración desde una rama, debe recrear su base local (`docker compose down -v`), nunca editar `flyway_schema_history`.
- Rollback: revertir el PR antes de que otros lo apliquen; después de aplicado, solo hacia adelante con migración nueva.

## Decisiones tomadas

Resueltas por la persona el 2026-11-23 (ya no son preguntas abiertas):

- **Q1 — Composición del PR (D10)** — decidido 2026-11-23 (distinto del default): C-02 se entrega en **un solo PR**; se descarta el plan de PR 1 (grupo 1) mergeable solo. Los grupos de tareas son orden de implementación. Costo: C-03 (Gimena) y C-04 (Renzo) esperan al merge; mientras tanto escriben sus tests contra este `design.md`.
- **Q2 — Bean `PasswordEncoder` en C-02** — decidido 2026-11-23 (default aceptado): lo define C-02 (`BCryptPasswordEncoder(12)` en `security/PasswordConfig`) y C-03 lo reutiliza. Es zona de riesgo (regla 12): requiere review del revisor de seguridad.
- **Q3 — `audit_log` sin `updated_at` y con `consultorio_id NOT NULL`** — decidido 2026-11-23 (default aceptado): se mantiene así. Un login fallido con email inexistente no tiene consultorio: se registra en el log de aplicación, sin PII, y C-06 lo confirma. Cambiarlo después implicaría `V3`.
- **Q4 — `paciente.dni NOT NULL`** — decidido 2026-11-23 (default aceptado): obligatorio (`VARCHAR(20)`), único por consultorio; el formato lo valida C-05.

## Open Questions

Ninguna bloquea C-02 (Q1–Q4 resueltas arriba).

Tampoco bloquean C-02 (se resuelven en sus changes sin tocar este esquema): PA-03 (duraciones sugeridas: quedan como constante editable), PA-04 (conservación de HC: no hay borrado físico de datos clínicos), PA-07 (RBAC de recepción sobre ficha: C-03/C-08), PA-08 (adenda de notas: C-08 agrega columna con migración nueva si hace falta), PA-10 (JWT vs cookie: C-03).
