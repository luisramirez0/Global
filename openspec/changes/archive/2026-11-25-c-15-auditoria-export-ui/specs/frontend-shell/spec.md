# Spec Delta

## ADDED Requirements

### Requirement: Menú según rol
Un ítem del menú principal MAY declarar los roles que pueden verlo; el layout MUST omitir los ítems cuyo rol no incluye el de la sesión. Los ítems sin roles declarados SHALL mostrarse a todos. Ocultar un ítem no reemplaza la autorización del backend.

#### Scenario: Ítem oculto para recepción
- **GIVEN** una sesión con rol `RECEPCION`
- **WHEN** se muestra el layout
- **THEN** la navegación no contiene el enlace "Auditoría" y sí contiene "Inicio" y "Configuración"

### Requirement: Navegación a la auditoría
El menú principal SHALL incluir para `ADMIN` y `PROFESIONAL` un ítem "Auditoría" que lleve a `#/auditoria`. La ruta `#/auditoria` MUST ser protegida (sujeta al guard).

#### Scenario: Ítem de auditoría
- **GIVEN** una sesión con rol `PROFESIONAL`
- **WHEN** se muestra el layout
- **THEN** la navegación principal contiene el enlace "Auditoría" a `#/auditoria`

#### Scenario: Auditoría sin sesión
- **GIVEN** no hay sesión
- **WHEN** se navega a `#/auditoria`
- **THEN** la ruta resultante es `#/login`
