# Proposal

## Why

C-01..C-15 están mergeados en `main`, pero la entrega del 25/11/2026 no es reproducible por alguien que no sea quien
la armó: no hay README de ejecución, el seed de desarrollo no alcanza para mostrar los flujos (no crea profesional,
horarios, pacientes ni turnos), no hay un smoke contra el stack real y varias verificaciones manuales quedaron
pendientes en los handoffs (C-09 nunca se verificó contra MySQL). Además, la revisión encontró un bug de integración
visible (la SPA no puede leer `Retry-After` del `429` porque CORS no lo expone) y dos puntos de hardening de bajo
riesgo (perfil `dev` por defecto y MySQL publicado en todas las interfaces). C-16 cierra el MVP (KB 01) y el camino
crítico (C-14 → C-16), con R-01 (plazo) en mente: solo hardening e integración, **sin features nuevas**.

Supuesto PA-01 (decisión de la responsable, 2026-11-25): la entrega es código + demo; el guion queda corto y se
ajusta después.

## What Changes

- **README** de ejecución en la raíz: requisitos, `.env`, `docker compose`, datos demo, smoke, tests y problemas
  conocidos del entorno Windows.
- **Datos demo** por la API real: `scripts/demo-seed.sh` (Git Bash) y `scripts/demo-seed.ps1` (PowerShell), con datos
  ficticios y sin depender de WSL. Cambio de rol a `RECEPCION` opcional por `docker compose exec` (no hay ABM de usuarios).
- **Smoke E2E** contra el stack levantado: `scripts/smoke-e2e.sh` y `.ps1` (registro → configuración → paciente con
  consentimiento → turno con `409` → `wa.me` → export → auditoría → aislamiento `404` → `401`, y opcionalmente
  RECEPCION `403`). Lo ejecuta la persona (regla 9).
- **Guion de demo** corto (`docs/demo.md`), **checklist de seguridad** con evidencia (`docs/checklist-seguridad.md`),
  **bugs conocidos y deuda** (`docs/bugs-conocidos.md`) y **verificaciones manuales pendientes** consolidadas
  (`docs/verificacion-manual.md`).
- **Bug de integración**: CORS expone `Retry-After` (`CorsConfig`).
- **Hardening de bajo riesgo**: sin `spring.profiles.default` (compose ya fija `dev`); MySQL publicado solo en
  `127.0.0.1`; headers de seguridad en el nginx del frontend (sin CSP).
- Fuera de alcance por decisión de la responsable: `GRANT` sobre `audit_log` (deuda D-01) y el export dentro de la
  ficha (B-01). Ninguna migración, dependencia ni servicio pago; nada de C-17..C-22.

## Capabilities

### New Capabilities
- `delivery-demo`: demo reproducible de la entrega (instrucciones de ejecución, datos demo por la API, smoke E2E
  contra el stack real y documentación de seguridad y de límites conocidos).

### Modified Capabilities
- `api-cors-policy`: la política CORS expone `Retry-After` a los orígenes permitidos.
- `runtime-configuration`: el backend no declara perfil por defecto; Compose fija `dev` y publica MySQL solo en
  `127.0.0.1`; el frontend estático sirve headers de seguridad.

## Impact

- Código: `backend/src/main/java/ar/global/odonto/config/CorsConfig.java`, `backend/src/main/resources/application.yml`,
  `docker-compose.yml`, `frontend/Dockerfile`, `frontend/nginx/security-headers.conf` (nuevo). Tests:
  `CorsPolicyIT` (ampliado), `ProfileDefaultsTest` (nuevo).
- Scripts y docs nuevos: `scripts/lib/api.{sh,ps1}`, `scripts/demo-seed.{sh,ps1}`, `scripts/smoke-e2e.{sh,ps1}`,
  `README.md`, `docs/*.md`, `knowledge-base/entrega/C-16.md`.
- **Zonas de riesgo (regla 12)**: `CorsConfig` (seguridad) y el perfil por defecto (credenciales del seed de
  desarrollo). Aviso a integrante-1/2 en el PR. No se tocan auth/JWT/RBAC, auditoría, consentimiento ni export.
- Efecto operativo: `./gradlew bootRun` sin `SPRING_PROFILES_ACTIVE` ya no arranca en `dev` (documentado en el README).
