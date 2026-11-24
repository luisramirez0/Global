# Design

## Context

- C-02 dejó `audit_log` en `V2__pacientes_turnos_auditoria.sql`: `consultorio_id NOT NULL`, `usuario_id` nullable con FK compuesta `(consultorio_id, usuario_id) → usuario`, `accion` con CHECK, `entidad VARCHAR(100) NOT NULL`, `entidad_id` nullable, `detalle TEXT`, `ip VARCHAR(45)`, `created_at DATETIME(6)`, índice `(consultorio_id, created_at)`. La entidad `AuditLog` es `@Immutable` con `@TenantId` (Hibernate filtra y asigna el consultorio), `AuditLogRepository extends Repository` (solo `save`, `findById`, `findAll(Pageable)`) y `AuditLogStatementInspector` rechaza `UPDATE`/`DELETE` SQL sobre la tabla. Ids `IDENTITY`: el `INSERT` se ejecuta en el `save`, no al hacer flush.
- C-03 dejó `LoginService` escribiendo `LOGIN` a mano (`detalle` `ok`/`fallido`, IP de `AuthController` vía `getRemoteAddr()`), dentro de `TransactionTemplate` y `TenantContext.runAs(consultorio del usuario)`. El email inexistente no se audita (decisión Q3 de C-02). `Permisos.GESTION` ya incluye auditoría; `ApiExceptionHandler` responde `ProblemDetail` sin valores (incluye `400` por tipo inválido en `@RequestParam` y `ValidacionException`) y un `500` genérico.
- C-05 dejó `common.web.Pagina<T>` y el patrón de paginación acotada en el servicio; permisos con `@PreAuthorize` en el servicio, no en el controller.
- Spring Boot 3.5.16 / Hibernate 6.6 / Jackson 2. `build.gradle` no declara `spring-boot-starter-aop`. El plugin de Boot compila con `-parameters` (los nombres de argumentos están disponibles para SpEL).
- Restricciones: V1/V2 cerradas (regla 6); H2 `MODE=MySQL` sin mocks de base (regla 8); logs solo con ids (regla 5); sin dependencias pagas (regla 11). Motivación y alcance: `proposal.md`. Requisitos: `specs/audit-log/spec.md`, `specs/authentication/spec.md`.

## Goals / Non-Goals

**Goals:**
- Un contrato estable y chico para C-07/C-08/C-15 (`@Audited` + `AuditService`), difícil de usar mal: sin transacción no audita, sin detalle válido no audita, y en ambos casos la operación falla.
- Atomicidad operación↔auditoría: no hay lectura clínica devuelta ni cambio confirmado sin su registro (RN-DS-02).
- Consulta del log con la misma forma de páginas y errores que el resto de la API.

**Non-Goals:**
- Auditar intentos denegados (`403`) o fallidos de operaciones de negocio (solo LOGIN fallido, ya existente).
- Auditar la lectura del propio log (`GET /api/auditoria`).
- Retención/purga del log (PA-04 abierta; el log es insert-only y se conserva indefinidamente).
- Guard por `GRANT` en MySQL y confianza en proxies (`server.forward-headers-strategy`): C-16.
- Nombre del usuario en la respuesta del log (solo `usuarioId`).

## Decisions

### D1 — Paquetes y piezas
En `ar.global.odonto.auditoria`:

| Pieza | Responsabilidad |
|---|---|
| `AuditService` | Único escritor de `audit_log`. `@Transactional(propagation = MANDATORY)`. |
| `DetalleAuditoria` | Valor inmutable tipado para el `detalle` (D4); serializa a JSON. |
| `Audited` | Anotación declarativa (D3). |
| `AuditoriaAspect` | `@Around` de `@Audited`; abre/une la transacción y registra (D2, D3). |
| `ContextoAuditoria` | Resuelve usuario (del `Jwt` del `SecurityContext`) e IP (D5) de la request en curso. |
| `consulta.AuditoriaController` / `AuditoriaConsultaService` / `AuditLogResponse` / `AuditLogMapper` | `GET /api/auditoria` (D6). |

`AuditLogRepository` gana solo una consulta de lectura (`buscar`, D6); sigue sin `delete*`/`saveAll`/`flush`. **No** se usa `JpaSpecificationExecutor`: en Spring Data 3.5 trae `delete(Specification)`, lo que rompería "solo alta y consulta".

Dependencia: `implementation 'org.springframework.boot:spring-boot-starter-aop'` (Spring, gratis). Se declara explícita aunque `aspectjweaver` llegue transitivamente, para no depender de ese detalle.

