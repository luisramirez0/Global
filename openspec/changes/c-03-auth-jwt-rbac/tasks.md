# Tasks

> Strict TDD: cada tarea arranca con un test que falla (RED), luego el mínimo código para pasarlo (GREEN), un segundo caso (TRIANGULATE) y refactor con tests verdes. Antes de tocar archivos existentes, correr `cd backend && ./gradlew test` y registrar la línea base (C-02: 189/189). Tests de integración contra H2 `MODE=MySQL` con las migraciones reales (regla 8); `MockMvc` con `@SpringBootTest` + `@AutoConfigureMockMvc`. Reloj controlable vía `TestClockConfig` para expiración y rate limit.
>
> Governance CRÍTICA: **no se empieza el grupo 1 sin la aprobación explícita de la persona sobre `design.md`.** Un único PR hacia `main` con review de integrante-1 (principal) o integrante-2 (suplente), sección de zona de riesgo completa (regla 12).

## 1. Configuración JWT y arranque

- [x] 1.1 (línea base 189/189; JDK 21 + truststore Windows-ROOT por Avast) Agregar `spring-boot-starter-oauth2-resource-server` a `build.gradle`; definir en `application-test.yml` `app.jwt.secret` de prueba (≥ 32 bytes, marcado como no sensible). Verificar: `./gradlew test` sigue verde (línea base).
- [x] 1.2 RED: `JwtSecretValidationTest` (`ApplicationContextRunner`): secreto ausente, vacío o de 31 bytes → el contexto no arranca y el mensaje menciona `JWT_SECRET` sin el valor; 32 bytes → arranca. GREEN: validación en `security.JwtConfig`. Actualizar el comentario de `JWT_SECRET` en `.env.example` (longitud mínima; la persona revisa el archivo).
- [x] 1.3 (checkpoint: suite 200/200) RED: `TokenServiceTest` (unitario, `Clock` fijo): el token emitido para un usuario (id 5, consultorio 7, `ADMIN`) decodifica con `iss`, `sub=5`, `cid=7`, `rol=ADMIN`, `exp = iat + 30 min` y no contiene email ni nombre; el decoder rechaza un token vencido (reloj +31 min), uno firmado con otro secreto y uno con otro `iss`. GREEN: `JwtEncoder`/`JwtDecoder` HS256 en `JwtConfig`, `security.TokenService`.

## 2. Cadena de seguridad, tenant y errores

- [x] 2.1 (SecurityDefaultDenyIT actualizado: el 401 ahora es ProblemDetail genérico) RED: `SecurityRoutesIT`: sin token, `GET /api/auth/me` → `401` `ProblemDetail`; `POST /api/auth/login` y `/register` no son rechazados por seguridad; `GET /api/health` sigue público; ninguna respuesta setea `JSESSIONID`; `SecurityDefaultDenyIT` y `CorsPolicyIT` siguen verdes. GREEN: extender `SecurityConfig` (`oauth2ResourceServer().jwt()`, `JwtAuthenticationConverter` `rol`→`ROLE_*`, rutas públicas, entry point y access denied handler con `ProblemDetail`, `@EnableMethodSecurity`).
- [x] 2.2 (además el decoder exige sub/cid numéricos y rol conocido) RED: `TenantContextFilterTest` (unitario) y `TenantFromTokenIT`: con token de cid 7 el controlador de prueba ve `TenantContext.require() == 7`; tras la request (también si el controlador lanza) `TenantContext.get()` está vacío; token firmado sin `cid` o con `cid` no numérico → `401`. GREEN: `security.TenantContextFilter` después de `BearerTokenAuthenticationFilter`, no registrado como filtro de servlet.
- [x] 2.3 RED: `RbacIT` con un controlador de prueba en `src/test` (`/api/test/gestion` con `@PreAuthorize(Permisos.GESTION)`, `/api/test/operacion` con `Permisos.OPERACION`): `RECEPCION` → `403` en gestión y `200` en operación; `ADMIN` y `PROFESIONAL` → `200` en ambas; token con firma alterada (cambiando `rol` a `ADMIN`) → `401`. GREEN: `security.Permisos`.
- [x] 2.4 (standalone MockMvc en lugar de @WebMvcTest) RED: `ApiExceptionHandlerTest` (`@WebMvcTest` con un controlador de prueba): validación → `400` con nombres de campo y sin valores; `EmailYaRegistradoException` → `409`; `DemasiadosIntentosException` → `429` + `Retry-After`; excepción con causa raíz `TenantNotSetException` → `500` genérico; ningún cuerpo contiene la traza. GREEN: `common.web.ApiExceptionHandler` y excepciones.

