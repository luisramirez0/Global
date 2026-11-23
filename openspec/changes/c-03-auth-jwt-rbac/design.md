# Design

## Context

- C-01 y C-02 dejan: Spring Boot 3.5.16, `SecurityConfig` stateless deny-by-default (solo `GET /api/health` y `OPTIONS /**` públicos, `401` por `HttpStatusEntryPoint`), CSRF desactivado, `PasswordConfig` BCrypt(12), `AppProperties.Jwt(secret, expirationMin)` leído de `JWT_SECRET`/`JWT_EXPIRATION_MIN`, CORS que ya admite `Authorization`.
- Contrato de tenant (handoff C-02): el filtro de C-03 fija `TenantContext` **antes** de cualquier `@Transactional` y lo limpia en `finally`. `runAsSystem` solo para buscar el usuario por email en login y crear el `Consultorio` en el alta; los dependientes se crean dentro de `runAs(nuevoId, ...)`. Sin tenant, el error llega como `CannotCreateTransactionException` con causa raíz `TenantNotSetException`.
- `Usuario` tiene un único `rol`, email único global normalizado a minúsculas, `activo`, `ultimo_login`. `Profesional` tiene `usuario` opcional. `AccionAuditoria.LOGIN` existe; `audit_log.consultorio_id` es NOT NULL (Q3: login fallido con email inexistente va al log de aplicación, sin PII).
- Decisiones de la persona (2026-11-23): Bearer en header, sin refresh en MVP, Spring OAuth2 Resource Server, rate limit en memoria por IP+email.
- Motivación y alcance: `proposal.md`. Requisitos: `specs/`.

## Goals / Non-Goals

**Goals:**
- Un único punto donde se autentica, se fija el tenant y se limpia, que falle cerrado.
- RBAC declarativo y reutilizable por C-04..C-15 sin que cada change reinvente expresiones.
- Errores homogéneos y sin PII; login que no revele si el email existe (salvo el `409` del registro, aceptado por el Flujo 1).

**Non-Goals:** refresh/revocación, cookie HttpOnly, alta de usuarios adicionales e invitaciones, recuperación de contraseña, SUPERADMIN, rate limit distribuido, endpoints de dominio (C-04+), lectura de auditoría (C-06).

## Decisions

### D1 — JWT con OAuth2 Resource Server, HS256
- `JwtConfig` define `JwtEncoder` (`NimbusJwtEncoder` con `ImmutableSecret`) y `JwtDecoder` (`NimbusJwtDecoder.withSecretKey(...).macAlgorithm(HS256)`) a partir de `AppProperties.jwt().secret()`.
- Validación al arrancar: secreto ausente o con menos de 32 bytes (256 bits, mínimo de HS256) → la aplicación no arranca, con un mensaje que no imprime el valor.
- Validadores del decoder: firma, `exp` (con `JwtTimestampValidator` y skew de 30 s, reloj del `Clock` del contexto) e `iss = "global-odonto"`.
- `TokenService.emitir(Usuario)` usa el `Clock` del contexto: `iss`, `sub = usuarioId`, `cid = consultorioId`, `rol`, `iat`, `exp = iat + expirationMin`. Sin email ni nombre en el token (regla 5).
- `JwtAuthenticationConverter`: claim `rol` → authority `ROLE_<rol>`; principal name = `sub`.
- Alternativa descartada: jjwt + filtro propio (más código de seguridad propio para revisar).

### D2 — Filtro de tenant tras la autenticación
`TenantContextFilter extends OncePerRequestFilter`, agregado con `addFilterAfter(..., BearerTokenAuthenticationFilter.class)`. Si la autenticación es un `JwtAuthenticationToken`, lee `cid` (Long), llama `TenantContext.set(cid)`; en `finally` siempre `TenantContext.clear()`. Un `cid` ausente o no numérico → `401` (token mal formado). **No** se declara como `@Component` (Boot lo registraría también como filtro de servlet, fuera de la cadena); se instancia en `SecurityConfig`.

No se consulta la base por request para verificar `activo`: un usuario desactivado conserva acceso hasta que venza su token (≤ 30 min). Aceptado para el MVP; documentado como riesgo.

### D3 — Rutas y respuestas de error
- `permitAll`: `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`, `OPTIONS /**`. Todo lo demás `authenticated()`.
- `401`: `BearerTokenAuthenticationEntryPoint` envuelto para responder `ProblemDetail` (sin detalle de por qué falló la validación). `403`: `AccessDeniedHandler` con `ProblemDetail`.
- `@RestControllerAdvice` en `common.web.ApiExceptionHandler`: `MethodArgumentNotValidException` → `400` con campos inválidos (nombre del campo, nunca el valor rechazado); `EmailYaRegistradoException` → `409`; `CredencialesInvalidasException` → `401`; `DemasiadosIntentosException` → `429` + `Retry-After`; `AccessDeniedException` (de `@PreAuthorize`) → `403`; excepción con causa raíz `TenantNotSetException` → `500` genérico y log con el id de request (es un bug, no un error del cliente).

### D4 — RBAC
- `@EnableMethodSecurity` en `SecurityConfig`.
- `security.Permisos` con constantes de expresión para `@PreAuthorize`, derivadas de la matriz de KB 03:
  - `GESTION = "hasAnyRole('ADMIN','PROFESIONAL')"` (config, usuarios, auditoría, exportación, ficha clínica).
  - `OPERACION = "hasAnyRole('ADMIN','PROFESIONAL','RECEPCION')"` (turnos, pacientes CRU, bloqueos CRU, recordatorios, lectura de config).
  - Las combinaciones finas (p. ej. RECEPCION sin `DELETE` en pacientes) las aplica cada change con estas constantes por método.