### D2 — Política de fallo: fail-closed en la misma transacción
- `AuditService.registrar*` exige transacción activa (`MANDATORY`): llamada sin transacción → `IllegalTransactionStateException` → la operación falla. Así nadie puede auditar "aparte" por accidente.
- El aspecto ejecuta `proceed()` **y** el registro dentro de un `TransactionTemplate` `REQUIRED` de lectura-escritura: si el método ya tiene `@Transactional` o usa su propio `TransactionTemplate`, ambos se unen a esa transacción. Cualquier excepción del registro (detalle inválido, SpEL inválido, FK, base caída) se loguea `ERROR` con `accion`, `entidad`, `entidadId`, `consultorioId` y el **tipo** de excepción (nunca el mensaje, regla 5), se relanza como `AuditoriaFallidaException` (runtime), revierte la transacción y llega al `500` genérico de `ApiExceptionHandler`. Los datos leídos nunca salen porque el controller no recibe el valor de retorno.
- Por qué no `REQUIRES_NEW` + log/métrica: con transacción separada, una lectura de ficha podría devolverse sin registro (o un alta confirmarse sin él), violando RN-DS-02; y una alta revertida dejaría un `CREATE` huérfano. El costo de fail-closed es disponibilidad: si `audit_log` no acepta inserts, las operaciones auditadas no funcionan. Para datos de salud se prefiere eso, y es ruidoso (500 + log `ERROR`), no silencioso.
- El `INSERT` ocurre en el `save` (id `IDENTITY`), dentro de la transacción y antes de que el método devuelva, así que el error aparece antes del commit.
- LOGIN mantiene su transacción actual: el `LOGIN ok` va en la misma transacción que `ultimo_login` (si falla, el login falla con `500` y no se emite token); el `LOGIN fallido` va en su propia transacción (no hay operación que revertir) y si falla se responde `500` en lugar de `401`.

### D3 — Contrato de `@Audited` (para C-07/C-08/C-15)
```java
@Target(ElementType.METHOD) @Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    AccionAuditoria accion();
    String entidad();              // nombre lógico estable, p. ej. "FichaClinica"; ≤ 100
    String entidadId() default ""; // SpEL: "#pacienteId", "#p0", "#result.id()"; "" = sin id
}
```
Reglas del contrato (Javadoc + handoff):
1. Solo en métodos `public` de beans de Spring invocados desde otro bean (proxy; no aplica en auto-invocación ni métodos `private`/`final`).
2. Se registra **después** de que el método retorna sin excepción; si lanza (negocio, `404`, `403`), no hay registro y la excepción sigue igual.
3. `entidadId` se evalúa con SpEL sobre los argumentos (por nombre o `#pN`) y `#result`; debe dar `Long`/`Integer`/`null`. Otro tipo o error de evaluación → la operación falla (D2): es un error de programación que los tests del consumidor detectan.
4. Orden del aspecto: `@Order(Ordered.LOWEST_PRECEDENCE - 100)`. Queda **dentro** de `@PreAuthorize` (Spring Security, órdenes 100–600: un `403` se decide antes de abrir la transacción de auditoría) y **fuera** del interceptor de `@Transactional` (`LOWEST_PRECEDENCE`), para que la transacción la abra el aspecto en modo lectura-escritura y un `@Transactional(readOnly = true)` interno se una a ella (con la transacción `readOnly` abierta primero, MySQL rechazaría el `INSERT` en una conexión de solo lectura).
5. **Los métodos auditados de lectura NO deben anotarse `@Transactional(readOnly = true)`.** El `INSERT` de auditoría corre en la transacción de la propia operación: si esa transacción fuera de solo lectura, MySQL (el driver marca la conexión read-only) rechaza el `INSERT` ("Connection is read-only"), mientras que H2 no lo detecta y los tests en H2 pasarían igual. Si el método no declara `@Transactional`, el aspecto abre una transacción de lectura-escritura; un `readOnly = true` declarado en una capa interna se une a esa transacción y se ignora, pero no hay que apoyarse en eso. Documentado en el Javadoc de `@Audited` y verificado por `AuditoriaAspectIT.auditedReadMustNotRunInAReadOnlyTransaction` (el flag `isCurrentTransactionReadOnly()` es `false`); la verificación contra MySQL real queda en el follow-up manual.
6. Detalle dinámico (p. ej. `sobreturno=true`) o id no expresable: el método llama a `AuditService.registrar(...)` explícitamente dentro de su transacción en lugar de usar `@Audited`. Lo mismo para métodos que capturan errores de integridad **fuera** de su transacción para traducirlos (patrón de `PacienteService.crear`): con `@Audited` esa captura quedaría dentro de la transacción del aspecto marcada rollback-only.

API explícita:
```java
void registrar(AccionAuditoria accion, String entidad, Long entidadId, DetalleAuditoria detalle);
void registrarComo(Long usuarioId, String ip, AccionAuditoria accion, String entidad, Long entidadId, DetalleAuditoria detalle);
```
`registrar` toma consultorio de `TenantContext.require()` (vía `@TenantId`), usuario e IP de `ContextoAuditoria` (ambos `null` fuera de una request: jobs de C-09). `registrarComo` existe para LOGIN, donde todavía no hay autenticación en el contexto. `entidad` en blanco o > 100 → `IllegalArgumentException` antes de tocar la base.

