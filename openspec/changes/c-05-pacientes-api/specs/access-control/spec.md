# Spec Delta

## MODIFIED Requirements

### Requirement: Errores homogéneos sin datos personales
Las respuestas de error de la API (`400`, `401`, `403`, `404`, `409`, `429`, `500`) SHALL usar el formato `ProblemDetail` y MUST NOT incluir valores enviados por el cliente, datos personales, trazas ni la causa técnica de un rechazo de autenticación. Un `404` MUST NOT distinguir entre un recurso inexistente y uno de otro consultorio.

#### Scenario: Error de validación sin valores
- **WHEN** un registro falla por email inválido `x@`
- **THEN** la respuesta `400` nombra el campo `email` y no contiene `x@`

#### Scenario: Parámetro de ruta con tipo inválido
- **WHEN** se envía `GET /api/pacientes/abc` con un token válido
- **THEN** la respuesta es `400` en formato `ProblemDetail` y no contiene `abc`

#### Scenario: Recurso de otro consultorio
- **GIVEN** el recurso con id 9 pertenece al consultorio B
- **WHEN** el usuario de A lo solicita, y luego solicita un id que no existe
- **THEN** ambas respuestas son `404` con el mismo cuerpo
