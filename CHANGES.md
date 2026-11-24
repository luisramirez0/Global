# CHANGES — Secuencia de Implementación

> Índice canónico de todos los changes del proyecto **Global** (gestión de turnos odontológicos, SaaS multi-tenant; MVP para odontólogo independiente).
> Cada change es atómico: un agente puede implementarlo en una sesión (~4-6 horas).
> **Leer este archivo antes de empezar un item.**

**Stack**: frontend TypeScript vanilla · backend Spring Boot (REST, Gradle, Hibernate/JPA) · MySQL. Presupuesto cero.
**Entrega**: 25/11/2026 (2 días desde 2026-11-23). Equipo de 5 en paralelo.
**TDD estricto**: obligatorio en TODA la implementación (RED → GREEN → TRIANGULAR → REFACTOR; mínimo 2 casos por comportamiento).

---

## Cómo usar este documento

1. Identificar el item a implementar y verificar que sus dependencias figuran completas en este roadmap.
2. Leer los docs de la knowledge-base indicados en "Leer antes".
3. Acordar el alcance y los criterios de aceptación del item.
4. Implementar con TDD estricto, verificar los criterios acordados y registrar la evidencia.
5. Marcar el checkbox `[x]` en este archivo al completar la verificación técnica.

Conservá los IDs de las fichas al editar o reordenar. `Zona` define el área de código del item (insumo para CODEOWNERS); `Responsable` es un placeholder (Integrante 1..5) a confirmar por el equipo.

---

## Corte de entrega

### MVP mínimo entregable (25/11/2026) — C-01 a C-16

Corte vertical: setup, auth, pacientes + ficha básica, agenda/turnos sin solapamiento, recordatorios wa.me/email, auditoría.
Si el tiempo no alcanza, el orden de recorte (de lo último a lo primero) es: C-16 (solo hardening, no la demo básica) → email de C-09 → exportación de C-15 → C-11 (config por UI; usar seed) → C-14. **Nunca** se recortan C-01..C-08, C-10, C-12, C-13 (corte vertical mínimo: auth + pacientes + turnos sin solapamiento + wa.me, ver R-01 en KB 10).

### Post-entrega — C-17 a C-22 (roadmap, NO se implementan para el 25/11)

Lista de espera, reserva online, seña Mercado Pago, recall de ausentes, clínica avanzada (odontograma/presupuestos), obras sociales/ARCA.

---

## Árbol de dependencias

```
C-01 project-setup
  └── C-02 core-data-model
        └── C-03 auth-jwt-rbac                      ← desbloquea TODO lo demás (FORK)
              │
              ├── C-04 consultorio-config-api       (sillones, prestaciones, horarios, bloqueos)
              ├── C-05 pacientes-api
              ├── C-06 auditoria-core
              └── C-10 frontend-shell-auth          (también necesita C-01)
                    │
   C-04 + C-05 + C-06 ──► C-07 turnos-agenda-engine
   C-05 + C-06 ─────────► C-08 ficha-clinica-consentimiento
   C-07 ────────────────► C-09 recordatorios-whatsapp-email
   C-10 + C-04 ─────────► C-11 frontend-config
   C-10 + C-05 + C-08 ──► C-12 frontend-pacientes-ficha
   C-10 + C-07 ─────────► C-13 frontend-agenda
   C-13 + C-09 ─────────► C-14 frontend-recordatorios
   C-06 + C-07 + C-08 + C-10 ──► C-15 auditoria-export-ui
   C-09 + C-11 + C-12 + C-14 + C-15 ──► C-16 entrega-hardening-demo
Post-entrega (después de C-16):
   C-07 ► C-17 lista-espera ► C-20 recall-ausentes
   C-07 + C-09 ► C-18 reserva-online-publica ► C-19 sena-mercadopago
   C-08 ► C-21 clinica-avanzada
   C-05 + C-07 ► C-22 obras-sociales-arca
```

### Paralelismo por fase

> Cada "gate" es un punto de sincronización. Los changes dentro de un gate pueden ejecutarse en paralelo (un lane por integrante).

