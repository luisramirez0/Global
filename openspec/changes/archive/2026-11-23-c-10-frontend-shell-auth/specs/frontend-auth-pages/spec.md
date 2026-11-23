## ADDED Requirements

### Requirement: Formularios accesibles
Las páginas de login y registro SHALL tener cada campo con etiqueta asociada y `autocomplete` adecuado, MUST asociar cada error de campo al input con `aria-describedby` y `aria-invalid`, y MUST anunciar los errores generales en una región con `role="alert"`.

#### Scenario: Error de campo accesible
- **WHEN** se envía el login con el email vacío
- **THEN** el input de email tiene `aria-invalid="true"` y `aria-describedby` apunta al mensaje de error

### Requirement: Validación en el cliente
Antes de enviar, el formulario SHALL validar las mismas reglas que el backend: email obligatorio con formato válido y hasta 254 caracteres; contraseña obligatoria (en registro, al menos 8 caracteres y hasta 72 bytes UTF-8); en registro, nombre del consultorio obligatorio hasta 150, nombre y apellido obligatorios hasta 100 y matrícula opcional hasta 50. Si hay errores MUST NOT enviar la request.

#### Scenario: Contraseña corta en registro
- **WHEN** se intenta registrar con contraseña `1234567`
- **THEN** se muestra el error en el campo contraseña y no se envía ninguna request

#### Scenario: Contraseña de más de 72 bytes
- **WHEN** se intenta registrar con una contraseña de 40 caracteres `ñ` (80 bytes)
- **THEN** se muestra el error en el campo contraseña y no se envía ninguna request

### Requirement: Envío único y estado de carga
Mientras una request del formulario está en curso, el botón de envío SHALL estar deshabilitado y el formulario marcado como ocupado, y un segundo envío MUST ser ignorado.

#### Scenario: Doble clic
- **WHEN** se envía el login dos veces seguidas antes de que responda la API
- **THEN** se envía una sola request

### Requirement: Inicio de sesión
Con credenciales válidas, la página de login SHALL iniciar la sesión, obtener el perfil y navegar a `#/inicio`. Ante errores MUST mostrar un mensaje fijo según el tipo: credenciales inválidas (`401`), demasiados intentos con los minutos de espera redondeados hacia arriba cuando hay `Retry-After` (`429`), sin conexión (red o tiempo de espera) o error genérico (resto); y MUST vaciar el campo contraseña tras cualquier error.

#### Scenario: Login exitoso
- **WHEN** se envían credenciales válidas
- **THEN** hay sesión activa, el perfil está cargado y la ruta es `#/inicio`

#### Scenario: Credenciales inválidas
- **WHEN** la API responde `401`
- **THEN** se muestra "Email o contraseña incorrectos." y el campo contraseña queda vacío

#### Scenario: Demasiados intentos
- **WHEN** la API responde `429` con `Retry-After: 840`
- **THEN** se muestra un mensaje que pide esperar 14 minutos

### Requirement: Registro de consultorio
Con datos válidos, la página de registro SHALL crear la cuenta y luego iniciar sesión automáticamente con las mismas credenciales y navegar a `#/inicio`; si ese login falla MUST navegar a `#/login` con el aviso "Cuenta creada. Iniciá sesión.". Ante un `409` MUST mostrar que ya existe una cuenta con ese email, y ante un `400` MUST mostrar cada error en el campo indicado por `campo` (o en el resumen si el campo no existe en el formulario).

#### Scenario: Registro y acceso
- **WHEN** se registra un consultorio con datos válidos
- **THEN** se invoca `register`, luego `login` y `me`, y la ruta es `#/inicio`

#### Scenario: Email duplicado
- **WHEN** la API responde `409`
- **THEN** se muestra "Ya existe una cuenta con ese email." y no hay sesión

#### Scenario: Error de servidor por campo
- **WHEN** la API responde `400` con `errores: [{campo: "matricula", mensaje: "demasiado larga"}]`
- **THEN** el mensaje aparece asociado al campo matrícula

### Requirement: Credenciales fuera de logs
Las páginas y el cliente MUST NOT escribir en la consola, en la URL ni en almacenamiento del navegador el email, la contraseña, el token ni el cuerpo de las requests de autenticación.

#### Scenario: Consola limpia
- **GIVEN** la consola espiada en el test
- **WHEN** se completa un login fallido y uno exitoso
- **THEN** ninguna llamada a la consola contiene el email, la contraseña ni el token
