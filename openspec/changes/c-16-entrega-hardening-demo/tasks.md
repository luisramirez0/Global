# Tasks

> Prioridad aprobada por la responsable (2026-11-25): **P1 completo primero**; de P2, solo lo que no pueda romper la
> demo; P3 para cerrar. Sin features nuevas. Regla 9: no se levanta el stack (`docker compose up`/`down` los corre la
> persona); los tests sí se corren. Los cambios de código siguen TDD (RED → GREEN). `openspec validate --strict`
> queda pendiente para alguien con el CLI (no está instalado en esta máquina).

## 0. Línea base

- [x] 0.1 `main` limpio y al día (`e703329`); rama `c-16-entrega-hardening-demo`. Frontend: `npm test` 1987/1987 (84
  archivos), lint y typecheck limpios. Backend: 955 tests en un contenedor `gradle:8.14-jdk21` (la máquina solo tiene
  JDK 26); la única falla (`DevAdminPropertiesTest`) fue un artefacto de la copia sin `.env.example`, y con el archivo
  presente pasa.

## 1. P1: README y datos demo

- [x] 1.1 `README.md` en la raíz: requisitos, `.env`, `docker compose`, datos demo, smoke, tests, `bootRun` con perfil
  explícito y problemas conocidos del entorno Windows.
- [x] 1.2 `scripts/lib/api.sh` (curl + node): `api`, `header`, `json`, `json_str`, fechas en hora de Argentina,
  `login`, `registrar`, `set_rol`. Cuerpos desde un archivo (acentos). Probados offline (fechas, rutas JSON, headers,
  escapes, API caída → `000`).
- [x] 1.3 `scripts/demo-seed.sh`: consultorio demo (ADMIN + profesional + 2 sillones), 4 prestaciones, horario todos
  los días, bloqueo, 5 pacientes ficticios (sin teléfono, sin email, XSS), consentimiento + anamnesis + nota de María,
  5 turnos mañana + 1 hoy; RECEPCION opcional (`DEMO_RECEPCION=1`); se detiene con `409`. `bash -n` OK.
- [x] 1.4 `scripts/lib/api.ps1` + `scripts/demo-seed.ps1` (HttpClient, ASCII puro, `%uXXXX`). Sin errores del parser
  de PowerShell, 0 bytes no ASCII, helpers probados.
- [ ] 1.5 **Persona**: `docker compose down -v && docker compose up --build -d` y correr `demo-seed` (sh o ps1).
  Anotar el resultado en `knowledge-base/entrega/C-16.md`.

## 2. P1: smoke E2E

- [x] 2.1 `scripts/smoke-e2e.sh`: infraestructura (health, frontend, headers, CORS permitido/ajeno, `Retry-After`
  expuesto), Flujo 1 (`201`/`409`/`401`/`200`, ADMIN), configuración (grilla `400`), paciente (DNI duplicado `409`
  con `pacienteId`), ficha (`409 CONSENTIMIENTO_REQUERIDO` → consentimiento → anamnesis → nota), Flujo 2 (`201`,
  `409 SILLON` con `turnoId`, `422` fuera de horario), Flujo 3 (pendientes, `wa.me`, deja de estar pendiente, email
  `201|502|503`, confirmar), Flujo 7 (export con `Content-Disposition` y `no-store`, una fila `EXPORT`, ficha auditada),
  aislamiento A/B (`404` × 4, auditoría vacía), `401` sin token y con token adulterado; RECEPCION `403` × 3 con
  `SMOKE_DB=1`. Código de salida = fallas. `bash -n` OK.
- [x] 2.2 `scripts/smoke-e2e.ps1` con los mismos pasos. Sin errores del parser, ASCII puro.
- [ ] 2.3 **Persona**: correr el smoke (sh y/o ps1, también con `SMOKE_DB=1`) contra el stack de 1.5 y anotar el
  resultado. Si algún paso falla por el script (no por la app), corregirlo antes de la demo.

## 3. P1: guion y bugs de integración

- [x] 3.1 `docs/demo.md`: guion corto (8 a 10 minutos) sobre los Flujos 1, 2, 3, 5 y 7, con RBAC, XSS y plan B.
- [x] 3.2 RED: `CorsPolicyIT` (`retryAfterIsExposedToAnAllowedOrigin`, `onlyRetryAfterIsExposed`,
  `crossOrigin429CarriesRetryAfterReadableByTheBrowser` fallan con el header `null`; `foreignOriginGetsNoExposedHeaders`
  como guarda). GREEN: `CorsConfig.setExposedHeaders(["Retry-After"])` → 11/11.
- [x] 3.3 Export en la ficha: **fuera de C-16** por decisión de la responsable → `docs/bugs-conocidos.md` B-01.

## 4. P2: hardening que no rompe la demo

- [x] 4.1 Verificado antes del cambio: `docker-compose.yml` fija `SPRING_PROFILES_ACTIVE: dev` y `build.gradle` fija
  `test`. RED: `ProfileDefaultsTest` falla con el `application.yml` anterior. GREEN: se quitó `spring.profiles.default`.
- [x] 4.2 MySQL publicado en `127.0.0.1:3306` (`docker compose config` lo confirma).
- [x] 4.3 `frontend/nginx/security-headers.conf` + `Dockerfile`: `nosniff`, `DENY`, `no-referrer`, `server_tokens off`.
  `nginx -t` OK y `curl` a un contenedor `nginx:alpine` temporal muestra los headers en `200` y `404`.
- [x] 4.4 `docs/checklist-seguridad.md` con la evidencia por control (tests citados verificados que existen; greps de
  `innerHTML`/`any`/secretos/`nativeQuery`).
- [x] 4.5 Descartado (podría romper la demo) y documentado: CSP (D-02) y el healthcheck de MySQL con la contraseña (D-05).
- [x] 4.6 `GRANT` sobre `audit_log`: **deuda** (D-01) por decisión de la responsable; no se implementa.

## 5. P3: cierre

- [x] 5.1 `docs/bugs-conocidos.md` (corregidos en C-16, integración, seguridad, calidad y decisiones abiertas).
- [x] 5.2 `docs/verificacion-manual.md`: pendientes de C-09..C-15 en una sola tabla, marcando lo que cubre el smoke.
- [x] 5.3 Suites finales: backend y frontend (ver el handoff), `docker compose config --services` OK,
  `git diff main -- backend/src/main/resources/db frontend/src` vacío.
- [x] 5.4 `knowledge-base/entrega/C-16.md` y estado de `CHANGES.md` §C-16.
- [ ] 5.5 **Pendiente (CLI)**: `openspec validate c-16-entrega-hardening-demo --strict`.
- [ ] 5.6 **Persona**: ensayo de la demo con `docs/verificacion-manual.md`; con todo OK, marcar `[x]` en `CHANGES.md` §C-16.
- [ ] 5.7 Commit, PR (con aviso a integrante-1/2 por `CorsConfig` y el perfil) y archivo del change: solo con
  autorización de la persona.
