## MODIFIED Requirements

### Requirement: Errores tipados de la API
Toda respuesta no exitosa SHALL convertirse en un `ApiError` con un `kind` según el estado: `validation` (400 y 422, con la lista de errores por campo `{campo, mensaje}` tomada de `errores` del `ProblemDetail`, o vacía), `unauthorized` (401), `forbidden` (403), `conflict` (409), `rate_limited` (429, con `retryAfterSeconds` leído de `Retry-After` o `null`), `server` (5xx) y `unexpected` (cualquier otro). Un fallo de red MUST producir `network` y una request que supera el tiempo de espera MUST abortarse y producir `timeout`. El mensaje del error MUST ser un texto fijo por `kind`, sin el `detail` del servidor ni datos enviados por el cliente. El `ApiError` MUST exponer `codigo`, tomado de la propiedad `codigo` del `ProblemDetail` solo si es un texto de 1 a 40 caracteres en mayúsculas y guion bajo que empieza con letra (si no, `null`). También MUST exponer `pacienteId`, tomado solo de un `409` cuyo `pacienteId` sea un entero positivo (si no, `null`). La UI MUST mostrar un mensaje genérico fijo ante un `codigo` desconocido.

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
