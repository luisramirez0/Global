# Spec Delta

## MODIFIED Requirements

### Requirement: Errores homogéneos sin datos personales
Las respuestas de error de la API (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`) SHALL usar el formato `ProblemDetail` y MUST NOT incluir valores enviados por el cliente, datos personales, trazas ni la causa técnica de un rechazo de autenticación.

#### Scenario: Error de validación sin valores
- **WHEN** un registro falla por email inválido `x@`
- **THEN** la respuesta `400` nombra el campo `email` y no contiene `x@`

#### Scenario: Recurso inexistente sin detalles internos
- **WHEN** un usuario autenticado consulta por id un recurso que no existe en su consultorio
- **THEN** la respuesta es `404` en formato `ProblemDetail` y no contiene el id consultado ni trazas

#### Scenario: Regla de negocio violada
- **WHEN** una operación viola una regla de negocio (conflicto `409` o referencia inválida `422`)
- **THEN** la respuesta usa `ProblemDetail` con un título genérico y no contiene los valores enviados por el cliente
