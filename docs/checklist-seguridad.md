# Checklist de seguridad de la entrega (C-16)

Estado al 2026-11-25, en la rama `c-16-entrega-hardening-demo`. Cada punto lleva su evidencia: un test automático,
un comando que cualquiera puede repetir, o un paso del smoke (`scripts/smoke-e2e.sh`). Lo que **no** está cubierto
figura como deuda en [bugs-conocidos.md](bugs-conocidos.md).

Leyenda: ✅ cumplido con evidencia · 🟡 cumplido con una limitación conocida · ❌ deuda documentada.

## Red y CORS

| # | Control | Estado | Evidencia |
|---|---|---|---|
| S1 | CORS solo para los orígenes de `CORS_ALLOWED_ORIGINS`, nunca `*`, sin credenciales | ✅ | `CorsConfig` (sin `"*"`; `allowCredentials=false`); `CorsPolicyIT` (origen ajeno → `403` sin `Access-Control-Allow-Origin`); smoke: "preflight CORS desde un origen no permitido". |
| S2 | La SPA puede leer `Retry-After` del `429` del login | ✅ (C-16) | `CorsConfig.EXPOSED_HEADERS = [Retry-After]`; `CorsPolicyIT.crossOrigin429CarriesRetryAfterReadableByTheBrowser` y `onlyRetryAfterIsExposed`; smoke: "CORS expone Retry-After". |
| S3 | MySQL no expuesto a la red | ✅ (C-16) | `docker-compose.yml`: `127.0.0.1:3306:3306`. |
| S4 | Headers de seguridad en el frontend | 🟡 (C-16) | `frontend/nginx/security-headers.conf`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `server_tokens off`. Validado con `nginx -t` y `curl` en un contenedor `nginx:alpine` temporal. **Sin CSP** (ver bugs-conocidos). Smoke: "frontend con X-Content-Type-Options". |
| S5 | HTTPS | ❌ | La demo es local (`http://localhost`). En producción haría falta un proxy TLS (PA-06/PA-09). |

## Autenticación y autorización

| # | Control | Estado | Evidencia |
|---|---|---|---|
| A1 | Deny-by-default: todo lo no público exige JWT | ✅ | `SecurityConfig`; `SecurityDefaultDenyIT`, `SecurityRoutesIT`; smoke: "sin token → 401", "token adulterado → 401". |
| A2 | `JWT_SECRET` obligatorio y de 32 bytes o más | ✅ | `JwtSecretValidationTest` (el arranque falla sin el secreto o con uno corto, sin imprimirlo). |
| A3 | Contraseñas con BCrypt (12) y límite de 72 bytes | ✅ | `PasswordConfig`; `MaxUtf8Bytes`. |
| A4 | Rate limit de login (5 fallos en 15 min por IP+email) | 🟡 | `LoginRateLimiterTest`, `LoginControllerIT`. Está en memoria y no frena el *spraying* desde una IP (riesgo aceptado en C-03). |
| A5 | RBAC: RECEPCION sin ficha clínica, sin export y sin auditoría | ✅ | `RbacIT`, `FichaRbacIT`, `PacienteRbacIT`, `TurnoRbacIT`, `AgendaConfigRbacIT`, `AuditoriaRbacIT`, `RecordatorioRbacIT`; `PacienteExportSeguridadIT`; smoke con `SMOKE_DB=1`: tres `403`. |
| A6 | Sin perfil `dev` por accidente (seed y credenciales de desarrollo) | ✅ (C-16) | `application.yml` sin `spring.profiles.default`; `ProfileDefaultsTest` (falla con el `application.yml` anterior). Compose fija `SPRING_PROFILES_ACTIVE: dev`. |
| A7 | Revocación de tokens o logout del lado servidor | ❌ | Un token vale hasta 30 minutos aunque se cierre sesión (riesgo aceptado en C-03 y C-10). |

## Multi-tenant (`consultorio_id`)

| # | Control | Estado | Evidencia |
|---|---|---|---|
| T1 | Filtro de tenant centralizado y *fail-closed* | ✅ | `TenantIdentifierResolver`, `TenantContext`; `TenantIsolationSuiteTest` (13 repositorios), `TenantContextAfterStartupIT`. |
| T2 | Un consultorio no ve datos de otro (`404`, no `403`, para no revelar existencia) | ✅ | `AuthTenantIsolationIT`, `PacienteTenantIsolationIT`, `FichaTenantIsolationIT`, `TurnoTenantIsolationIT`, `AgendaConfigTenantIsolationIT`, `AuditoriaTenantIsolationIT`, `RecordatorioTenantIsolationIT`; smoke: "B no ve el paciente/ficha/turno/export/auditoría de A". |

