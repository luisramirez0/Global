## MODIFIED Requirements

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
