# appointment-reminders Specification

## Purpose

Permitir que un consultorio recuerde sus turnos a los pacientes sin costo: enlaces `wa.me` que el usuario abre a mano y emails por SMTP gratuito, con registro del recordatorio y su estado, listado de turnos pendientes de recordatorio, mensaje sin datos clínicos, permisos por rol, auditoría y aislamiento por consultorio.

## Requirements

### Requirement: Enlace de WhatsApp para un turno
El sistema SHALL devolver, para un turno recordable del consultorio en curso, un enlace `https://wa.me/<número>?text=<mensaje>` donde `<número>` son los dígitos del teléfono E.164 del paciente sin el signo `+`; el teléfono MUST cumplir E.164 con 8 a 15 dígitos (mismo criterio que C-05). La respuesta MUST ser `200` con el id del recordatorio registrado, el enlace y la fecha de generación.

#### Scenario: Enlace con teléfono E.164
- **GIVEN** un turno `PROGRAMADO` de un paciente con teléfono `+5491122334455`
- **WHEN** se pide el recordatorio de WhatsApp del turno
- **THEN** la respuesta es `200` con `recordatorioId`, `generadoEn` y un `enlace` que empieza con `https://wa.me/5491122334455?text=`

#### Scenario: Turno confirmado
- **GIVEN** un turno `CONFIRMADO` de un paciente con teléfono
- **WHEN** se pide el recordatorio de WhatsApp del turno
- **THEN** la respuesta es `200` con el enlace

### Requirement: Codificación del texto del enlace
El parámetro `text` del enlace MUST ser el mensaje codificado en UTF-8 con percent-encoding, de modo que el enlace no contenga espacios ni caracteres reservados sin codificar: el espacio MUST codificarse como `%20` (nunca `+`) y el salto de línea como `%0A`.

#### Scenario: Espacios y acentos
- **GIVEN** un mensaje que contiene `Pérez` y espacios
- **WHEN** se arma el enlace
- **THEN** el texto contiene `P%C3%A9rez`, cada espacio aparece como `%20` y el enlace no contiene `+` ni espacios

#### Scenario: Caracteres reservados
- **GIVEN** un mensaje con el nombre de consultorio `Sonrisa & Co #1`
- **WHEN** se arma el enlace
- **THEN** el texto contiene `Sonrisa%20%26%20Co%20%231` y el enlace tiene un único parámetro `text`

#### Scenario: Salto de línea
- **GIVEN** un texto con un salto de línea
- **WHEN** se codifica para el enlace
- **THEN** el salto de línea aparece como `%0A`

#### Scenario: Ida y vuelta
- **WHEN** se decodifica en UTF-8 el parámetro `text` de un enlace generado
- **THEN** se obtiene exactamente el mensaje original

### Requirement: Mensaje del recordatorio sin datos clínicos
El mensaje SHALL ser `Recordatorio: tiene un turno el {dd/MM/yyyy} a las {HH:mm} en {consultorio} con {profesional}.`, con fecha y hora del inicio en la zona horaria del consultorio y el profesional como nombre y apellido. El mensaje MUST NOT incluir el nombre del paciente, la prestación, notas ni ningún dato clínico.

#### Scenario: Hora en la zona del consultorio
- **GIVEN** un consultorio `Sonrisa` en `America/Argentina/Buenos_Aires` y un turno con inicio `2026-11-26T13:00:00Z` con la profesional Ana Pérez
- **WHEN** se arma el mensaje
- **THEN** el mensaje es `Recordatorio: tiene un turno el 26/11/2026 a las 10:00 en Sonrisa con Ana Pérez.`

#### Scenario: Cambio de fecha por zona horaria
- **GIVEN** un consultorio en `America/Argentina/Buenos_Aires` y un turno con inicio `2026-11-27T02:30:00Z`
- **WHEN** se arma el mensaje
- **THEN** el mensaje dice `el 26/11/2026 a las 23:30`

#### Scenario: Sin datos del paciente ni clínicos
- **GIVEN** un turno con notas, una prestación `Endodoncia` y un paciente `Juan Gómez`
- **WHEN** se arma el mensaje de WhatsApp o de email
- **THEN** el mensaje no contiene `Juan`, `Gómez`, `Endodoncia` ni el texto de las notas