```
GATE 0: ninguna
  → C-01 project-setup                      [Integrante 1]
  (resto del equipo: acordar contrato OpenAPI, convenciones de test y datos de seed; no son changes)

GATE 1: C-01 ✓
  → C-02 core-data-model                    [Integrante 2]
  → C-10 frontend-shell-auth (UI + cliente API con mocks; integra al llegar C-03)  [Integrante 1]

GATE 2: C-02 ✓
  → C-03 auth-jwt-rbac                      [Integrante 3]

GATE 3: C-03 ✓     ← FORK (5 lanes)
  → C-04 consultorio-config-api             [Integrante 4]
  → C-05 pacientes-api                      [Integrante 5]
  → C-06 auditoria-core                     [Integrante 2]
  → C-10 frontend-shell-auth (integración real)  [Integrante 1]
  → tests de dominio puro de turnos (máquina de estados, solapamiento; parte de C-07)  [Integrante 3 — sin dependencias de datos]

GATE 4: C-04 ✓ + C-05 ✓ + C-06 ✓     ← FORK
  → C-07 turnos-agenda-engine               [Integrante 3]
  → C-08 ficha-clinica-consentimiento       [Integrante 5 — si C-05 ✓, C-06 ✓]
  → C-11 frontend-config                    [Integrante 4 — si C-10 ✓, C-04 ✓]

GATE 5: C-07 ✓ / C-08 ✓ / C-10 ✓     ← FORK
  → C-09 recordatorios-whatsapp-email       [Integrante 4]
  → C-13 frontend-agenda                    [Integrante 1 — si C-10 ✓, C-07 ✓]
  → C-12 frontend-pacientes-ficha           [Integrante 5 — si C-08 ✓]
  → C-15 auditoria-export-ui                [Integrante 3]

GATE 6: C-09 ✓ + C-13 ✓
  → C-14 frontend-recordatorios             [Integrante 1]

GATE 7: C-09, C-11, C-12, C-14, C-15 ✓
  → C-16 entrega-hardening-demo             [Integrante 2 coordina; todos]
```

### Camino crítico (8 changes — mínimo irreducible)

```
C-01 → C-02 → C-03 → C-04* → C-07 → C-09 → C-14 → C-16
```
(`*` C-05 y C-06 son co-requisitos de C-07 en paralelo con C-04; no agregan longitud a la cadena si se ejecutan a la par.)

### Plan óptimo con 5 agentes (lanes)

| Paso | Int. 1 (Frontend) | Int. 2 (Dominio agenda) | Int. 3 (Seguridad/Audit) | Int. 4 (Config + Comunicación) | Int. 5 (Pacientes/Salud) |
|------|-------------------|--------------------------|---------------------------|--------------------------------|---------------------------|
| 1 | C-01 | contrato OpenAPI / tests de dominio | contrato auth / seguridad | contrato config | contrato pacientes |
| 2 | C-10 (mocks) | C-02 | prepara C-03 | — | — |
| 3 | C-10 (integra) | tests puros de turnos | C-03 | — | — |
| 4 | C-10 (cierre) | C-06 | tests puros de turnos | C-04 | C-05 |
| 5 | C-13 (con mocks) | revisión de seguridad | C-07 | C-11 | C-08 |
| 6 | C-13 | — | C-07 (cierre) + C-15 | C-09 | C-12 |
| 7 | C-14 | C-16 (coordina) | C-16 (seguridad) | C-16 | C-16 |

---

## FASE 1 — Fundación (secuencial, un solo lane crítico)

> Poca paralelización posible: el resto del equipo deja listos el contrato OpenAPI y los casos de prueba mientras esto avanza.

