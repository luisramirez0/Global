# frontend-shell Specification

## Purpose

Estructurar la aplicación con rutas por hash, un guard que protege las pantallas que requieren sesión, un layout base común y navegación accesible.

## Requirements

### Requirement: Rutas por hash
La aplicación SHALL navegar con rutas en el fragmento de la URL (`#/login`, `#/registro`, `#/inicio`) y MUST reaccionar a los cambios de hash sin recargar la página. Un hash vacío, `#/` o una ruta desconocida MUST resolverse a `#/inicio` (sujeto al guard).

#### Scenario: Ruta desconocida
- **GIVEN** una sesión activa
- **WHEN** se navega a `#/no-existe`
- **THEN** la ruta resultante es `#/inicio`

### Requirement: Guard de rutas protegidas
Toda ruta no declarada pública SHALL requerir una sesión vigente; sin ella MUST redirigir a `#/login` sin renderizar la página protegida. Con sesión vigente, las rutas públicas de autenticación (`#/login`, `#/registro`) MUST redirigir a `#/inicio`. Las redirecciones MUST reemplazar la entrada del historial.

#### Scenario: Protegida sin sesión
- **GIVEN** no hay sesión
- **WHEN** se navega a `#/inicio`
- **THEN** la ruta resultante es `#/login` y la página de inicio no se renderizó

#### Scenario: Login con sesión
- **GIVEN** una sesión activa
- **WHEN** se navega a `#/login`
- **THEN** la ruta resultante es `#/inicio`

### Requirement: Layout base
La aplicación SHALL renderizar un layout con encabezado (nombre del producto), navegación principal y región de contenido principal. Con sesión, el encabezado MUST mostrar el nombre del consultorio, el nombre del usuario y un botón "Cerrar sesión"; sin sesión MUST mostrar solo el nombre del producto. Los datos del perfil MUST mostrarse como texto literal.

#### Scenario: Encabezado con sesión
- **GIVEN** una sesión con usuario `Ana` y consultorio `Sonrisas`
- **WHEN** se muestra `#/inicio`
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