### Requirement: Registro del recordatorio de WhatsApp
Cada enlace de WhatsApp devuelto SHALL registrar un recordatorio del turno con canal `WHATSAPP_LINK`, estado `GENERADO`, fecha de generación del reloj del sistema y sin fecha de envío. Pedir el enlace de nuevo MUST registrar otro recordatorio: la operación no es idempotente, porque el sistema no sabe si el mensaje se envió.

#### Scenario: Recordatorio GENERADO
- **WHEN** se pide el recordatorio de WhatsApp de un turno
- **THEN** existe un recordatorio del turno con canal `WHATSAPP_LINK`, estado `GENERADO`, `generadoEn` igual a la hora del reloj y `enviadoEn` vacío, cuyo id es el `recordatorioId` de la respuesta

#### Scenario: Pedido repetido
- **WHEN** se pide dos veces el recordatorio de WhatsApp del mismo turno
- **THEN** existen dos recordatorios `GENERADO` del turno con ids distintos

### Requirement: Solo turnos recordables
El sistema MUST generar o enviar recordatorios solo para turnos en estado `PROGRAMADO` o `CONFIRMADO`. Un turno en otro estado MUST responder `409` genérico sin registrar recordatorio.

#### Scenario: Turno no recordable
- **GIVEN** un turno en estado `CANCELADO`, `ASISTIO` o `AUSENTE`
- **WHEN** se pide el recordatorio de WhatsApp o de email del turno
- **THEN** la respuesta es `409` y no se registra ningún recordatorio

#### Scenario: Turno inexistente
- **WHEN** se pide el recordatorio de un id de turno inexistente
- **THEN** la respuesta es `404` y no se registra ningún recordatorio

### Requirement: Paciente sin medio de contacto
El sistema MUST rechazar con `422` el recordatorio de WhatsApp de un paciente sin teléfono y el de email de un paciente sin email, con `errores[{campo}]` igual a `telefono` o `email`, sin registrar recordatorio. Ninguna respuesta de error MUST incluir el teléfono, el email ni el nombre del paciente.

#### Scenario: Sin teléfono
- **GIVEN** un turno `PROGRAMADO` de un paciente sin teléfono
- **WHEN** se pide el recordatorio de WhatsApp
- **THEN** la respuesta es `422` con `errores[0].campo` `telefono` y no se registra recordatorio

#### Scenario: Sin email
- **GIVEN** un turno `PROGRAMADO` de un paciente sin email
- **WHEN** se pide el recordatorio por email
- **THEN** la respuesta es `422` con `errores[0].campo` `email`, no se intenta ningún envío y no se registra recordatorio

#### Scenario: Error sin datos personales
- **WHEN** cualquier pedido de recordatorio termina en error
- **THEN** el cuerpo de la respuesta no contiene el teléfono, el email, el nombre ni el apellido del paciente

### Requirement: Recordatorio por email
El sistema SHALL enviar por SMTP el mensaje del recordatorio al email del paciente de un turno recordable, desde la dirección remitente configurada. Si el envío se acepta, MUST registrar un recordatorio con canal `EMAIL`, estado `ENVIADO` y fecha de envío, y responder `201` con `recordatorioId`, `estado` y `enviadoEn`.

#### Scenario: Envío exitoso
- **GIVEN** un turno `CONFIRMADO` de un paciente con email
- **WHEN** se pide el recordatorio por email
- **THEN** se envía un email al paciente con el mensaje del recordatorio, la respuesta es `201` con `estado` `ENVIADO` y existe un recordatorio `EMAIL` `ENVIADO` con `enviadoEn`

#### Scenario: Envío repetido
- **WHEN** se pide dos veces el recordatorio por email del mismo turno
- **THEN** se envían dos emails y existen dos recordatorios `ENVIADO`

### Requirement: Falla del servidor SMTP
Si el envío SMTP falla, el sistema MUST registrar un recordatorio `EMAIL` en estado `ERROR` con un código de error fijo en `detalle_error` (sin el mensaje técnico, direcciones ni datos personales, como máximo 500 caracteres) y responder `502` `ProblemDetail` genérico sin datos del cliente ni causa técnica. `502` se reserva solo para fallas al intentar enviar o comunicarse con el servidor SMTP.