### [C-01] `project-setup`
- **Estado**: `[x]` completado — verificacion tecnica: `bash scripts/test.sh` verde (backend 15 + frontend 9 tests), lint/typecheck limpios, `docker compose --env-file .env.example config` valido; pendiente `docker compose up` manual. Handoff: `knowledge-base/entrega/C-01.md`
- **Resultado**: `./gradlew test` y `npm test` corren en verde (test de humo) y `docker compose up` levanta MySQL + backend + frontend estático.
- **Scope**:
  - `backend/`: proyecto Gradle Spring Boot (Web, Data JPA, Validation, Security, Flyway, MySQL driver), paquetes `config/ security/ common/` y por dominio; perfiles `dev`/`test`.
  - Config por variables de entorno (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MIN`, `SMTP_*`, `APP_BASE_URL`, `CORS_ALLOWED_ORIGINS`); `.env.example`, sin secretos en el repo.
  - `frontend/`: TypeScript vanilla (`tsconfig.json`, `index.html`, bundler liviano, Vitest) con estructura `src/api pages components state utils`.
  - `docker-compose.yml` (MySQL + backend + frontend estático); `.gitignore`; script de tests.
  - Tests: contexto Spring carga, Vitest corre, CORS restringido.
- **Dependencias**: ninguna
- **Zona**: `backend/build.gradle*`, `backend/src/main/java/.../config/`, `frontend/` (config), `docker-compose.yml`, raíz
- **Responsable**: Integrante 1
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios, §Variables de entorno, §Despliegue
  - `knowledge-base/09_decisiones_y_supuestos.md`

### [C-02] `core-data-model`
- **Estado**: `[x]` completado (pendiente de merge del PR) — evidencia: backend 189/189 y frontend 9/9 con `bash scripts/test.sh`; aislamiento A/B en los 13 repositorios tenant-scoped; V1/V2 aplican en H2 `MODE=MySQL` y en MySQL 8 (verificación manual de Luis, 2026-11-23: 15 repositorios, seed id=1, /api/health UP). Handoff: `knowledge-base/entrega/C-02.md`
- **Resultado**: las migraciones aplican limpias sobre MySQL y los repositorios aíslan datos por `consultorio_id` (test de aislamiento en verde).
- **Scope**:
  - Migración 001 (Flyway): `consultorio`, `usuario`, `profesional`, `sillon`, `prestacion`, `horario_atencion`, `bloqueo_agenda` con `consultorio_id`, `created_at`, `updated_at`.
  - Migración 002: `paciente`, `ficha_clinica`, `nota_clinica`, `consentimiento_datos`, `turno`, `recordatorio`, `audit_log` (insert-only) con índices del KB 04.
  - Entidades JPA + base `TenantEntity` + filtro de tenant centralizado (Hibernate filter / especificación base) y `TenantContext`.
  - Seed: roles (enum), texto de consentimiento v1, usuario admin solo en perfil `dev`, prestaciones sugeridas.
  - Tests: aislamiento multi-tenant, unicidad DNI por consultorio, email único.
- **Dependencias**: `C-01`
- **Zona**: `backend/src/main/java/.../{consultorio,usuario,paciente,agenda,recordatorio,auditoria,common}/` (entidades/repos), `backend/src/main/resources/db/migration/`
- **Responsable**: Integrante 2
- **Governance**: CRITICO (modelos core que todo referencia; aislamiento de tenant)
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md`
  - `knowledge-base/05_reglas_de_negocio.md` §RN-MT, §RN-DS
  - `knowledge-base/08_arquitectura_propuesta.md` §Patrones

### [C-03] `auth-jwt-rbac`
- **Estado**: `[x]` completado, mergeado en PR #3 (merge `6e69f62`) y archivado en `openspec/changes/archive/2026-11-23-c-03-auth-jwt-rbac`. Evidencia: backend 264/264 con `./gradlew test` (línea base 189; tests de registro, login, hash, expiración, firma alterada, rol insuficiente, rate limit y aislamiento A/B por token); verificación manual contra MySQL 8 por la persona (registro, login y /api/auth/me OK, 2026-11-23). Handoff: `knowledge-base/entrega/C-03.md`
- **Resultado**: registro + login emiten token; rutas protegidas devuelven 401/403 según rol; contraseñas con hash; el acceso cruzado entre consultorios es rechazado.
- **Scope**:
  - `POST /api/auth/register` (crea Consultorio + Usuario + Profesional + Sillón por defecto en una transacción; 409 email duplicado), `POST /api/auth/login` (401 credenciales inválidas), refresh según DD-04/PA-10.
  - Spring Security: filtro JWT, roles `ADMIN|PROFESIONAL|RECEPCION`, `@PreAuthorize` por recurso según matriz RBAC, `TenantContext` poblado desde el token.
  - BCrypt/Argon2, rate limiting básico en login, CORS restringido, rutas públicas explícitas.
  - Tests: registro, login, hash, expiración, rol insuficiente, aislamiento por tenant.
- **Dependencias**: `C-02`
- **Zona**: `backend/src/main/java/.../security/`, `.../usuario/`, `.../consultorio/` (registro), `backend/src/test/.../security/`
- **Responsable**: Integrante 3
- **Governance**: CRITICO (auth/seguridad: requiere aprobación humana explícita antes de escribir código)
- **Leer antes**:
  - `knowledge-base/03_actores_y_roles.md` §RBAC
  - `knowledge-base/05_reglas_de_negocio.md` §RN-MT, §RN-DS-05
  - `knowledge-base/07_flujos_principales.md` §Flujo 1
  - `knowledge-base/08_arquitectura_propuesta.md` §Seguridad

---

## FASE 2 — Backend de dominio (5 lanes tras GATE 3)

### [C-04] `consultorio-config-api`
- **Estado**: `[x]` completado, mergeado en PR #7 (merge `98db080`) y archivado en `openspec/changes/archive/2026-11-23-c-04-consultorio-config-api`. Evidencia: backend 370/370 con `./gradlew cleanTest test` (línea base 264; CRUD de los cuatro recursos, duración fuera de grilla, límite y último sillón activo, solapamiento de franjas, bloqueos por sillón/profesional, RBAC por rol, aislamiento A/B y concurrencia con dos hilos); sin migraciones nuevas. Grilla de 15 min provisional, pendiente de validar con un odontólogo (PA-03). Handoff: `knowledge-base/entrega/C-04.md`
- **Resultado**: un odontólogo autenticado administra sillones, prestaciones, horarios y bloqueos vía API, con validaciones.
- **Scope**:
  - CRUD `/api/sillones` (1–2), `/api/prestaciones` (duración múltiplo de la grilla, RN-AG-03), `/api/horarios-atencion`, `/api/bloqueos` (US-002, US-013).
  - DTOs + mappers + Bean Validation; RBAC (RECEPCION solo lectura en sillones, prestaciones y horarios; en bloqueos puede consultar, crear y editar, pero no eliminar — KB 03 y spec `access-control`).
  - Tests: CRUD, duración inválida, bloqueo por sillón/profesional, aislamiento tenant.
- **Dependencias**: `C-03`
- **Zona**: `backend/src/main/java/.../agenda/{sillon,prestacion,horario,bloqueo}/`, `backend/src/test/.../agenda/config/`
- **Responsable**: Integrante 4
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Sillon, §Prestacion, §HorarioAtencion, §BloqueoAgenda
  - `knowledge-base/05_reglas_de_negocio.md` §RN-AG
  - `knowledge-base/06_funcionalidades.md` §US-002, §US-013

### [C-05] `pacientes-api`
- **Estado**: `[x]` completado, verificado a mano contra MySQL 8.4, mergeado en PR #9 (merge `ed348b7`) y archivado en `openspec/changes/archive/2026-11-23-c-05-pacientes-api`. Evidencia: backend 342/342 con `./gradlew test` y 448/448 tras integrar `main` con C-04 (línea base 264; tests de alta, DNI duplicado con otro formato y en carrera, búsqueda por nombre y DNI, E.164 inválido, baja lógica y reactivación, RBAC por rol y aislamiento A/B en todos los endpoints); sin migraciones nuevas. Specs sincronizadas: nueva `patient-management`; actualizada `access-control`. Handoff: `knowledge-base/entrega/C-05.md`
- **Resultado**: ABM de pacientes con búsqueda por nombre/DNI, DNI único por consultorio y baja lógica.
- **Scope**:
  - `/api/pacientes` (alta, edición, baja lógica, búsqueda `?q=`), validación de teléfono E.164 (para wa.me), DNI único (409).
  - RBAC: RECEPCION CRU sobre datos de contacto; sin datos de ficha en este change.
  - Tests: alta, duplicado, búsqueda, E.164 inválido, baja lógica, tenant.
- **Dependencias**: `C-03`
- **Zona**: `backend/src/main/java/.../paciente/`, `backend/src/test/.../paciente/`
- **Responsable**: Integrante 5
- **Governance**: MEDIO (datos personales, no clínicos)
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Paciente
  - `knowledge-base/05_reglas_de_negocio.md` §RN-PA
  - `knowledge-base/06_funcionalidades.md` §US-020

### [C-06] `auditoria-core`
- **Estado**: `[x]` completado, verificado a mano contra MySQL 8.4 (login ok/fallido y `GET /api/auditoria` sin filtros, 2026-11-24), mergeado en PR #11 (merge `5c44412`) y archivado en `openspec/changes/archive/2026-11-24-c-06-auditoria-core`. Evidencia: backend 545/545 con `./gradlew test` (línea base 448; 97 tests nuevos: detalle restringido, contexto usuario/IP, `AuditService` MANDATORY, `buscar` con filtros, aspecto `@Audited` con fail-closed y rollback, LOGIN fallido persistido en servicio y por HTTP, `GET /api/auditoria` con paginado, filtros, RBAC y aislamiento A/B); JaCoCo `auditoria` 94 % y `auditoria.consulta` 100 % de instrucciones; sin migraciones nuevas (única dependencia nueva: `spring-boot-starter-aop`). Specs sincronizadas: actualizadas `audit-log` y `authentication`. Handoff: `knowledge-base/entrega/C-06.md`
- **Resultado**: un servicio/aspecto registra acciones READ/CREATE/UPDATE/DELETE/EXPORT/LOGIN de forma inmutable y es invocable desde otros módulos.
- **Scope**:
  - `AuditService` + aspecto/evento (`@Audited`): usuario, entidad, id, detalle JSON, IP, fecha; tabla insert-only (sin update/delete en el repositorio).
  - Registro de LOGIN desde C-03; `GET /api/auditoria` (solo ADMIN/PROFESIONAL, paginado y filtrado).
  - Tests: insert-only, tenant, acceso denegado a RECEPCION, un fallo de auditoría no rompe silenciosamente la operación.
- **Dependencias**: `C-03`
- **Zona**: `backend/src/main/java/.../auditoria/`, `backend/src/test/.../auditoria/`
- **Responsable**: Integrante 2 (intercambio con C-07 acordado el 2026-11-24)
- **Governance**: CRITICO (audit trail)
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-DS-02, §RN-DS-06
  - `knowledge-base/04_modelo_de_datos.md` §AuditLog
  - `knowledge-base/08_arquitectura_propuesta.md` §Patrones (Auditoría)

### [C-07] `turnos-agenda-engine`
- **Estado**: `[ ]` pendiente
- **Resultado**: crear/confirmar/cancelar/reprogramar/marcar asistencia de turnos sin solapamientos (409), con sobreturno explícito y auditado; test de concurrencia en verde.
- **Scope**:
  - `POST /api/turnos`, `PATCH /api/turnos/{id}/estado`, `PUT /api/turnos/{id}` (reprogramar), `GET /api/turnos?desde&hasta&sillonId` (vista diaria/semanal).
  - Validación transaccional: horario de atención, bloqueos, solapamiento por sillón y por profesional (RN-AG-01..04); lock/constraint auxiliar (DD-06); `es_sobreturno` solo con flag explícito + AuditLog.
  - Máquina de estados `PROGRAMADO|CONFIRMADO|CANCELADO|ASISTIO|AUSENTE` (RN-AG-05..07), duración desde prestación, 409 con turno en conflicto, 422 fuera de horario.
  - Tests (TDD estricto, empezar por dominio puro): solapamiento exacto/parcial/adyacente, sobreturno, transiciones inválidas, reprogramación revalida, concurrencia de dos creaciones simultáneas.
- **Dependencias**: `C-04, C-05, C-06`
- **Zona**: `backend/src/main/java/.../agenda/turno/`, `backend/src/test/.../agenda/turno/`
- **Responsable**: Integrante 3 (intercambio con C-06 acordado el 2026-11-24)
- **Governance**: MEDIO (lógica de agenda; checkpoints)
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-AG
  - `knowledge-base/07_flujos_principales.md` §Flujo 2, §Flujo 4, §Flujo 6
  - `knowledge-base/06_funcionalidades.md` §US-010..US-012
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-06

### [C-08] `ficha-clinica-consentimiento`
- **Estado**: `[x]` completado (verificación técnica en H2, 2026-11-24); pendiente verificación manual contra MySQL 8.4, PR y review de integrante-1/2. Evidencia: backend 623/623 con `./gradlew test` (línea base 545; 78 tests nuevos: regla pura de versión, códigos de error, consultas nuevas con aislamiento A/B, consentimiento con versión inexistente o no vigente, ficha sin/con consentimiento, ficha vacía, CREATE/UPDATE con `version`, carreras de guardado y de primera carga, notas con profesional vinculado, inmutables y paginadas, RECEPCION 403 en los 7 endpoints, aislamiento A/B, fail-closed sin mocks, reflexión "ningún `@Audited` readOnly" y logs sin datos de salud); JaCoCo `paciente.ficha` 99 % de instrucciones; sin migraciones ni dependencias nuevas; `agenda/` sin cambios. Spec nueva: `clinical-record` (change `openspec/changes/c-08-ficha-clinica-consentimiento`). Handoff: `knowledge-base/entrega/C-08.md`
- **Resultado**: ficha/anamnesis y notas solo editables con consentimiento registrado; cada lectura y escritura queda en AuditLog; RECEPCION sin acceso.
- **Scope**:
  - `/api/pacientes/{id}/ficha` (GET/PUT), `/api/pacientes/{id}/notas` (POST/GET), `/api/pacientes/{id}/consentimientos` (POST; versión de texto, aceptado_en, registrado_por).
  - Regla: sin consentimiento → 409/422 (RN-PA-04); política de notas según PA-08 (adenda; supuesto a confirmar).
  - RBAC: solo ADMIN/PROFESIONAL (PA-07, supuesto: RECEPCION sin acceso clínico); auditoría en cada acceso vía C-06.
  - Tests: sin consentimiento, con consentimiento, RECEPCION 403, auditoría de READ y UPDATE, tenant.
- **Dependencias**: `C-05, C-06`
- **Zona**: `backend/src/main/java/.../paciente/ficha/`, `backend/src/test/.../paciente/ficha/`
- **Responsable**: Integrante 5
- **Governance**: ALTO (datos de salud sensibles; proponer y esperar revisión antes de escribir)
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §FichaClinica, §NotaClinica, §ConsentimientoDatos
  - `knowledge-base/05_reglas_de_negocio.md` §RN-DS, §RN-PA-04
  - `knowledge-base/07_flujos_principales.md` §Flujo 5
  - `knowledge-base/10_preguntas_abiertas.md` §PA-07, §PA-08

### [C-09] `recordatorios-whatsapp-email`
- **Estado**: `[ ]` pendiente
- **Resultado**: el endpoint devuelve un enlace `wa.me` válido y registra Recordatorio `GENERADO`; el email se envía por SMTP con manejo de error.
- **Scope**:
  - `GET /api/turnos/{id}/recordatorio/whatsapp` → `https://wa.me/<E164>?text=<mensaje codificado>`; paciente sin teléfono → error controlado (RN-CO-03).
  - `POST /api/turnos/{id}/recordatorio/email` (SMTP, `SMTP_*` por env); estado `ENVIADO|ERROR` + `detalle_error`; `GET /api/turnos/pendientes-recordatorio?fecha=`.
  - Plantilla de mensaje simple; sin datos clínicos en el mensaje.
  - Tests: codificación del texto, E.164, sin teléfono, SMTP caído (mock), registro del recordatorio.
- **Dependencias**: `C-07`
- **Zona**: `backend/src/main/java/.../recordatorio/`, `backend/src/test/.../recordatorio/`
- **Responsable**: Integrante 4
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-CO
  - `knowledge-base/07_flujos_principales.md` §Flujo 3
  - `knowledge-base/06_funcionalidades.md` §US-030, §US-031

---

## FASE 3 — Frontend (TypeScript vanilla)

> Riesgo XSS por ausencia de framework: prohibido `innerHTML` con datos de usuario en TODOS los changes de esta fase.

### [C-10] `frontend-shell-auth`
- **Estado**: `[x]` completado (cerrado por la persona el 2026-11-23 con el alcance implementado) — mergeado en PR #5 (merge `7814294`) y archivado en `openspec/changes/archive/2026-11-23-c-10-frontend-shell-auth`: `npm test` 210/210 (línea base 9), lint/typecheck/build limpios, sin cambios en `backend/` ni migraciones. Verificación manual contra la API real **parcial** (backend + MySQL 8 en Docker, health `UP`, CORS desde `:5173` OK; registro y login probados por la persona; no se completaron vencimiento ni 429). Recuperación de contraseña: fuera de alcance, propuesta como ficha nueva. Handoff: `knowledge-base/entrega/C-10.md`
- **Resultado**: login/registro funcionales contra la API, rutas protegidas y cierre de sesión; cliente HTTP tipado reutilizable.
- **Scope**:
  - `src/api/` cliente HTTP tipado (manejo 401/403/409/422, token según DD-04), `src/state/` sesión, router simple con guard, layout base.
  - Páginas `login` y `registro`; utilidades de escape/DOM seguro en `src/utils/`.
  - Tests Vitest: cliente (errores, headers), guard, render sin `innerHTML` con input de usuario. Arranca con mocks del contrato OpenAPI; integra al llegar C-03.
- **Dependencias**: `C-01, C-03`
- **Zona**: `frontend/src/api/`, `frontend/src/state/`, `frontend/src/utils/`, `frontend/src/pages/login/`, `frontend/src/components/` (base)
- **Responsable**: Integrante 1
- **Governance**: MEDIO (manejo de token en cliente)
- **Leer antes**:
  - `knowledge-base/08_arquitectura_propuesta.md` §Patrones, §Seguridad
  - `knowledge-base/07_flujos_principales.md` §Flujo 1
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-04

### [C-11] `frontend-config`
- **Estado**: `[x]` completado (2026-11-24) en la rama `c-11-frontend-config`: `npm test` 393/393 en 25 archivos (línea base 210; 183 tests nuevos), `npm run lint`, `npm run typecheck` y `npm run build` limpios; sin cambios en `backend/` ni migraciones. V-D7 (reactivación por `PUT activo:true`) verificado en el backend con un IT temporal 3/3 en `gradle:8.14-jdk21`, no versionado (IT permanente pendiente para C-04). Verificación manual en el navegador contra la API real por la persona con roles ADMIN y RECEPCION: OK. Handoff: `knowledge-base/entrega/C-11.md`
- **Resultado**: pantallas para gestionar sillones, prestaciones, horarios y bloqueos.
- **Scope**:
  - `src/pages/config/` con formularios CRUD de sillones, prestaciones (duración), horarios de atención y bloqueos.
  - Validaciones de formulario; mensajes de error de la API.
  - Tests Vitest de formularios y cliente.
- **Dependencias**: `C-10, C-04`
- **Zona**: `frontend/src/pages/config/`
- **Responsable**: Integrante 4
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-002, §US-013
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios

### [C-12] `frontend-pacientes-ficha`
- **Estado**: `[ ]` pendiente
- **Resultado**: ABM y búsqueda de pacientes; ficha con consentimiento, anamnesis y notas.
- **Scope**:
  - `src/pages/pacientes/` (lista, búsqueda por nombre/DNI, alta/edición/baja) y `src/pages/ficha/` (consentimiento, anamnesis, notas).
  - Bloqueo visual de ficha sin consentimiento; vista oculta al rol RECEPCION.
  - Tests Vitest: formularios, flujo de consentimiento, escape de contenido clínico.
- **Dependencias**: `C-10, C-05, C-08`
- **Zona**: `frontend/src/pages/pacientes/`, `frontend/src/pages/ficha/`
- **Responsable**: Integrante 5
- **Governance**: ALTO (renderiza datos de salud)
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-020, §US-021
  - `knowledge-base/05_reglas_de_negocio.md` §RN-DS
  - `knowledge-base/07_flujos_principales.md` §Flujo 5

### [C-13] `frontend-agenda`
- **Estado**: `[ ]` pendiente
- **Resultado**: vista diaria/semanal por sillón con colores por estado; crear, mover, cancelar y confirmar turnos con feedback de conflictos.
- **Scope**:
  - `src/pages/agenda/` (grilla diaria/semanal, filtro por sillón, color por estado), modal de turno (paciente, prestación, sillón, horario), manejo de 409/422, sobreturno explícito con confirmación.
  - Acciones de estado: confirmar, cancelar (motivo), reprogramar, asistió/ausente.
  - Tests Vitest: render de grilla, posición por duración, manejo de conflicto.
- **Dependencias**: `C-10, C-07`
- **Zona**: `frontend/src/pages/agenda/`, `frontend/src/components/agenda/`
- **Responsable**: Integrante 1
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-010..US-012
  - `knowledge-base/07_flujos_principales.md` §Flujo 2, §Flujo 4
  - `knowledge-base/05_reglas_de_negocio.md` §RN-AG

### [C-14] `frontend-recordatorios`
- **Estado**: `[ ]` pendiente
- **Resultado**: botón "Recordar por WhatsApp" abre `wa.me`; opción de email; lista de turnos de mañana sin recordatorio.
- **Scope**:
  - `src/pages/recordatorios/` y botones en el turno: abre el enlace `wa.me` en pestaña nueva, deshabilitado y con aviso si no hay teléfono; envío de email con estado/errores.
  - Marcar turno `CONFIRMADO`/cancelar según la respuesta del paciente.
  - Tests Vitest: botón deshabilitado, apertura del enlace, error de email.
- **Dependencias**: `C-13, C-09`
- **Zona**: `frontend/src/pages/recordatorios/`, `frontend/src/components/agenda/` (acciones)
- **Responsable**: Integrante 1
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-030, §US-031
  - `knowledge-base/07_flujos_principales.md` §Flujo 3

---

## FASE 4 — Cumplimiento y entrega

### [C-15] `auditoria-export-ui`
- **Estado**: `[ ]` pendiente
- **Resultado**: pantalla de log de accesos y exportación JSON de los datos de un paciente, registrando `EXPORT`.
- **Scope**:
  - `GET /api/pacientes/{id}/export` (datos, ficha, turnos, notas; solo ADMIN/PROFESIONAL), `EXPORT` en AuditLog (US-040).
  - `frontend/src/pages/auditoria/`: tabla paginada con filtros; botón exportar en la ficha.
  - Tests: RECEPCION 403, contenido del export, registro de auditoría, tenant.
- **Dependencias**: `C-06, C-07, C-08, C-10`
- **Zona**: `backend/src/main/java/.../auditoria/export/`, `backend/src/main/java/.../paciente/export/`, `frontend/src/pages/auditoria/`
- **Responsable**: Integrante 3
- **Governance**: CRITICO (exportación de datos de salud + audit)
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-040
  - `knowledge-base/07_flujos_principales.md` §Flujo 7
  - `knowledge-base/05_reglas_de_negocio.md` §RN-DS-02, §RN-DS-06

### [C-16] `entrega-hardening-demo`
- **Estado**: `[ ]` pendiente
- **Resultado**: `docker compose up` + seed deja una demo reproducible del flujo completo; checklist de seguridad y smoke E2E en verde.
- **Scope**:
  - Smoke E2E: registro → configurar → paciente + consentimiento → turno (con conflicto 409) → recordatorio wa.me → auditoría/export.
  - Checklist de seguridad (CORS, secretos fuera del repo, sin `innerHTML`, 403 entre tenants), README de ejecución, datos demo, guion de demo.
  - Corrección de bugs de integración; sin features nuevas.
- **Dependencias**: `C-09, C-11, C-12, C-14, C-15`
- **Zona**: `docker-compose.yml`, `README.md`, `backend/src/main/resources/` (seed dev), `docs/` (guion de demo), transversal
- **Responsable**: Integrante 2
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/08_arquitectura_propuesta.md` §Despliegue, §Seguridad
  - `knowledge-base/10_preguntas_abiertas.md` §R-01, §PA-01, §PA-09
  - `knowledge-base/07_flujos_principales.md`

---

## FASE 5 — Post-entrega (NO entran en el 25/11)

> Sin responsable ni plazo; planificar tras validar con odontólogos (PA-03).

### [C-17] `lista-espera`
- **Estado**: `[ ]` pendiente
- **Resultado**: los huecos liberados se ofrecen a pacientes en lista de espera.
- **Scope**: tabla `lista_espera` (migración posterior), `/api/lista-espera`, sugerencia de reasignación al cancelar (Flujo 4), UI. Tests de matching por prestación/franja.
- **Dependencias**: `C-07`
- **Zona**: `backend/src/main/java/.../agenda/listaespera/`, `frontend/src/pages/lista-espera/`
- **Responsable**: por asignar
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-050
  - `knowledge-base/07_flujos_principales.md` §Flujo 4

### [C-18] `reserva-online-publica`
- **Estado**: `[ ]` pendiente
- **Resultado**: el paciente reserva/confirma/cancela por enlace público con token firmado de un solo uso.
- **Scope**: endpoints públicos `/api/public/...`, tokens firmados por turno, rate limiting, página pública de reserva y confirmación. Tests de expiración/reuso del token.
- **Dependencias**: `C-07, C-09`
- **Zona**: `backend/src/main/java/.../publico/`, `frontend/src/pages/public/`
- **Responsable**: por asignar
- **Governance**: CRITICO (superficie pública no autenticada)
- **Leer antes**:
  - `knowledge-base/03_actores_y_roles.md` §Rutas públicas
  - `knowledge-base/06_funcionalidades.md` §US-051
  - `knowledge-base/08_arquitectura_propuesta.md` §Seguridad

### [C-19] `sena-mercadopago`
- **Estado**: `[ ]` pendiente
- **Resultado**: cobro de seña vía Mercado Pago (sandbox primero) con webhook y estado de pago en el turno.
- **Scope**: entidad `cobro`, preferencia de pago, webhook verificado, política de seña configurable. Tests con sandbox/mock.
- **Dependencias**: `C-18`
- **Zona**: `backend/src/main/java/.../cobro/`, `frontend/src/pages/public/` (pago)
- **Responsable**: por asignar
- **Governance**: CRITICO (pagos)
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-052
  - `knowledge-base/05_reglas_de_negocio.md`

### [C-20] `recall-ausentes`
- **Estado**: `[ ]` pendiente
- **Resultado**: listado de ausentes y recall de pacientes con métricas de ausentismo.
- **Scope**: consultas sobre turnos `AUSENTE`, recordatorio de recall, reporte de ocupación/ausentismo.
- **Dependencias**: `C-17`
- **Zona**: `backend/src/main/java/.../recordatorio/recall/`, `frontend/src/pages/reportes/`
- **Responsable**: por asignar
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-053
  - `knowledge-base/07_flujos_principales.md` §Flujo 6

### [C-21] `clinica-avanzada`
- **Estado**: `[ ]` pendiente
- **Resultado**: odontograma FDI, periodontograma y presupuestos/planes de tratamiento.
- **Scope**: entidades `odontograma`, `presupuesto`, UI interactiva, auditoría de cambios.
- **Dependencias**: `C-08`
- **Zona**: `backend/src/main/java/.../paciente/odontograma/`, `.../presupuesto/`, `frontend/src/pages/odontograma/`
- **Responsable**: por asignar
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 7
  - `knowledge-base/04_modelo_de_datos.md` §Posterior

### [C-22] `obras-sociales-arca`
- **Estado**: `[ ]` pendiente
- **Resultado**: obras sociales estructuradas y facturación ARCA (etapa 3).
- **Scope**: catálogo de obras sociales, vínculo con paciente/turno, facturación ARCA; depende de PA-13.
- **Dependencias**: `C-05, C-07`
- **Zona**: `backend/src/main/java/.../obrasocial/`, `.../facturacion/`
- **Responsable**: por asignar
- **Governance**: CRITICO (facturación fiscal)
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 7
  - `knowledge-base/10_preguntas_abiertas.md` §PA-13

---

## Resumen

| ID | Change | Fase | Governance | Responsable | Entrega 25/11 |
|----|--------|------|------------|-------------|---------------|
| C-01 | project-setup | 1 | BAJO | Integrante 1 | MVP |
| C-02 | core-data-model | 1 | CRITICO | Integrante 2 | MVP |
| C-03 | auth-jwt-rbac | 1 | CRITICO | Integrante 3 | MVP |
| C-04 | consultorio-config-api | 2 | BAJO | Integrante 4 | MVP |
| C-05 | pacientes-api | 2 | MEDIO | Integrante 5 | MVP |
| C-06 | auditoria-core | 2 | CRITICO | Integrante 2 | MVP |
| C-07 | turnos-agenda-engine | 2 | MEDIO | Integrante 3 | MVP |
| C-08 | ficha-clinica-consentimiento | 2 | ALTO | Integrante 5 | MVP |
| C-09 | recordatorios-whatsapp-email | 2 | MEDIO | Integrante 4 | MVP |
| C-10 | frontend-shell-auth | 3 | MEDIO | Integrante 1 | MVP |
| C-11 | frontend-config | 3 | BAJO | Integrante 4 | MVP |
| C-12 | frontend-pacientes-ficha | 3 | ALTO | Integrante 5 | MVP |
| C-13 | frontend-agenda | 3 | MEDIO | Integrante 1 | MVP |
| C-14 | frontend-recordatorios | 3 | BAJO | Integrante 1 | MVP |
| C-15 | auditoria-export-ui | 4 | CRITICO | Integrante 3 | MVP |
| C-16 | entrega-hardening-demo | 4 | MEDIO | Integrante 2 | MVP |
| C-17..C-22 | lista-espera, reserva-online-publica, sena-mercadopago, recall-ausentes, clinica-avanzada, obras-sociales-arca | 5 | varios | por asignar | Post |

**Primer item elegible**: `C-01` (`project-setup`).
