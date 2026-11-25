# frontend-shell Specification

## Purpose

Estructurar la aplicación con rutas por hash, un guard que protege las pantallas que requieren sesión, un layout base común y navegación accesible.

## Requirements

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

### Requirement: Accesibilidad de la navegación
En cada cambio de ruta la aplicación SHALL actualizar el título del documento con el nombre de la página y MUST mover el foco al encabezado principal de la página. El layout MUST ofrecer un enlace para saltar al contenido principal y una navegación etiquetada.

#### Scenario: Foco tras navegar
- **WHEN** se navega de `#/login` a `#/registro`
- **THEN** `document.title` incluye "Registro" y el elemento con foco es el `h1` de la página

### Requirement: Arranque con sesión restaurada
Si al arrancar hay una sesión vigente, la aplicación SHALL obtener el perfil con `me()` antes de renderizar rutas protegidas, mostrando un estado de carga mientras tanto. Si `me()` falla por red o tiempo de espera MUST ofrecer reintentar sin cerrar la sesión; si falla con `401` MUST cerrar la sesión y mostrar el login.

#### Scenario: Backend caído al recargar
- **GIVEN** una sesión vigente y la API inaccesible
- **WHEN** se recarga en `#/inicio`
- **THEN** se muestra un mensaje de error de conexión con un botón "Reintentar" y la sesión sigue guardada

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