#### Scenario: SMTP caído
- **GIVEN** un turno `PROGRAMADO` de un paciente con email y un servidor SMTP que rechaza la conexión
- **WHEN** se pide el recordatorio por email
- **THEN** la respuesta es `502` y existe un recordatorio `EMAIL` en estado `ERROR`, sin `enviadoEn` y con `detalle_error` igual a un código fijo como `SMTP_FALLO:MailSendException`

#### Scenario: Detalle de error sin datos personales
- **GIVEN** una falla SMTP cuyo mensaje técnico contiene el email del paciente
- **WHEN** se registra el recordatorio `ERROR`
- **THEN** `detalle_error` y el cuerpo de la respuesta no contienen el email, el teléfono ni el nombre del paciente ni el mensaje técnico

#### Scenario: Envío sin transacción abierta
- **WHEN** se ejecuta el envío SMTP de un recordatorio
- **THEN** no hay ninguna transacción de base de datos activa durante el envío

### Requirement: SMTP no configurado
Si falta `SMTP_HOST` o `SMTP_FROM`, el sistema MUST registrar el recordatorio `EMAIL` en estado `ERROR` con `detalle_error` `SMTP_NO_CONFIGURADO` sin intentar conectar y responder `503` `ProblemDetail` genérico, sin exponer detalles internos.

#### Scenario: SMTP no configurado
- **GIVEN** un turno `PROGRAMADO` de un paciente con email y `SMTP_HOST` o `SMTP_FROM` sin definir
- **WHEN** se pide el recordatorio por email
- **THEN** la respuesta es `503` genérica (no `502`), existe un recordatorio `EMAIL` en estado `ERROR`, sin `enviadoEn` y con `detalle_error` igual a `SMTP_NO_CONFIGURADO`, no se intenta ninguna conexión SMTP y ni el cuerpo ni el detalle contienen el email, el teléfono ni el nombre del paciente

### Requirement: Turnos pendientes de recordatorio
El sistema SHALL listar los turnos `PROGRAMADO` o `CONFIRMADO` del consultorio en curso cuyo inicio cae en la fecha local pedida (zona del consultorio) y que no tienen recordatorio `GENERADO` ni `ENVIADO`, ordenados por inicio. Cada ítem MUST incluir turno, inicio, fin, estado, paciente y profesional (id, nombre, apellido), `tieneTelefono`, `tieneEmail` y, si existe, el último recordatorio.

#### Scenario: Turno sin recordatorio
- **GIVEN** un turno `PROGRAMADO` el 26/11/2026 a las 10:00 local sin recordatorios
- **WHEN** se piden los pendientes con `fecha=2026-11-26`
- **THEN** el turno aparece con `tieneTelefono`, `tieneEmail` y sin `ultimoRecordatorio`, y la respuesta no incluye teléfono ni email

#### Scenario: Recordatorio ya hecho
- **GIVEN** dos turnos del 26/11/2026, uno con un recordatorio `GENERADO` y otro con uno `ENVIADO`
- **WHEN** se piden los pendientes con `fecha=2026-11-26`
- **THEN** ninguno de los dos aparece

#### Scenario: Solo recordatorio con error
- **GIVEN** un turno del 26/11/2026 cuyo único recordatorio quedó en `ERROR`
- **WHEN** se piden los pendientes con `fecha=2026-11-26`
- **THEN** el turno aparece con `ultimoRecordatorio` de canal `EMAIL` y estado `ERROR`

#### Scenario: Estados excluidos
- **GIVEN** turnos `CANCELADO`, `ASISTIO` y `AUSENTE` del 26/11/2026 sin recordatorios
- **WHEN** se piden los pendientes con `fecha=2026-11-26`
- **THEN** ninguno aparece

#### Scenario: Borde del día en UTC
- **GIVEN** un consultorio en `America/Argentina/Buenos_Aires`, un turno con inicio `2026-11-26T02:30:00Z` (25/11 23:30 local) y otro con inicio `2026-11-27T02:30:00Z` (26/11 23:30 local)
- **WHEN** se piden los pendientes con `fecha=2026-11-26`
- **THEN** aparece solo el segundo turno

#### Scenario: Fecha por defecto
- **GIVEN** el reloj en `2026-11-25T14:00:00Z` y un consultorio en `America/Argentina/Buenos_Aires`
- **WHEN** se piden los pendientes sin `fecha`
- **THEN** se listan los pendientes del 26/11/2026 local

