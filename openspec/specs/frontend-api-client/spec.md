# frontend-api-client Specification

## Purpose

Proveer un único cliente HTTP tipado hacia la API: envía el token solo a la URL base configurada, aplica tiempo de espera, valida las respuestas y convierte cada error en un tipo explícito que las pantallas pueden tratar sin exponer datos.

## Requirements

### Requirement: Requests hacia la API configurada
El cliente HTTP SHALL resolver cada request como `API_BASE_URL` + una ruta relativa que empieza con `/`, y MUST rechazar sin enviar nada cualquier ruta absoluta o con esquema, para que el token nunca se envíe a otro origen.

#### Scenario: Ruta relativa
- **GIVEN** `API_BASE_URL` es `http://localhost:8080/api`
- **WHEN** se pide `GET /auth/me`
- **THEN** `fetch` recibe `http://localhost:8080/api/auth/me`

#### Scenario: Ruta absoluta rechazada
- **WHEN** se pide `GET https://evil.example/robar`
- **THEN** la request falla con error de programación y `fetch` no es invocado

### Requirement: Encabezados de la request
El cliente SHALL enviar `Accept: application/json` en toda request y `Content-Type: application/json` solo cuando hay cuerpo. En requests autenticadas con sesión vigente MUST enviar `Authorization: Bearer <token>`; en requests no autenticadas (registro, login) o sin sesión MUST NOT enviar `Authorization`. Las requests MUST NOT enviar cookies.

#### Scenario: Request autenticada
- **GIVEN** una sesión con token `t1`
- **WHEN** se llama a `me()`
- **THEN** la request lleva `Authorization: Bearer t1` y `Accept: application/json`, y no lleva `Content-Type`

#### Scenario: Login sin token
- **GIVEN** una sesión con token `t1`
- **WHEN** se llama a `login` con email y contraseña
- **THEN** la request lleva `Content-Type: application/json` y no lleva `Authorization`

### Requirement: Errores tipados de la API
Toda respuesta no exitosa SHALL convertirse en un `ApiError` con un `kind` según el estado: `validation` (400 y 422, con la lista de errores por campo `{campo, mensaje}` tomada de `errores` del `ProblemDetail`, o vacía), `unauthorized` (401), `forbidden` (403), `conflict` (409), `rate_limited` (429, con `retryAfterSeconds` leído de `Retry-After` o `null`), `server` (5xx) y `unexpected` (cualquier otro). Un fallo de red MUST producir `network` y una request que supera el tiempo de espera MUST abortarse y producir `timeout`. El mensaje del error MUST ser un texto fijo por `kind`, sin el `detail` del servidor ni datos enviados por el cliente.

#### Scenario: Validación con errores por campo
- **WHEN** la API responde `400` con `errores: [{campo: "email", mensaje: "formato inválido"}]`
- **THEN** la request falla con `kind = validation` y `fieldErrors` contiene `email`

#### Scenario: Rate limit
- **WHEN** la API responde `429` con `Retry-After: 840`
- **THEN** la request falla con `kind = rate_limited` y `retryAfterSeconds = 840`

#### Scenario: Cuerpo de error que no es JSON
- **WHEN** la API responde `500` con cuerpo HTML
- **THEN** la request falla con `kind = server` sin propagar el cuerpo

#### Scenario: Red caída
- **WHEN** `fetch` rechaza por error de red
- **THEN** la request falla con `kind = network`

#### Scenario: Tiempo de espera agotado
- **GIVEN** un tiempo de espera de 15 s
- **WHEN** la API no responde en 15 s
- **THEN** la request se aborta y falla con `kind = timeout`

### Requirement: Respuestas exitosas validadas
El cliente SHALL validar la forma del JSON de cada respuesta exitosa con un decodificador por endpoint antes de entregarlo tipado, y MUST fallar con `kind = unexpected` si no coincide; una respuesta `204` o sin cuerpo MUST resolverse sin valor.

#### Scenario: Forma inesperada
- **WHEN** `login` recibe `200` con un cuerpo sin `accessToken`
- **THEN** la request falla con `kind = unexpected`

### Requirement: 401 en request autenticada cierra la sesión
Si una request autenticada recibe `401`, el cliente SHALL notificar a la sesión para que se cierre con motivo `unauthorized` además de fallar con `kind = unauthorized`. Un `401` de una request no autenticada (login) MUST NOT cerrar la sesión.

#### Scenario: Token rechazado
- **GIVEN** una sesión activa
- **WHEN** `me()` recibe `401`
- **THEN** la sesión queda cerrada con motivo `unauthorized`

#### Scenario: Credenciales inválidas en login
- **WHEN** `login` recibe `401`
- **THEN** falla con `kind = unauthorized` y no se invoca el cierre de sesión

### Requirement: Endpoints de autenticación tipados
El cliente SHALL exponer `register`, `login` y `me` con los tipos del contrato de C-03: `register` envía `{consultorioNombre, nombre, apellido, email, password, matricula?}` a `POST /auth/register` y devuelve `{consultorioId, usuarioId}`; `login` envía `{email, password}` a `POST /auth/login` y devuelve `{accessToken, tokenType, expiresIn, usuario: {id, nombre, rol}, consultorioId}`; `me` invoca `GET /auth/me` y devuelve `{usuario: {id, nombre, email, rol}, consultorio: {id, nombre}}`, con `rol` restringido a `ADMIN`, `PROFESIONAL` o `RECEPCION`.

#### Scenario: Registro exitoso
- **WHEN** `register` recibe `201` con `{consultorioId: 2, usuarioId: 2}`
- **THEN** resuelve con esos ids

#### Scenario: Rol desconocido
- **WHEN** `me` recibe un `rol` `SUPERADMIN`
- **THEN** falla con `kind = unexpected`
