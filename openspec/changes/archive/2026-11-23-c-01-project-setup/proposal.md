# Proposal

## Why

El repositorio tiene solo documentación (KB, CHANGES.md, OpenSpec) y ningún código: no hay backend, frontend ni entorno local, por lo que ninguna otra ficha (C-02..C-16) puede empezar. C-01 es GATE 0 del camino crítico y la entrega es el 25/11/2026, así que el esqueleto debe quedar listo, verificable con tests y reproducible para los 5 integrantes cuanto antes.

## What Changes

- **Backend** `backend/`: proyecto Spring Boot 3 (Gradle, Java 17) con starters Web, Data JPA, Validation, Security, Flyway, driver MySQL y H2 para tests; paquete base `ar.global.odonto` con `config/`, `security/`, `common/` y paquetes de dominio vacíos (`consultorio`, `usuario`, `paciente`, `agenda`, `recordatorio`, `auditoria`); perfiles `dev` (MySQL) y `test` (H2 `MODE=MySQL` + Flyway).
- **Endpoint de salud** público `GET /api/health` que responde `{"status":"UP"}`, usado como test de humo y por Docker Compose.
- **Línea base de seguridad**: `SecurityFilterChain` stateless que deniega por defecto todo lo que no sea público (solo `/api/health` y preflight CORS); la autenticación real llega en C-03.
- **CORS restringido** a los orígenes de `CORS_ALLOWED_ORIGINS`; un origen no listado es rechazado.
- **Configuración por variables de entorno** (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MIN`, `SMTP_*`, `APP_BASE_URL`, `CORS_ALLOWED_ORIGINS`) con `.env.example` sin valores reales.
- **Frontend** `frontend/`: TypeScript vanilla estricto con Vite + Vitest (jsdom) + ESLint (prohíbe `any`), estructura `src/api pages components state utils`, `index.html` y un arranque mínimo que monta la app sin `innerHTML`.
- **Entorno local**: `docker-compose.yml` (MySQL 8 + backend + frontend estático en nginx), Dockerfiles multi-stage, `.gitignore` ampliado y `scripts/test.sh` que corre `./gradlew test` y `npm test`.
- **Documentación**: se registra la decisión de paquete base y tooling (DD-10 en KB 09) y se actualiza el comentario de `.github/CODEOWNERS`.

## Capabilities

### New Capabilities
- `service-health`: endpoint público de salud del backend para humo, monitoreo local y healthcheck de Compose.
- `api-cors-policy`: política CORS restringida a orígenes configurados y acceso denegado por defecto a rutas no públicas.
- `runtime-configuration`: configuración del backend por variables de entorno con perfiles `dev`/`test`, sin secretos en el repositorio.
- `frontend-bootstrap`: arranque del frontend TypeScript (montaje de la app y resolución de la URL base de la API).

### Modified Capabilities
<!-- Ninguna: no existen specs previas en openspec/specs/. -->

## Impact

- **Código nuevo**: `backend/`, `frontend/`, `docker-compose.yml`, `.env.example`, `scripts/test.sh`.
- **Archivos modificados**: `.gitignore` (se agregan artefactos de build, `node_modules`, `.env`; se preservan los bloques existentes), `.github/CODEOWNERS` (solo comentario del paquete base), `knowledge-base/09_decisiones_y_supuestos.md` (DD-10), `CHANGES.md` (marcar C-01 al verificar).
- **Dependencias** (todas gratuitas/OSS): Spring Boot 3.5.x, Flyway, MySQL Connector/J, H2, Vite, Vitest, jsdom, TypeScript 5, ESLint + typescript-eslint. Imágenes Docker: `mysql:8.4`, `eclipse-temurin:17`, `node:22-alpine`, `nginx:alpine`.
- **Sin APIs de negocio**: no se crean entidades, migraciones ni auth (C-02/C-03).
- **Fuera de alcance**: entidades/migraciones (C-02), login/JWT/RBAC (C-03), UI real (C-10), hosting (PA-09), CI.
- **Riesgo**: la línea base de seguridad toca la zona `security/` (regla 12): se avisa a los reviewers en el PR aunque la ficha sea governance BAJO.
