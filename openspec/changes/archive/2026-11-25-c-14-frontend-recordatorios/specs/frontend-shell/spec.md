# Spec Delta

## ADDED Requirements

### Requirement: Navegación a los recordatorios
El menú principal SHALL incluir, inmediatamente después de "Agenda", un ítem "Recordatorios" con enlace a `#/recordatorios`, visible para `ADMIN`, `PROFESIONAL` y `RECEPCION`. La ruta `#/recordatorios` MUST ser protegida (sujeta al guard).

#### Scenario: Ítem de recordatorios
- **GIVEN** una sesión con rol `RECEPCION`
- **WHEN** se muestra el layout
- **THEN** la navegación principal contiene "Recordatorios" a `#/recordatorios` justo después de "Agenda"

#### Scenario: Recordatorios sin sesión
- **GIVEN** no hay sesión
- **WHEN** se navega a `#/recordatorios`
- **THEN** la ruta resultante es `#/login`
