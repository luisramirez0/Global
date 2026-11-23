## ADDED Requirements

### Requirement: Inicio de sesión en el cliente
Tras un login exitoso, la sesión SHALL guardar el token y su vencimiento calculado como el instante actual más `expiresIn` segundos, y MUST persistir en `sessionStorage` únicamente el token y el vencimiento, nunca nombre, email ni otros datos personales. La sesión MUST NOT usar `localStorage`.

#### Scenario: Datos persistidos mínimos
- **GIVEN** el reloj en `T`
- **WHEN** se inicia sesión con `expiresIn = 1800`
- **THEN** `sessionStorage` contiene solo el token y el vencimiento `T + 1800 s`
- **AND** `localStorage` está vacío

### Requirement: Perfil del usuario en memoria
El perfil del usuario y del consultorio en curso SHALL obtenerse con `GET /api/auth/me` al iniciar sesión y al restaurar una sesión, y MUST mantenerse solo en memoria.

#### Scenario: Perfil tras recargar
- **GIVEN** una sesión vigente guardada en `sessionStorage`
- **WHEN** se recarga la aplicación
- **THEN** se invoca `me()` y el perfil queda disponible sin haberse leído del almacenamiento

### Requirement: Restauración segura
Al arrancar, la sesión SHALL restaurarse desde `sessionStorage` solo si los datos tienen la forma esperada y no están vencidos; en cualquier otro caso MUST borrar la clave y quedar sin sesión.

#### Scenario: Datos corruptos
- **GIVEN** la clave de sesión contiene texto que no es JSON válido
- **WHEN** arranca la aplicación
- **THEN** no hay sesión y la clave fue eliminada

#### Scenario: Token vencido guardado
- **GIVEN** una sesión guardada con vencimiento anterior al reloj actual
- **WHEN** arranca la aplicación
- **THEN** no hay sesión

### Requirement: Vencimiento del token
La sesión SHALL considerarse vencida 30 segundos antes del vencimiento calculado; a partir de ese momento MUST dejar de entregar el token y MUST cerrarse con motivo `expired`, aunque la pestaña haya estado inactiva.

#### Scenario: Cierre automático
- **GIVEN** una sesión iniciada con `expiresIn = 1800`
- **WHEN** pasan 1770 segundos
- **THEN** la sesión se cierra con motivo `expired` y la aplicación muestra el login con el aviso de sesión vencida

#### Scenario: Token no entregado tras vencer
- **GIVEN** una sesión cuyo vencimiento ya pasó sin que corriera el temporizador
- **WHEN** el cliente pide el token
- **THEN** no obtiene token y la sesión se cierra

### Requirement: Cierre de sesión
Cerrar la sesión (por el usuario, por vencimiento o por un `401`) SHALL borrar el token del almacenamiento, el perfil de memoria y el temporizador, notificar a los suscriptores con el motivo y llevar a la página de login. El cierre por el usuario MUST NOT requerir una llamada al servidor.

#### Scenario: Cerrar sesión
- **GIVEN** una sesión activa
- **WHEN** el usuario pulsa "Cerrar sesión"
- **THEN** `sessionStorage` no contiene la clave de sesión, el perfil está vacío y la ruta es `#/login`
- **AND** no se envió ninguna request

#### Scenario: Volver atrás tras cerrar sesión
- **GIVEN** el usuario cerró sesión desde `#/inicio`
- **WHEN** navega hacia atrás
- **THEN** el guard lo redirige a `#/login`
