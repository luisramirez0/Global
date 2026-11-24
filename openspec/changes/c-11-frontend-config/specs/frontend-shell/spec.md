## ADDED Requirements

### Requirement: Navegación a la configuración
El menú principal SHALL incluir un ítem "Configuración" que lleve a `#/config/sillones`. Las rutas `#/config/sillones`, `#/config/prestaciones`, `#/config/horarios` y `#/config/bloqueos` MUST ser protegidas (sujetas al guard).

#### Scenario: Ítem de configuración
- **GIVEN** una sesión activa
- **WHEN** se muestra el layout
- **THEN** la navegación principal contiene el enlace "Configuración" a `#/config/sillones`

#### Scenario: Configuración sin sesión
- **GIVEN** no hay sesión
- **WHEN** se navega a `#/config/bloqueos`
- **THEN** la ruta resultante es `#/login`
