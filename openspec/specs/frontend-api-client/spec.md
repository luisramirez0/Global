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
Toda respuesta no exitosa SHALL ser un `ApiError` con `kind` según el estado: `validation` (400, 422; `fieldErrors` de `errores`), `unauthorized` (401), `forbidden` (403), `conflict` (409), `rate_limited` (429; `retryAfterSeconds` de `Retry-After` o `null`), `server` (5xx), `unexpected` (otro). Un fallo de red MUST dar `network` y un tiempo de espera agotado MUST abortar y dar `timeout`. El mensaje MUST ser fijo por `kind`, sin el `detail` del servidor ni datos del cliente, aun con detalle de conflicto. El `ApiError` MUST exponer `codigo`, tomado de la propiedad `codigo` del `ProblemDetail` solo si es un texto de 1 a 40 caracteres en mayúsculas y guion bajo que empieza con letra (si no, `null`), y `pacienteId`, tomado solo de un `409` cuyo `pacienteId` sea un entero positivo (si no, `null`). La UI MUST mostrar un mensaje genérico fijo ante un `codigo` desconocido.

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

#### Scenario: Código de negocio
- **WHEN** la API responde `409` con `codigo: "FICHA_DESACTUALIZADA"`
- **THEN** la request falla con `kind = conflict` y `codigo = "FICHA_DESACTUALIZADA"`

#### Scenario: Código con forma inválida
- **WHEN** la API responde `409` con `codigo: "<b>x</b>"` o un número
- **THEN** `codigo` es `null` y el mensaje es el fijo de `conflict`

#### Scenario: DNI duplicado
- **WHEN** la API responde `409` con `pacienteId: 7`
- **THEN** `pacienteId = 7`; con `pacienteId: "7"`, `-1` o en un `400`, `pacienteId` es `null`

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

### Requirement: Detalle de conflicto en errores
El `ApiError` SHALL exponer dos detalles opcionales: `conflicto` en un `409`, tomado del objeto `conflicto` del `ProblemDetail` como `{turnoId, inicio, fin, sillonId, profesionalId, motivo}` con `motivo` `SILLON` o `PROFESIONAL`, y `bloqueoId` en un `422`, entero positivo. Si no vienen o están mal formados MUST quedar en `null` sin cambiar el `kind` ni hacer fallar la conversión. Los detalles MUST contener solo ids e instantes.

#### Scenario: Conflicto de turno con detalle
- **WHEN** la API responde `409` con `conflicto: {turnoId: 9, inicio: "2026-11-24T13:00:00Z", fin: "2026-11-24T13:30:00Z", sillonId: 1, profesionalId: 1, motivo: "SILLON"}`
- **THEN** la request falla con `kind = conflict`, `conflicto.motivo = SILLON` y `conflicto.turnoId = 9`, y el mensaje es el fijo de `conflict`

#### Scenario: Conflicto sin detalle
- **WHEN** la API responde `409` con solo `title: "Modificación concurrente"`
- **THEN** la request falla con `kind = conflict` y `conflicto = null`

#### Scenario: Detalle de conflicto mal formado
- **WHEN** la API responde `409` con `conflicto: {turnoId: "x", motivo: "OTRO"}`
- **THEN** la request falla con `kind = conflict` y `conflicto = null`

#### Scenario: Bloqueo en un 422
- **WHEN** la API responde `422` con `errores: [{campo: "inicio", mensaje: "dentro de un bloqueo"}]` y `bloqueoId: 4`
- **THEN** la request falla con `kind = validation`, `fieldErrors` contiene `inicio` y `bloqueoId = 4`

### Requirement: Cliente tipado de pacientes
El frontend SHALL exponer un cliente tipado de `/pacientes` sobre el cliente HTTP autenticado con `buscar` (`GET /pacientes` con `q`, `page` y `size` opcionales; devuelve `{contenido, pagina, tamanio, totalElementos, totalPaginas}`) y `obtener` (`GET /pacientes/{id}`). Cada paciente MUST decodificarse con el contrato de C-05 y una forma inesperada MUST producir `unexpected`. Los ids MUST ser enteros positivos.

#### Scenario: Búsqueda por texto
- **WHEN** se buscan pacientes con `q = "pér"`, página 0 y tamaño 10
- **THEN** se envía `GET /pacientes?q=p%C3%A9r&page=0&size=10` con el token y se obtiene la página decodificada

#### Scenario: Búsqueda sin texto
- **WHEN** se buscan pacientes sin `q`
- **THEN** la request no lleva el parámetro `q`

#### Scenario: Paciente con forma inesperada
- **WHEN** la API devuelve un paciente sin `apellido`
- **THEN** el cliente rechaza con un error `unexpected`

### Requirement: Cliente de pacientes compartido
El cliente de pacientes SHALL ser único en la aplicación y estar disponible para todas las páginas desde el contexto de página. MUST NOT contener lógica de una pantalla, para que otras pantallas (C-12) lo amplíen con alta, edición y baja sin crear un segundo cliente.

#### Scenario: Mismo cliente para todas las páginas
- **GIVEN** la aplicación arrancada con una sesión
- **WHEN** la agenda busca un paciente
- **THEN** la request sale por el cliente de pacientes del contexto, con la URL base y el token de la aplicación
