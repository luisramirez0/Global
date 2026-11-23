# Spec Delta

## ADDED Requirements

### Requirement: Secreto JWT obligatorio y robusto
El backend MUST negarse a arrancar si `JWT_SECRET` no está definida o tiene menos de 32 bytes, con un mensaje que nombra la variable sin mostrar su valor; `.env.example` MUST dejar `JWT_SECRET` vacía e indicar la longitud mínima, y el perfil `test` MAY definir un secreto de prueba no sensible.

#### Scenario: Secreto ausente
- **GIVEN** `JWT_SECRET` no está definida
- **WHEN** arranca la aplicación
- **THEN** el arranque falla con un mensaje que menciona `JWT_SECRET`

#### Scenario: Secreto corto sin filtrarse
- **GIVEN** `JWT_SECRET` vale `corto`
- **WHEN** arranca la aplicación
- **THEN** el arranque falla y el mensaje no contiene `corto`
