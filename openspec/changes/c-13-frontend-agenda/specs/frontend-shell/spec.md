## MODIFIED Requirements

### Requirement: Rutas por hash
La aplicación SHALL navegar con rutas en el fragmento de la URL (`#/login`, `#/registro`, `#/agenda`) y MUST reaccionar a los cambios de hash sin recargar la página. `#/agenda` es la ruta de inicio. La ruta anterior `#/inicio` MUST redirigirse de forma explícita (tabla de redirecciones del router, no por ser desconocida) a `#/agenda`, sujeta al guard y reemplazando la entrada del historial. Un hash vacío, `#/` o una ruta desconocida MUST seguir resolviéndose a `#/agenda` como hasta ahora.

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

### Requirement: Guard de rutas protegidas
Toda ruta no declarada pública SHALL requerir una sesión vigente; sin ella MUST redirigir a `#/login` sin renderizar la página protegida. Con sesión vigente, las rutas públicas de autenticación (`#/login`, `#/registro`) MUST redirigir a `#/agenda`. Las redirecciones MUST reemplazar la entrada del historial.

#### Scenario: Protegida sin sesión
- **GIVEN** no hay sesión
- **WHEN** se navega a `#/agenda`
- **THEN** la ruta resultante es `#/login` y la agenda no se renderizó ni pidió turnos

#### Scenario: Login con sesión
- **GIVEN** una sesión activa
- **WHEN** se navega a `#/login`
- **THEN** la ruta resultante es `#/agenda`

#### Scenario: Después de iniciar sesión
- **WHEN** el login es exitoso
- **THEN** la ruta resultante es `#/agenda`

### Requirement: Layout base
La aplicación SHALL renderizar un layout con encabezado (nombre del producto), navegación principal y región de contenido principal. Con sesión, el encabezado MUST mostrar el nombre del consultorio, el nombre del usuario y un botón "Cerrar sesión"; sin sesión MUST mostrar solo el nombre del producto. Los datos del perfil MUST mostrarse como texto literal.

#### Scenario: Encabezado con sesión
- **GIVEN** una sesión con usuario `Ana` y consultorio `Sonrisas`
- **WHEN** se muestra `#/agenda`
- **THEN** el encabezado contiene `Ana`, `Sonrisas` y el botón "Cerrar sesión"

#### Scenario: Nombre malicioso en el perfil
- **GIVEN** el consultorio se llama `<img src=x onerror=alert(1)>`
- **WHEN** se muestra el encabezado
- **THEN** se ve el texto literal y el documento no contiene elementos `img`

## ADDED Requirements

### Requirement: Navegación a la agenda
El menú principal SHALL incluir, como primer ítem, "Agenda" con enlace a `#/agenda`, visible para los tres roles (`ADMIN`, `PROFESIONAL`, `RECEPCION`). Las pantallas que hoy llevan "al inicio" tras una acción (login y registro exitosos) MUST llevar a `#/agenda`. El ítem "Configuración" MUST seguir presente y la navegación a `#/config/*` MUST seguir funcionando igual. El menú MUST NOT incluir un ítem "Inicio".

#### Scenario: Ítem de agenda
- **GIVEN** una sesión activa con rol `RECEPCION`
- **WHEN** se muestra el layout
- **THEN** la navegación principal contiene "Agenda" a `#/agenda` y "Configuración" a `#/config/sillones`, y no contiene "Inicio"

#### Scenario: Ida y vuelta a la configuración
- **GIVEN** una sesión activa en `#/agenda`
- **WHEN** se navega a "Configuración" y luego a "Agenda"
- **THEN** se muestra `#/config/sillones` y después la agenda, con el foco en su `h1`