- El registro asigna `ADMIN` (en el independiente ADMIN y PROFESIONAL coinciden, KB 03). Sin jerarquía de roles: `ADMIN` y `PROFESIONAL` se listan explícitamente.
- PA-07 (RECEPCION y ficha) sigue abierta; `GESTION` la excluye por defecto (fail closed).

### D5 — Registro transaccional
`RegistroService.registrar(RegistroRequest)`:
1. Normaliza el email; en `runAsSystem` verifica que no exista → si existe, `409`.
2. En `runAsSystem` + `TransactionTemplate` crea `Consultorio(nombre)` y obtiene su id.
3. En `runAs(id)` + `TransactionTemplate`: `Usuario(email, encode(password), nombre, ADMIN)`, `Profesional(nombre, apellido)` vinculado al usuario y con matrícula opcional, `Sillon("Sillón 1")`.
4. Si el paso 3 falla, se borra el consultorio del paso 2 en modo sistema (compensación), porque los pasos 2 y 3 no pueden compartir una sesión: el tenant se resuelve al abrir la sesión (contrato C-02). Una carrera por el mismo email la resuelve la `UNIQUE` de la base → se traduce a `409` y se compensa igual.
- Alternativa: abrir la transacción en modo sistema y asignar `consultorio_id` a mano en los dependientes. Descartada: rompe la regla "el código nunca asigna `consultorio_id` en flujos con tenant" de C-02.

`RegistroRequest` (Bean Validation): `consultorioNombre` (1–150), `nombre` (1–100), `apellido` (1–100), `email` (`@Email`, ≤ 254), `password` (8–72 **bytes** UTF-8: límite de BCrypt), `matricula` opcional (≤ 50). Respuesta `201` `{consultorioId, usuarioId}`.

### D6 — Login
`LoginService.login(email, password, ip)`:
1. Rate limiter: si la clave `ip|emailNormalizado` está bloqueada → `429`.
2. `runAsSystem(findByEmail)`. Si no existe → se ejecuta igual un `matches` contra un hash dummy (iguala tiempos y no revela si el email existe), se registra un fallo en el limiter, log de aplicación sin email → `401`.
3. Si existe pero la contraseña no coincide o `activo = false` → fallo en el limiter, `audit_log` `LOGIN` con detalle `"fallido"` dentro de `runAs(cid)` → `401` (mismo mensaje que el caso 2).
4. Éxito → reset del limiter, `ultimo_login = now`, `audit_log` `LOGIN` detalle `"ok"` (usuario e IP), emite el token.
Respuesta `200` `{accessToken, tokenType: "Bearer", expiresIn (s), usuario: {id, nombre, rol}, consultorioId}`.

La IP sale de `request.getRemoteAddr()` (no se confía en `X-Forwarded-For` sin proxy configurado; queda para C-16).

### D7 — Rate limiting en memoria
`LoginRateLimiter` (bean, `Clock` inyectado): `ConcurrentHashMap<String, Deque<Instant>>` con ventana deslizante; máximo 5 fallos en 15 minutos por clave; al bloquear informa los segundos restantes para `Retry-After`. Purga oportunista de claves vencidas en cada registro para acotar memoria. Una sola instancia (suficiente para la demo); el reinicio lo resetea. Límites como constantes, no como variables de entorno (evita ampliar `runtime-configuration`).

### D8 — `GET /api/auth/me`
Autenticado con cualquier rol; dentro del tenant del token lee `Usuario` por `sub` y `Consultorio` por `cid`. Devuelve `{usuario: {id, nombre, email, rol}, consultorio: {id, nombre}}`. Si el usuario ya no existe o está inactivo → `401`. Sirve además como prueba end-to-end del tenant tomado del token.

### D9 — Paquetes
- `security/`: `SecurityConfig` (extendido), `JwtConfig`, `TokenService`, `TenantContextFilter`, `LoginRateLimiter`, `Permisos`, handlers de 401/403.
- `usuario/auth/`: `AuthController` (`/api/auth/*`), `LoginService`, DTOs (`LoginRequest`, `LoginResponse`, `MeResponse`) y mapper.
- `consultorio/registro/`: `RegistroService`, `RegistroRequest`, `RegistroResponse`.
- `common/web/`: `ApiExceptionHandler` y excepciones de dominio.
- Entidades nunca salen por la API (regla 1).

## Risks / Trade-offs

- **Token robado vale hasta 30 min y no se puede revocar** (sin refresh ni blacklist). Mitigación: expiración corta, sin datos personales en el token, front lo guarda en memoria/`sessionStorage` (C-10) y sin `innerHTML` (regla 3).
- **Usuario desactivado conserva acceso hasta el vencimiento** (D2). Aceptado para el MVP.
- **Rate limit por IP+email no frena el "spraying"** de una contraseña sobre muchos emails desde una IP. Aceptado; posible límite adicional por IP en C-16.
- **`409` en el registro revela que un email existe.** Aceptado por el Flujo 1 de la KB.
- **Compensación del registro** (D5) no es atómica ante una caída del proceso entre pasos: podría quedar un consultorio sin usuario. Riesgo bajo y sin exposición de datos; se documenta.
- **HS256 con secreto compartido**: suficiente para un único backend; rotar el secreto invalida todas las sesiones.

## Migration Plan

Sin migraciones. Despliegue: definir `JWT_SECRET` (≥ 32 bytes aleatorios, p. ej. `openssl rand -base64 48`) en `.env` antes de arrancar; sin él el backend no arranca (intencional). Rollback: revertir el PR; no hay cambios de esquema.

## Open Questions

- PA-07 (RECEPCION y ficha clínica): se mantiene excluida por defecto; la decide el Product owner antes de C-08.
- Logout: en el MVP es solo del lado cliente (descartar el token). ¿Alcanza para la demo? (Se asume que sí.)