## 3. Registro

- [x] 3.1 (falla simulada: matrícula > 50 en la base; se agregó `delete` a `ConsultorioRepository`) RED: `RegistroServiceTest` (`@PersistenceTest` + servicio): registro válido crea consultorio, usuario `ADMIN` con email normalizado y hash BCrypt que `matches`, profesional vinculado y sillón, todos con el `consultorio_id` nuevo; email duplicado (con distinto casing) → `EmailYaRegistradoException` y la cantidad de consultorios no cambia; falla simulada al crear el sillón → no queda consultorio, usuario ni profesional (compensación D5); al terminar `TenantContext` está vacío. GREEN: `consultorio.registro.RegistroService`.
- [x] 3.2 RED: `RegistroControllerIT`: `201` con `consultorioId`/`usuarioId` y sin token; `409` duplicado; `400` para email inválido, contraseña de 7 caracteres y contraseña de 73 bytes; la respuesta y los logs (`OutputCaptureExtension`) no contienen la contraseña. GREEN: `AuthController.register`, `RegistroRequest`/`RegistroResponse` con Bean Validation.

## 4. Login, rate limit, auditoría y `me`

- [x] 4.1 RED: `LoginRateLimiterTest` (unitario, `Clock` mutable): 5 fallos para la misma clave → bloqueada con `Retry-After` correcto; otra IP o email no se ve afectado; tras 15 min desde el primer fallo libera; `reset` tras éxito vacía el contador; las claves vencidas se purgan. GREEN: `security.LoginRateLimiter`.
- [x] 4.2 RED: `LoginServiceTest` (`@PersistenceTest`): login correcto devuelve token válido, actualiza `ultimo_login` al instante del reloj y escribe `LOGIN` `ok` con usuario, consultorio e IP; contraseña incorrecta → `CredencialesInvalidasException` + `LOGIN` `fallido`; usuario inactivo → mismo error; email inexistente → mismo error, sin filas en `audit_log` y sin el email en la salida de log; el hash dummy se verifica en el caso inexistente (espía del `PasswordEncoder`). GREEN: `usuario.auth.LoginService`.
- [x] 4.3 RED: `LoginControllerIT`: `200` con `tokenType=Bearer`, `expiresIn=1800`, `usuario` y `consultorioId`; los dos casos de `401` tienen cuerpo idéntico; 6.º intento tras 5 fallos → `429` con `Retry-After`, incluso con la contraseña correcta. GREEN: `AuthController.login`, DTOs.
- [x] 4.4 RED: `MeControllerIT`: con token del usuario de A → `200` con datos de A; usuario desactivado tras emitir su token → `401`. GREEN: `AuthController.me`, `MeResponse` + mapper.

## 5. Aislamiento end-to-end y verificación

- [x] 5.1 (incluye token firmado con usuario de A y cid de B → 401 en `me`) RED→GREEN: `AuthTenantIsolationIT`: registrar A y B por la API, loguear ambos; con el token de A, `/api/auth/me` y el controlador de prueba que lista usuarios devuelven solo datos de A, y con el de B solo de B; un token de A con `cid` de B forjado sin la firma correcta → `401`.
- [x] 5.2 (264/264; grep de logs limpio) Verificar: `./gradlew test` completo en verde, reporte JaCoCo generado; `grep` en `src/main` sin logs con email/password/token (regla 5).
- [x] 5.3 Handoff `knowledge-base/entrega/C-03.md` (qué se hizo, cómo se verificó, contrato para C-04..C-10: `Permisos`, `TenantContext` garantizado, formato de error, endpoints de auth para C-10; riesgos de design), actualizar DD-04/PA-10 en KB 09/10 como resueltos para el MVP, y marcar `[x]` en `CHANGES.md` con evidencia.

## Workflow follow-up

- [x] Verificación manual contra MySQL (2026-11-23, la persona): registro (consultorioId=2, usuarioId=2), login y `me` OK con `docker compose up`.
- PR único solo con autorización explícita, plantilla `.github/pull_request_template.md`, Conventional Commits y review de integrante-1/2 (zona de riesgo: auth/JWT/RBAC).
- Archivar el change cuando el PR esté mergeado.
