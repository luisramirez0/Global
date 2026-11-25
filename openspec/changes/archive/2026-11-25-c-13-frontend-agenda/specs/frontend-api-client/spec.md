## MODIFIED Requirements

### Requirement: Errores tipados de la API
Toda respuesta no exitosa SHALL ser un `ApiError` con `kind` según el estado: `validation` (400, 422; `fieldErrors` de `errores`), `unauthorized` (401), `forbidden` (403), `conflict` (409), `rate_limited` (429; `retryAfterSeconds` de `Retry-After` o `null`), `server` (5xx), `unexpected` (otro). Un fallo de red MUST dar `network` y un tiempo de espera agotado MUST abortar y dar `timeout`. El mensaje MUST ser fijo por `kind`, sin el `detail` del servidor ni datos del cliente, aun con detalle de conflicto.

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

## ADDED Requirements

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