### D4 — `detalle`: JSON restringido, sin PII
- `DetalleAuditoria` se construye solo con métodos tipados: `con(String clave, long)`, `con(String, boolean)`, `con(String, Enum<?>)` (nombre del enum) y `codigo(String clave, String codigo)`. Reglas: clave `^[a-z][A-Za-z0-9]{0,39}$`, a lo sumo 10 claves, código `^[A-Za-z0-9_.:-]{1,40}$` (sin espacios ni acentos: un nombre o texto clínico no pasa), JSON serializado ≤ 1000 caracteres; violación → `DetalleAuditoriaInvalidoException` (la operación falla, D2). `DetalleAuditoria.vacio()` → columna `NULL`.
- Serialización con el `ObjectMapper` de Spring, orden de claves estable (`LinkedHashMap`), objeto plano.
- Riesgo residual: un código como `perez` cumple el patrón. Se mitiga por contrato (los códigos salen de constantes del código, nunca de input del usuario) y por review; no hay forma automática de distinguirlo.
- LOGIN: `{"resultado":"ok"}` / `{"resultado":"fallido"}` (antes texto plano).
- Alternativa descartada: `Map<String, Object>` libre con validación posterior — más fácil de usar con datos del request; un tipo cerrado guía al consumidor.

### D5 — Usuario e IP
- Usuario: si la `Authentication` del `SecurityContextHolder` es un `JwtAuthenticationToken`, `Long.valueOf(jwt.getSubject())`; si no, `null`. No se consulta la base: la FK compuesta `(consultorio_id, usuario_id)` rechaza un usuario ajeno al tenant (y eso hace fallar la operación, D2).
- IP: `HttpServletRequest.getRemoteAddr()` de `RequestContextHolder` (fuera de request → `null`), recortada a 45 caracteres. **No** se lee `X-Forwarded-For` ni `Forwarded` en el código: son falsificables por el cliente. Cuando haya un proxy (C-16) se activa `server.forward-headers-strategy=native|framework`, que reescribe `getRemoteAddr()` solo con proxies de confianza, sin tocar este código. `AuthController` pasa a usar el mismo resolutor (misma IP en el log y en el rate limiter).

### D6 — `GET /api/auditoria`
- Parámetros opcionales: `desde`, `hasta` (`Instant` ISO-8601 UTC, `@DateTimeFormat(iso = DATE_TIME)`; `desde` inclusivo, `hasta` exclusivo), `accion` (`AccionAuditoria`; valor desconocido → `400` vía `handleTypeMismatch`, sin eco), `entidad` (≤ 100), `entidadId`, `usuarioId`, `page` (default 0), `size` (default 20, máx. 100, `< 1` → 20, como C-05). `desde > hasta` → `ValidacionException("desde", ...)` → `400`.
- `AuditoriaConsultaService.buscar(...)`: `@PreAuthorize(Permisos.GESTION)`, `@Transactional(readOnly = true)`. Orden fijo `createdAt DESC, id DESC`.
- Consulta JPQL portable (sin SQL nativo) con filtros `(:p is null or campo = :p)`; el tenant lo agrega `@TenantId`. El índice `(consultorio_id, created_at)` sirve para el orden y el rango; los demás filtros recorren las filas del consultorio, aceptable para el volumen de un consultorio independiente. **Sin migración `V3`.**
- `AuditLogResponse(Long id, Instant fecha, Long usuarioId, AccionAuditoria accion, String entidad, Long entidadId, JsonNode detalle, String ip)` dentro de `Pagina<AuditLogResponse>`. `AuditLogMapper` parsea `detalle`; texto que no es JSON objeto (filas `ok`/`fallido` previas a C-06 en bases de desarrollo) → `detalle: null` y log `WARN` con el id.
- Sin auditoría de esta lectura (Non-Goals).

