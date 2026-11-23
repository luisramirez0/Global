# authentication Specification

## Purpose

Permitir que un odontólogo dé de alta su consultorio e inicie sesión con email y contraseña, obteniendo un token de corta duración que identifica a su usuario, su consultorio y su rol, sin exponer credenciales ni datos personales.

## Requirements

### Requirement: Alta de consultorio y usuario
El backend SHALL exponer `POST /api/auth/register` público que, en una única operación, crea un consultorio, un usuario con rol `ADMIN`, un profesional vinculado a ese usuario y un sillón por defecto, y responde `201` con los ids del consultorio y del usuario, sin token. Si cualquiera de los pasos falla, MUST NOT quedar ninguno de esos registros.

#### Scenario: Registro exitoso
- **WHEN** se envía un registro válido con email `ana@consultorio.test`
- **THEN** la respuesta es `201` con `consultorioId` y `usuarioId`
- **AND** existen el consultorio, un usuario `ADMIN` con ese email, un profesional vinculado y un sillón, todos con el `consultorio_id` nuevo

#### Scenario: Email duplicado
- **GIVEN** ya existe un usuario con email `ana@consultorio.test`
- **WHEN** se registra `ANA@Consultorio.test`
- **THEN** la respuesta es `409` y no se crea ningún consultorio

#### Scenario: Datos inválidos
- **WHEN** se envía un registro con email mal formado o contraseña de menos de 8 caracteres
- **THEN** la respuesta es `400` indicando los campos inválidos, sin repetir sus valores

#### Scenario: Falla parcial revertida
- **GIVEN** la creación del usuario falla después de crear el consultorio
- **WHEN** termina el registro
- **THEN** no queda el consultorio ni ningún dependiente

### Requirement: Contraseñas con hash fuerte
Las contraseñas MUST almacenarse solo como hash BCrypt de costo 12 y MUST NOT aparecer en respuestas, logs ni en el token.

#### Scenario: Hash almacenado
- **WHEN** se registra un usuario con contraseña `Segura123!`
- **THEN** el hash guardado no contiene la contraseña y el codificador BCrypt la verifica

### Requirement: Inicio de sesión
El backend SHALL exponer `POST /api/auth/login` público que, con credenciales válidas de un usuario activo, responde `200` con un access token `Bearer`, su duración en segundos y los datos mínimos del usuario (id, nombre, rol) y del consultorio (id). Con email inexistente, contraseña incorrecta o usuario inactivo MUST responder `401` con el mismo mensaje genérico en los tres casos.

#### Scenario: Login exitoso
- **GIVEN** un usuario activo registrado
- **WHEN** inicia sesión con su email y contraseña
- **THEN** la respuesta es `200` con `tokenType = Bearer`, `expiresIn = 1800` y un token aceptado por las rutas protegidas
- **AND** se actualiza `ultimo_login`

#### Scenario: Credenciales inválidas indistinguibles
- **WHEN** se inicia sesión con un email inexistente, y luego con un email existente y contraseña incorrecta
- **THEN** ambas respuestas son `401` con el mismo cuerpo

#### Scenario: Usuario inactivo
- **GIVEN** un usuario con `activo = false`
- **WHEN** inicia sesión con credenciales correctas
- **THEN** la respuesta es `401`

### Requirement: Contenido y vigencia del token
El token SHALL estar firmado con HS256 usando `JWT_SECRET`, MUST contener solo el emisor, el id de usuario (`sub`), el id de consultorio (`cid`), el rol (`rol`), la emisión y el vencimiento a `JWT_EXPIRATION_MIN` minutos, y MUST NOT contener email, nombre ni datos de salud. Un token vencido, con firma inválida o de otro emisor MUST ser rechazado con `401`.

#### Scenario: Claims mínimos
- **WHEN** se decodifica un token emitido por el login
- **THEN** contiene `iss`, `sub`, `cid`, `rol`, `iat` y `exp`, y no contiene el email ni el nombre

#### Scenario: Token vencido
- **GIVEN** un token emitido hace 31 minutos con vencimiento a 30
- **WHEN** se usa en una ruta protegida
- **THEN** la respuesta es `401`

#### Scenario: Firma alterada
- **GIVEN** un token válido al que se le cambió el claim `cid`
- **WHEN** se usa en una ruta protegida
- **THEN** la respuesta es `401`

### Requirement: Límite de intentos de login
El backend MUST bloquear el login para una misma combinación de IP y email tras 5 intentos fallidos dentro de 15 minutos, respondiendo `429` con encabezado `Retry-After` hasta que la ventana libere intentos; un login exitoso MUST reiniciar el contador de esa combinación.

#### Scenario: Bloqueo tras 5 fallos
- **GIVEN** 5 logins fallidos para `ana@consultorio.test` desde la misma IP en 15 minutos
- **WHEN** se intenta un sexto login, aun con la contraseña correcta
- **THEN** la respuesta es `429` con `Retry-After`

#### Scenario: Ventana liberada
- **GIVEN** el bloqueo anterior
- **WHEN** pasan 15 minutos desde el primer fallo y se inicia sesión correctamente
- **THEN** la respuesta es `200`

### Requirement: Auditoría del inicio de sesión
Cada login de un usuario existente SHALL registrar en `audit_log` una entrada `LOGIN` del consultorio del usuario, con el id de usuario, la IP y el resultado (`ok` o `fallido`), sin email ni contraseña. Un login con email inexistente MUST NOT escribir en `audit_log` y solo deja un log de aplicación sin el email.

#### Scenario: Login exitoso auditado
- **WHEN** un usuario inicia sesión correctamente
- **THEN** existe una entrada `LOGIN` con su `usuario_id`, su `consultorio_id` y detalle `ok`

#### Scenario: Email inexistente sin PII en logs
- **WHEN** se intenta un login con `nadie@x.test`
- **THEN** no se escribe en `audit_log` y la salida de log no contiene `nadie@x.test`

### Requirement: Usuario en curso
El backend SHALL exponer `GET /api/auth/me` para cualquier usuario autenticado, devolviendo id, nombre, email y rol del usuario del token y id y nombre de su consultorio; si el usuario ya no existe o está inactivo MUST responder `401`.

#### Scenario: Datos del usuario en curso
- **GIVEN** un token del usuario U del consultorio A
- **WHEN** se consulta `GET /api/auth/me`
- **THEN** la respuesta es `200` con los datos de U y de A