> La ficha de C-16 decía "403 entre tenants". El comportamiento implementado y probado desde C-05 es **`404`**
> (otro consultorio = inexistente): no revela que el recurso existe. El smoke lo verifica así.

## Datos de salud y auditoría

| # | Control | Estado | Evidencia |
|---|---|---|---|
| D1 | Todo acceso a ficha, notas, consentimiento y export queda en `audit_log` (RN-DS-02) | ✅ | `FichaControllerIT`, `NotaControllerIT`, `ConsentimientoControllerIT`, `PacienteExportIT`; smoke: "una fila EXPORT", "ficha auditada". |
| D2 | Auditoría *fail-closed* (si no se puede auditar, la operación falla) | ✅ | `AuditoriaFailClosedHttpIT`, `FichaFailClosedIT`, `PacienteExportSeguridadIT`. |
| D3 | `audit_log` inmutable desde la aplicación | 🟡 | `AuditLogStatementInspector` rechaza `UPDATE`/`DELETE` vía Hibernate (`AuditLogImmutabilityIT`). **Falta** el guard real por permisos de MySQL (deuda D-01 en bugs-conocidos). |
| D4 | Consentimiento previo a la ficha clínica | ✅ | `FichaControllerIT` (`409 CONSENTIMIENTO_REQUERIDO`); smoke: "ficha sin consentimiento". |
| D5 | Export solo para ADMIN y PROFESIONAL, sin caché | ✅ | `PacienteExportSeguridadIT`; smoke: `Cache-Control: no-store`. |

## Frontend (XSS y almacenamiento)

| # | Control | Estado | Evidencia |
|---|---|---|---|
| F1 | Sin `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` con datos | ✅ | Regla de ESLint (`npm run lint`); `grep -rnE "innerHTML\|outerHTML\|insertAdjacentHTML\|document\.write" frontend/src --include=*.ts \| grep -v "\.test\.ts"` → 0 usos (solo un comentario). Tests de XSS: `pages/agenda/xss.test.ts` y payloads en pacientes, ficha y recordatorios. Demo: paciente con nombre `<img src=x onerror=alert(1)>`. |
| F2 | Token solo en `sessionStorage`, nunca en `localStorage`; datos clínicos solo en memoria | ✅ | `session.ts`; `tests/tooling/no-storage-in-pages.test.ts`. |
| F3 | Sin `any` y con `strict` | ✅ | `npm run typecheck`; grep de `: any` / `as any` fuera de tests → 0. |
| F4 | El token nunca sale a otro origen | ✅ | `createHttpClient` solo acepta rutas relativas a `VITE_API_BASE_URL` (C-10). |

## Secretos y logs

| # | Control | Estado | Evidencia |
|---|---|---|---|
| L1 | Sin secretos en el repo | ✅ | `git ls-files` solo trae `.env.example` y `frontend/.env.example`; `.env` está ignorado (`git check-ignore -v .env`). Ningún `password`/`secret` con valor literal en `backend/src/main` ni `frontend/src`. Los scripts de demo piden la contraseña por variable de entorno y el smoke genera una al azar. |
| L2 | Logs sin PII ni datos de salud (solo ids) | ✅ | `FichaLogsIT`, `RecordatorioLogsIT`, `PacienteExportSeguridadIT`, `PacienteControllerIT` (capturan la salida). `show-sql: false` y el bind de Hibernate en `WARN`. Los scripts tampoco imprimen tokens ni datos de pacientes. |
| L3 | SMTP con STARTTLS obligatorio | ✅ | `SmtpConfigTest`. |

## Esquema

| # | Control | Estado | Evidencia |
|---|---|---|---|
| E1 | Esquema solo por Flyway; Hibernate en `validate` | ✅ | `ddl-auto: validate` en `application.yml` y `application-test.yml`; C-16 no agrega migraciones. |
| E2 | Sin SQL nativo específico de MySQL | ✅ | `grep -rn nativeQuery backend/src/main` → 0. |