### D7 — Estrategia de tests (TDD, regla 8)
- Unitarios puros: `DetalleAuditoriaTest`, evaluación de `entidadId` (SpEL), `ContextoAuditoria` con request/`SecurityContext` armados a mano.
- Persistencia (`@PersistenceTest`, `TenantFixtures`): `AuditServiceTest` (campos, tenant, `MANDATORY`, FK de usuario ajeno), `AuditLogRepository.buscar` (filtros, orden, aislamiento A/B), y el test existente de "solo alta y consulta" sigue pasando.
- Aspecto: beans de prueba en `src/test` (`AuditedProbeService`) con métodos `@Audited` que escriben una fila de negocio (p. ej. `Sillon`), para verificar registro, ausencia de registro ante excepción, rollback cuando la auditoría falla y unión con `@Transactional(readOnly = true)`. El fallo se provoca **sin mocks**: token de un `usuarioId` inexistente en el consultorio → la FK compuesta rechaza el `INSERT` en H2.
- HTTP (`@SpringBootTest` + MockMvc, `TestTokens`/`AuthFlows`): `AuditoriaControllerIT` (paginado, filtros, `400`), `AuditoriaRbacIT` (`RECEPCION` → `403`, sin token → `401`), `AuditoriaTenantIsolationIT`, probe HTTP con `500` sin datos, `OutputCaptureExtension` para logs sin PII, y `LoginServiceTest`/`LoginControllerIT` actualizados al nuevo `detalle`.

Skills aplicadas: `java-springboot`/`springboot-patterns` (servicio dueño de la transacción, DTO records, `ProblemDetail`, paginación acotada), `springboot-security` (método con `@PreAuthorize`, deny by default, no confiar en encabezados del cliente), `java-jpa-hibernate` (JPQL portable, sin entidades en la API), `api-design-principles` (recurso plural de solo lectura, envoltorio de página común, errores uniformes), `springboot-tdd`/`java-junit` (sin Testcontainers: H2).

## Risks / Trade-offs

- [Fail-closed reduce disponibilidad: si `audit_log` falla, fallan las operaciones auditadas] → Es la elección explícita por RN-DS-02; el fallo es visible (500 + log `ERROR` con ids) y se prueba.
- [Orden de aspectos mal configurado haría que el `INSERT` corra en una transacción `readOnly` (MySQL lo rechaza; H2 no lo detecta)] → Orden fijado en una constante con test que verifica que la transacción activa al registrar no es read-only (`TransactionSynchronizationManager.isCurrentTransactionReadOnly()`); verificación manual contra MySQL en el follow-up.
- [Auto-invocación o método no público: `@Audited` no se aplica y no hay registro] → Documentado en el contrato; cada consumidor (C-07/C-08/C-15) debe tener un test que afirme la entrada en `audit_log`.
- [Código de detalle con dato personal que cumple el patrón] → Contrato + review de integrante-1; el patrón descarta espacios y acentos.
- [La respuesta expone IP y `usuarioId` (la IP puede considerarse dato personal)] → Solo para `ADMIN`/`PROFESIONAL` del mismo consultorio; es el propósito del log. Checkpoint 5.
- [Sin `GRANT`, un acceso JDBC directo podría modificar `audit_log`] → Fuera del alcance (C-16); los guards de C-02 siguen activos.
- [Filas `LOGIN` previas con `detalle` en texto plano] → Solo en bases de desarrollo; se muestran con `detalle: null`.

## Migration Plan

- Sin cambios de esquema: no hay `V3`; `git diff main -- backend/src/main/resources/db/migration` debe quedar vacío.
- Despliegue normal del backend. Rollback: revertir el PR; las filas escritas con `detalle` JSON siguen siendo válidas para el código anterior (que no lee `detalle`).
- Consumidores: C-07/C-08/C-15 arrancan sobre el contrato de D3 una vez mergeado.

## Open decisions / checkpoints for human approval

Governance CRÍTICO: el apply no arranca sin la aprobación de la persona sobre estos puntos (aprobar en bloque o por número).

1. **Política fail-closed en la misma transacción** (D2) en lugar de `REQUIRES_NEW` + log/métrica.
2. **Formato del `detalle`**: JSON plano restringido (D4) y cambio de LOGIN a `{"resultado":"ok"|"fallido"}` (modifica el spec `authentication`).
3. **Login con email inexistente sigue fuera de `audit_log`** (solo log de aplicación sin email), como decidió C-02 Q3 (`consultorio_id NOT NULL`).
4. **IP solo de `getRemoteAddr()`**; `X-Forwarded-For` no se interpreta y queda para C-16 vía `server.forward-headers-strategy`.
5. **`GET /api/auditoria` expone `ip` y `usuarioId`** (sin nombre ni email del usuario) a `ADMIN`/`PROFESIONAL`.
6. **Solo se auditan operaciones exitosas** (no los `403`/`404`/errores de negocio) y **no se audita la lectura del propio log**.
7. **Nueva dependencia** `spring-boot-starter-aop`.
8. **Paginación**: `size` por defecto 20, máximo 100; filtros de fecha en `Instant` UTC con `hasta` exclusivo.
9. **Sin migración nueva** (el índice existente alcanza).

Preguntas abiertas de la KB que tocan la auditoría (no bloquean C-06): PA-04 (plazo de conservación: hoy se conserva todo, sin purga) y PA-07 (si `RECEPCION` llegara a ver la ficha, sus lecturas igual quedarían auditadas por C-08; el log en sí sigue siendo de `GESTION`).