#### Scenario: Fecha inválida
- **WHEN** se piden los pendientes con `fecha=2026-13-40` o `fecha=mañana`
- **THEN** la respuesta es `400` sin eco del valor enviado

#### Scenario: Ruta literal frente a id de turno
- **WHEN** se pide `GET /api/turnos/pendientes-recordatorio`
- **THEN** responde el listado de pendientes y no la consulta de un turno por id

### Requirement: Permisos de recordatorios
Los tres endpoints de recordatorios SHALL admitir los roles `ADMIN`, `PROFESIONAL` y `RECEPCION`, y MUST responder `401` sin token o con token inválido.

#### Scenario: Roles operativos
- **WHEN** un usuario `ADMIN`, `PROFESIONAL` o `RECEPCION` pide el enlace de WhatsApp, el email o los pendientes
- **THEN** la operación se permite

#### Scenario: Sin autenticación
- **WHEN** se llama a cualquiera de los tres endpoints sin token
- **THEN** la respuesta es `401` y no se registra recordatorio

### Requirement: Aislamiento de recordatorios por consultorio
El sistema MUST operar solo sobre turnos y recordatorios del consultorio del token. Un turno de otro consultorio MUST responder `404` indistinguible de uno inexistente, sin registrar recordatorio ni enviar email, y el listado de pendientes MUST NOT incluir turnos de otro consultorio.

#### Scenario: Turno ajeno
- **GIVEN** un turno del consultorio B
- **WHEN** un usuario del consultorio A pide su recordatorio de WhatsApp o de email
- **THEN** la respuesta es `404`, no se envía email y no se registra recordatorio en ningún consultorio

#### Scenario: Pendientes de otro consultorio
- **GIVEN** turnos pendientes del 26/11/2026 en A y en B
- **WHEN** un usuario de A pide los pendientes con `fecha=2026-11-26`
- **THEN** solo aparecen turnos de A

#### Scenario: Recordatorio de B no oculta un turno de A
- **GIVEN** un recordatorio `GENERADO` registrado en B
- **WHEN** un usuario de A pide los pendientes
- **THEN** el resultado de A no se ve afectado por los recordatorios de B

### Requirement: Auditoría de recordatorios
Cada recordatorio persistido (`GENERADO`, `ENVIADO` o `ERROR`) SHALL registrar una entrada de auditoría `CREATE` de entidad `Recordatorio` con el id del recordatorio y un detalle con solo `canal` y `estado`, confirmada junto con el recordatorio. El detalle MUST NOT contener teléfono, email, nombre, mensaje ni enlace. Las consultas de pendientes MUST NOT auditarse.

#### Scenario: Auditoría del enlace de WhatsApp
- **WHEN** se genera un recordatorio de WhatsApp
- **THEN** existe una entrada `CREATE` `Recordatorio` con el `recordatorioId` y detalle `{canal: WHATSAPP_LINK, estado: GENERADO}`

#### Scenario: Auditoría del email con error
- **WHEN** un envío de email falla y se registra el recordatorio `ERROR`
- **THEN** existe una entrada `CREATE` `Recordatorio` con detalle `{canal: EMAIL, estado: ERROR}`

#### Scenario: Rechazos sin auditoría
- **WHEN** un pedido de recordatorio termina en `404`, `409` o `422`, o se consultan los pendientes
- **THEN** no se agrega ninguna entrada de auditoría

### Requirement: Logs sin datos personales
Los logs de la aplicación generados por los recordatorios MUST contener solo identificadores y el nombre simple de la clase de excepción; MUST NOT contener teléfono, email, nombre del paciente, el mensaje, el enlace, credenciales SMTP ni el mensaje técnico de la falla.

#### Scenario: Logs del envío fallido
- **GIVEN** una falla SMTP cuyo mensaje técnico contiene el email del paciente
- **WHEN** se procesa el recordatorio por email
- **THEN** la salida de log no contiene el email, el teléfono, el nombre del paciente ni el texto del mensaje

#### Scenario: Logs del enlace
- **WHEN** se genera un recordatorio de WhatsApp
- **THEN** la salida de log no contiene el teléfono, el enlace ni el texto del mensaje
