## MODIFIED Requirements

### Requirement: Rutas por hash
La aplicación SHALL navegar con rutas en el fragmento de la URL (`#/login`, `#/registro`, `#/inicio`) y MUST reaccionar a los cambios de hash sin recargar la página. Un hash vacío, `#/` o una ruta desconocida MUST resolverse a `#/inicio` (sujeto al guard). Una ruta MAY declarar segmentos de parámetro (`:id`). Un parámetro MUST coincidir solo con un entero positivo en decimal, sin ceros a la izquierda y no mayor que `Number.MAX_SAFE_INTEGER`, y la página MUST recibirlo como número. Una ruta cuyo parámetro no cumpla esa forma MUST tratarse como desconocida, sin renderizar la página ni hacer requests. Las rutas exactas MUST tener prioridad sobre las de parámetro.

#### Scenario: Ruta desconocida
- **GIVEN** una sesión activa
- **WHEN** se navega a `#/no-existe`
- **THEN** la ruta resultante es `#/inicio`

#### Scenario: Ruta con parámetro válido
- **GIVEN** una sesión activa
- **WHEN** se navega a `#/pacientes/12/ficha`
- **THEN** se renderiza la página de ficha con el parámetro `id = 12`

#### Scenario: Parámetro inválido
- **GIVEN** una sesión activa
- **WHEN** se navega a `#/pacientes/abc`, `#/pacientes/-1`, `#/pacientes/0` o `#/pacientes/01`
- **THEN** la ruta resultante es `#/inicio` y no se envió ninguna request a la API

#### Scenario: Cambio de parámetro
- **GIVEN** se muestra `#/pacientes/1/ficha`
- **WHEN** se navega a `#/pacientes/2/ficha`
- **THEN** se libera la página anterior y se renderiza una nueva con `id = 2`

#### Scenario: Ruta exacta antes que parámetro
- **WHEN** se navega a `#/pacientes/nuevo`
- **THEN** se renderiza el alta de paciente

## ADDED Requirements

### Requirement: Navegación a pacientes
El menú principal SHALL incluir un ítem "Pacientes" que lleve a `#/pacientes`, visible para todos los roles. Las rutas `#/pacientes`, `#/pacientes/nuevo`, `#/pacientes/:id` y `#/pacientes/:id/ficha` MUST ser protegidas (sujetas al guard).

#### Scenario: Ítem de pacientes
- **GIVEN** una sesión activa
- **WHEN** se muestra el layout
- **THEN** la navegación principal contiene el enlace "Pacientes" a `#/pacientes`

#### Scenario: Ficha sin sesión
- **GIVEN** no hay sesión
- **WHEN** se navega a `#/pacientes/5/ficha`
- **THEN** la ruta resultante es `#/login` y no se envió ninguna request de ficha
