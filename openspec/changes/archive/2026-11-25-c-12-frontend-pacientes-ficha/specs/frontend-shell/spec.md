## MODIFIED Requirements

### Requirement: Rutas por hash
La aplicación SHALL navegar con rutas en el fragmento de la URL (`#/login`, `#/registro`, `#/agenda`) y MUST reaccionar a los cambios de hash sin recargar la página. `#/agenda` es la ruta de inicio. La ruta anterior `#/inicio` MUST redirigirse de forma explícita (tabla de redirecciones del router, no por ser desconocida) a `#/agenda`, sujeta al guard y reemplazando la entrada del historial. Un hash vacío, `#/` o una ruta desconocida MUST seguir resolviéndose a `#/agenda` como hasta ahora. Una ruta MAY declarar segmentos de parámetro (`:id`). Un parámetro MUST coincidir solo con un entero positivo en decimal, sin ceros a la izquierda y no mayor que `Number.MAX_SAFE_INTEGER`, validado sobre el texto crudo del hash, y la página MUST recibirlo como número. Una ruta cuyo parámetro no cumpla esa forma MUST tratarse como desconocida, sin renderizar la página ni hacer requests de esa página. Las rutas exactas MUST tener prioridad sobre las de parámetro.

#### Scenario: Ruta desconocida
- **GIVEN** una sesión activa
- **WHEN** se navega a `#/no-existe`
- **THEN** la ruta resultante es `#/agenda` con la entrada del historial reemplazada

#### Scenario: Inicio anterior redirige a la agenda
- **GIVEN** una sesión activa
- **WHEN** se navega a `#/inicio`
- **THEN** la ruta resultante es `#/agenda` por `replaceState`, se muestra la agenda y volver atrás no regresa a `#/inicio`

#### Scenario: Inicio anterior sin sesión
- **GIVEN** no hay sesión
- **WHEN** se navega a `#/inicio`
- **THEN** la ruta resultante es `#/login` y, tras un login exitoso, `#/agenda`

#### Scenario: Marcador antiguo al abrir la aplicación
- **GIVEN** una sesión que se restaura al arrancar
- **WHEN** la aplicación se abre con la URL `#/inicio`
- **THEN** la ruta resultante es `#/agenda`, la cantidad de entradas del historial no aumenta y la agenda se renderiza una sola vez

#### Scenario: Ruta con parámetro válido
- **GIVEN** una sesión activa con rol `ADMIN` o `PROFESIONAL`
- **WHEN** se navega a `#/pacientes/12/ficha`
- **THEN** se renderiza la página de ficha con el parámetro `id = 12`

#### Scenario: Parámetro inválido
- **GIVEN** una sesión activa
- **WHEN** se navega a `#/pacientes/abc`, `#/pacientes/-1`, `#/pacientes/0` o `#/pacientes/01`
- **THEN** la ruta resultante es `#/agenda` y no se envió ninguna request de pacientes ni de historia clínica

#### Scenario: Cambio de parámetro
- **GIVEN** se muestra `#/pacientes/1/ficha`
- **WHEN** se navega a `#/pacientes/2/ficha`
- **THEN** se libera la página anterior y se renderiza una nueva con `id = 2`

#### Scenario: Ruta exacta antes que parámetro
- **WHEN** se navega a `#/pacientes/nuevo`
- **THEN** se renderiza el alta de paciente

## ADDED Requirements

### Requirement: Navegación a pacientes
El menú principal SHALL incluir un ítem "Pacientes" que lleve a `#/pacientes`, visible para todos los roles, después de "Recordatorios" y antes de "Configuración". Las rutas `#/pacientes`, `#/pacientes/nuevo`, `#/pacientes/:id` y `#/pacientes/:id/ficha` MUST ser protegidas (sujetas al guard).

#### Scenario: Ítem de pacientes
- **GIVEN** una sesión activa
- **WHEN** se muestra el layout
- **THEN** la navegación principal contiene el enlace "Pacientes" a `#/pacientes`

#### Scenario: Ficha sin sesión
- **GIVEN** no hay sesión
- **WHEN** se navega a `#/pacientes/5/ficha`
- **THEN** la ruta resultante es `#/login` y no se envió ninguna request de ficha
