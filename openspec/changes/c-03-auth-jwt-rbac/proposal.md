# Proposal

## Why

Hoy la API rechaza todo salvo `/api/health` (línea base de C-01/C-02) y nadie puede entrar al sistema: no hay alta de consultorio, ni login, ni forma de poblar `TenantContext` desde una request. C-03 está en el camino crítico (C-01 → C-02 → **C-03** → C-04 → C-07 → C-09 → C-14 → C-16) y desbloquea el fork de 5 lanes (C-04..C-09, C-10 integrado). Es governance CRÍTICA: auth, RBAC y el punto donde se fija el tenant de cada request (RN-MT-01, RN-DS-05, Ley 25.326).

## What Changes

- `POST /api/auth/register` (público): en una transacción crea Consultorio + Usuario `ADMIN` + Profesional vinculado + Sillón por defecto. Devuelve `201` sin token (la SPA luego hace login, Flujo 1). Email duplicado → `409`.
- `POST /api/auth/login` (público): valida credenciales con BCrypt(12) (`PasswordConfig` de C-02), emite un access token JWT HS256 de `JWT_EXPIRATION_MIN` (30) minutos. Credenciales inválidas o usuario inactivo → `401` genérico. Actualiza `ultimo_login` y registra `LOGIN` en `audit_log`.
- `GET /api/auth/me` (autenticado): datos mínimos del usuario y consultorio en curso, para el shell de C-10.
- Transporte **Bearer en header** y **sin refresh en el MVP** (decisión de la persona, 2026-11-23, cierra DD-04/PA-10 para el MVP). Al vencer, la SPA vuelve al login.
- Validación del token con **Spring Security OAuth2 Resource Server** (Nimbus, HS256 sobre `JWT_SECRET`); claims `sub` (usuario), `cid` (consultorio), `rol`. El arranque falla si `JWT_SECRET` falta o tiene < 32 bytes.
- `TenantContextFilter`: después de autenticar, fija `TenantContext` con `cid` del token y lo limpia en `finally`.
- RBAC: roles `ADMIN|PROFESIONAL|RECEPCION` como authorities `ROLE_*`, `@EnableMethodSecurity` y constantes de expresión (`Permisos`) según la matriz de KB 03 para que C-04..C-15 las usen en `@PreAuthorize`. `401` sin token o token inválido/expirado; `403` con rol insuficiente. Rutas públicas explícitas: health, register, login, preflight.
- Rate limiting de login **en memoria por IP+email** (5 fallos en 15 min → `429` con `Retry-After`), sin dependencias.
- Errores en formato `ProblemDetail` (RFC 9457) con un `@RestControllerAdvice` común: `400` validación, `401`, `403`, `409`, `429`; sin PII en mensajes ni logs.
- Tests: registro (transacción completa, 409, validación), login (ok, 401, inactivo, hash), expiración, firma alterada, rol insuficiente, aislamiento A/B con tokens de cada consultorio, rate limit, limpieza del tenant tras la request.

## Capabilities

### New Capabilities
- `authentication`: alta de consultorio, login, emisión y validación del token, rate limiting, auditoría de login.
- `access-control`: rutas públicas, 401/403, roles y matriz RBAC, tenant de la request derivado del token.

### Modified Capabilities
- `api-cors-policy`: "Acceso denegado por defecto" pasa a declarar como públicas `POST /api/auth/register` y `POST /api/auth/login`.
- `runtime-configuration`: `JWT_SECRET` obligatorio y de longitud mínima (fail-fast al arrancar).

## Impact

- **Código**: `security/` (config, JWT, filtro de tenant, rate limiter, `Permisos`), `usuario/` (servicio de login, `auth/me`), `consultorio/` (servicio de registro), `common/web/` (manejo de errores). `SecurityConfig` se extiende (zona de riesgo, regla 12).
- **Esquema**: ninguna migración nueva (usa V1/V2 de C-02; sin tabla de refresh).
- **Configuración**: `application-test.yml` con un `JWT_SECRET` de test no sensible; `.env.example` aclara la longitud mínima.
- **Dependencias**: `spring-boot-starter-oauth2-resource-server` (gratuita, oficial de Spring). Ninguna otra.
- **Consumidores**: C-04..C-09 usan `Permisos` + `@PreAuthorize` y confían en que `TenantContext` está fijado; C-06 consume los `LOGIN` registrados; C-10 integra contra `register`/`login`/`me`.
- **Fuera de alcance**: refresh token, cookie HttpOnly, logout del lado servidor/revocación, alta de usuarios adicionales (RECEPCION), recuperación de contraseña, SUPERADMIN, rate limit distribuido.
- **Riesgo**: governance CRÍTICA. Requiere aprobación explícita del diseño antes de apply y review de integrante-1 (principal) o integrante-2 (suplente) en el PR.
