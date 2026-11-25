# Spec Delta

## Purpose

Permitir que los roles operativos recuerden sus turnos desde la SPA sin costo: listar los turnos pendientes de recordatorio, abrir el enlace `wa.me` generado por la API, enviar el recordatorio por email con estados y errores claros, y registrar la respuesta del paciente confirmando o cancelando el turno.

## ADDED Requirements

### Requirement: Cliente tipado de recordatorios
La SPA SHALL consumir los recordatorios solo por un cliente tipado y autenticado: `GET /turnos/{id}/recordatorio/whatsapp`, `POST /turnos/{id}/recordatorio/email` sin cuerpo y `GET /turnos/pendientes-recordatorio` con `fecha` `YYYY-MM-DD`, todos con `cache: 'no-store'`. Un id que no es entero positivo MUST rechazarse sin enviar la request.

#### Scenario: Sin caché del navegador
- **WHEN** se pide el enlace de WhatsApp, se envía el email o se piden los pendientes
- **THEN** la request sale con `cache: 'no-store'`, y los pedidos de los demás clientes no llevan la opción `cache`

#### Scenario: Pedido del enlace
- **WHEN** se pide el enlace de WhatsApp del turno 7
- **THEN** se envía `GET /turnos/7/recordatorio/whatsapp` con el token de la sesión y sin cuerpo

#### Scenario: Envío del email
- **WHEN** se pide el recordatorio por email del turno 7
- **THEN** se envía `POST /turnos/7/recordatorio/email` con el token de la sesión y sin cuerpo

#### Scenario: Pendientes de una fecha
- **WHEN** se piden los pendientes del `2026-11-26`
- **THEN** se envía `GET /turnos/pendientes-recordatorio?fecha=2026-11-26`

#### Scenario: Id inválido
- **WHEN** se pide un recordatorio con id `0` o `1.5`
- **THEN** la promesa se rechaza y no se envía ninguna request

### Requirement: Respuestas de recordatorios validadas
La SPA SHALL aceptar solo respuestas con la forma del contrato de C-09 (en los pendientes, `ultimoRecordatorio` es `null` o tiene `estado` `ERROR`, porque el backend excluye los turnos con `GENERADO`/`ENVIADO`); cualquier campo faltante, de tipo incorrecto, con estado o canal desconocido o con instante no ISO MUST tratarse como respuesta inesperada. El `enlace` MUST ser una URL `https:` de host exactamente `wa.me`.

#### Scenario: Enlace válido
- **GIVEN** la respuesta `{recordatorioId: 31, enlace: "https://wa.me/5491122334455?text=Recordatorio%3A", generadoEn: "2026-11-25T14:00:00Z"}`
- **WHEN** se decodifica
- **THEN** se obtiene el enlace tal cual con `recordatorioId` 31

#### Scenario: Enlace a otro destino
- **GIVEN** un `enlace` `javascript:alert(1)`, `http://wa.me/54911` o `https://wa.me.evil.com/54911`
- **WHEN** se decodifica
- **THEN** el resultado es un error de respuesta inesperada y no se muestra ningún enlace

#### Scenario: Pendiente con campos opcionales
- **GIVEN** un ítem de pendientes sin `ultimoRecordatorio` y otro con `ultimoRecordatorio` `{canal: "EMAIL", estado: "ERROR"}`
- **WHEN** se decodifican
- **THEN** el primero queda con `ultimoRecordatorio` nulo y el segundo con canal `EMAIL` y estado `ERROR`

#### Scenario: Pendiente mal formado
- **GIVEN** un ítem de pendientes con `tieneTelefono` ausente o con `estado` `DESCONOCIDO`
- **WHEN** se decodifica
- **THEN** el resultado es un error de respuesta inesperada

### Requirement: Página de recordatorios pendientes
La ruta protegida `#/recordatorios` SHALL listar, ordenados por inicio, los turnos pendientes de recordatorio de mañana en la zona del consultorio, con hora, paciente, profesional y estado. Un selector de fecha MUST permitir elegir otro día; una fecha inválida MUST marcarse sin pedir a la API.

#### Scenario: Carga inicial de mañana
- **GIVEN** la hora `2026-11-25T14:00:00Z` y un consultorio en `America/Argentina/Buenos_Aires`
- **WHEN** se abre `#/recordatorios`
- **THEN** se piden los pendientes con `fecha=2026-11-26` y el selector muestra `2026-11-26`

#### Scenario: Turnos listados
- **GIVEN** pendientes con inicios `2026-11-26T13:00:00Z` y `2026-11-26T15:30:00Z`
- **WHEN** se muestra la lista
- **THEN** aparecen en ese orden con las horas `10:00` y `12:30` y el nombre del paciente y del profesional

#### Scenario: Sin pendientes
- **GIVEN** la API devuelve una lista vacía
- **WHEN** se muestra la página
- **THEN** se lee "No hay turnos pendientes de recordatorio para esta fecha."

#### Scenario: Cambio de fecha
- **WHEN** se elige `2026-11-27` en el selector
- **THEN** se piden los pendientes con `fecha=2026-11-27`

#### Scenario: Respuesta tardía descartada
- **GIVEN** un pedido para `2026-11-26` todavía pendiente
- **WHEN** se elige `2026-11-27` y la respuesta del 26 llega después que la del 27
- **THEN** la lista muestra solo los turnos del 27

#### Scenario: Error de carga
- **GIVEN** la API responde un error de red al pedir los pendientes
- **WHEN** se muestra la página
- **THEN** se lee un mensaje fijo de conexión con un botón "Reintentar" y no se muestra una lista vacía

### Requirement: Último intento fallido visible
En la lista de pendientes `ultimoRecordatorio` solo puede ser `null` o un recordatorio en `ERROR`. Un pendiente con último recordatorio en `ERROR` SHALL indicarlo con un texto fijo junto al turno, sin mostrar el detalle técnico del error; con `null` no se muestra ningún aviso.

#### Scenario: Email fallido previo
- **GIVEN** un pendiente con `ultimoRecordatorio` `{canal: "EMAIL", estado: "ERROR"}`
- **WHEN** se muestra la lista
- **THEN** el turno muestra "El último envío por email falló."

#### Scenario: Sin intento previo
- **GIVEN** un pendiente con `ultimoRecordatorio` nulo
- **WHEN** se muestra la lista
- **THEN** el turno no muestra ningún aviso de recordatorio previo

### Requirement: Recordatorio por WhatsApp a pedido
El enlace de WhatsApp SHALL pedirse solo cuando la persona pulsa el botón "WhatsApp", nunca al renderizar ni al recargar, y como máximo una vez por pulsación mientras el pedido está en curso. Al recibirlo MUST mostrarse un enlace "Abrir WhatsApp" que abre `wa.me` en una pestaña nueva.

#### Scenario: Nada se pide al renderizar
- **WHEN** se muestra la lista de pendientes o el diálogo de un turno
- **THEN** no se envía ningún pedido de enlace de WhatsApp

#### Scenario: Apertura del enlace
- **GIVEN** un pendiente con `tieneTelefono` verdadero
- **WHEN** se pulsa "WhatsApp" y la API devuelve el enlace
- **THEN** aparece un enlace "Abrir WhatsApp" con `href` igual al enlace recibido, `target="_blank"` y `rel` que incluye `noopener` y `noreferrer`, recibe el foco y se anuncia "Enlace de WhatsApp listo."

#### Scenario: Doble clic
- **WHEN** se pulsa "WhatsApp" dos veces antes de que responda la API
- **THEN** se envía un solo pedido

#### Scenario: Recordatorio ya generado
- **GIVEN** un enlace ya generado para el turno
- **WHEN** se muestra el turno en la lista
- **THEN** el turno sigue visible con "Recordatorio por WhatsApp generado." hasta que la persona pulsa "Actualizar"

#### Scenario: Tiempo agotado al pedir el enlace
- **WHEN** el pedido de WhatsApp agota el tiempo de espera
- **THEN** se lee "No se recibió respuesta. Es posible que el enlace se haya generado; si volvés a intentarlo quedará otro registro." y el botón "WhatsApp" vuelve a estar habilitado

### Requirement: Paciente sin medio de contacto
El botón "WhatsApp" SHALL quedar deshabilitado con el aviso "El paciente no tiene teléfono cargado." cuando el turno no tiene teléfono, y "Email" con "El paciente no tiene email cargado." cuando no tiene email; el aviso MUST asociarse al botón por `aria-describedby`. Un `422` con campo `telefono` o `email` MUST producir el mismo estado.

#### Scenario: Sin teléfono en el listado
- **GIVEN** un pendiente con `tieneTelefono` falso
- **WHEN** se muestra la lista
- **THEN** su botón "WhatsApp" está deshabilitado, describe el aviso de teléfono y pulsarlo no envía ningún pedido

#### Scenario: Sin email en el listado
- **GIVEN** un pendiente con `tieneEmail` falso
- **WHEN** se muestra la lista
- **THEN** su botón "Email" está deshabilitado con el aviso de email

#### Scenario: 422 de teléfono
- **GIVEN** un turno cuyo teléfono no se conocía de antemano
- **WHEN** se pulsa "WhatsApp" y la API responde `422` con `errores[0].campo` `telefono`
- **THEN** el botón queda deshabilitado con el aviso de teléfono

### Requirement: Recordatorio por email con estado
Al pulsar "Email" la SPA SHALL enviar el recordatorio una sola vez por pulsación, marcar el botón como ocupado mientras dura el pedido y, ante un `201`, anunciar "Email enviado." y dejar "Email" de ese turno deshabilitado con "Recordatorio enviado por email." por el resto de la sesión (solo en memoria, también tras actualizar la lista y en la agenda).

#### Scenario: Envío exitoso
- **GIVEN** un pendiente con `tieneEmail` verdadero
- **WHEN** se pulsa "Email" y la API responde `201` con `estado` `ENVIADO`
- **THEN** se anuncia "Email enviado." en una región `role="status"` y el turno muestra "Recordatorio enviado por email."

#### Scenario: El envío exitoso sobrevive a Actualizar
- **GIVEN** el turno 7 con email enviado
- **WHEN** se pulsa "Actualizar" y la API vuelve a devolver el turno 7 como pendiente con `tieneEmail` verdadero
- **THEN** el botón "Email" del turno 7 sigue deshabilitado con "Recordatorio enviado por email." y `localStorage` y `sessionStorage` no guardan nada de ello

#### Scenario: Envío en curso
- **WHEN** se pulsa "Email" y la API todavía no respondió
- **THEN** el botón tiene `aria-busy="true"`, está deshabilitado y un segundo clic no envía otro pedido

### Requirement: Errores del recordatorio
Cada error de recordatorio SHALL mostrarse con un mensaje fijo según su causa (`409`, `404`, `502`, `503`, resultado incierto del email, tiempo agotado o red en WhatsApp), nunca con el `title` ni el `detail` del servidor. Ante un resultado incierto del email el mensaje MUST advertir que el correo pudo haber llegado y MUST NOT invitar a reenviarlo.

#### Scenario: Error del servidor de correo
- **WHEN** el envío por email responde `502`
- **THEN** se lee "No se pudo enviar el email. Probá más tarde o usá WhatsApp.", el botón "Email" vuelve a estar habilitado y el turno no queda marcado como envío sin confirmar

#### Scenario: Email no configurado
- **WHEN** el envío por email responde `503`
- **THEN** se lee "El envío de emails no está disponible en este momento." y no "Probá más tarde"

#### Scenario: Resultado incierto
- **WHEN** el envío por email responde `500`, agota el tiempo de espera o falla por red
- **THEN** se lee "No se pudo confirmar el envío. Es posible que el email ya le haya llegado al paciente: no lo reenvíes sin verificarlo.", el texto no contiene "reintentar" ni "Probá más tarde" y "WhatsApp" sigue habilitado

#### Scenario: Turno que cambió de estado
- **WHEN** el pedido de WhatsApp o de email responde `409`
- **THEN** se lee "El turno ya no admite recordatorios (cambió de estado)." y se ofrece "Actualizar"

#### Scenario: Mensaje sin texto del servidor
- **GIVEN** un `502` cuyo `title` es `Texto del servidor`
- **WHEN** se muestra el error
- **THEN** el texto visible no contiene `Texto del servidor`

### Requirement: Envío de email sin confirmar
Ante un `500`, tiempo agotado o error de red del email, la SPA SHALL marcar el turno en memoria como "envío sin confirmar" y MUST mantener su botón "Email" deshabilitado con el aviso "Envío por email sin confirmar: verificá con el paciente." (por `aria-describedby`), también tras actualizar la lista o desde la agenda. La marca MUST NOT usar `localStorage` ni `sessionStorage`; un `502` MUST NOT marcar el turno.

#### Scenario: Botón bloqueado tras resultado incierto
- **WHEN** el envío por email del turno 7 responde `500`
- **THEN** el botón "Email" del turno 7 queda deshabilitado con el aviso de envío sin confirmar y un clic no envía ningún pedido

#### Scenario: La marca sobrevive a Actualizar
- **GIVEN** el turno 7 marcado como envío sin confirmar
- **WHEN** se pulsa "Actualizar" y la API vuelve a devolver el turno 7 como pendiente con `tieneEmail` verdadero
- **THEN** el botón "Email" del turno 7 sigue deshabilitado con el aviso

#### Scenario: Marca compartida con la agenda
- **GIVEN** el turno 7 marcado como envío sin confirmar desde la página
- **WHEN** se abre el diálogo del turno 7 en la agenda
- **THEN** su botón "Email" está deshabilitado con el mismo aviso

#### Scenario: Sin almacenamiento del navegador
- **WHEN** un turno queda marcado como envío sin confirmar
- **THEN** `localStorage` y `sessionStorage` siguen vacíos

### Requirement: Confirmar o cancelar según la respuesta
Cada pendiente SHALL ofrecer "Confirmar" si está `PROGRAMADO` y "Cancelar" si está `PROGRAMADO` o `CONFIRMADO`. "Cancelar" MUST pedir un motivo obligatorio de hasta 255 bytes UTF-8 en un diálogo accesible. Tras el éxito se anuncia el resultado y el turno refleja su nuevo estado.

#### Scenario: Confirmar
- **GIVEN** un pendiente `PROGRAMADO`
- **WHEN** se pulsa "Confirmar"
- **THEN** se envía `PATCH /turnos/{id}/estado` con `{estado: "CONFIRMADO"}`, se anuncia "Turno confirmado." y el turno muestra el estado "Confirmado" sin "Confirmar"

#### Scenario: Cancelar con motivo
- **GIVEN** un pendiente `PROGRAMADO` o `CONFIRMADO`
- **WHEN** se pulsa "Cancelar", se escribe "No puede venir" y se confirma
- **THEN** se envía `{estado: "CANCELADO", motivoCancelacion: "No puede venir"}`, se anuncia "Turno cancelado." y el turno deja de ofrecer recordatorios

#### Scenario: Motivo vacío
- **WHEN** se confirma la cancelación con el motivo vacío o solo espacios
- **THEN** no se envía la request y el campo muestra "Indicá el motivo de la cancelación."

#### Scenario: Cambio de estado rechazado
- **WHEN** el cambio de estado responde `409`
- **THEN** se muestra un mensaje fijo y se ofrece "Actualizar", sin recargar la lista automáticamente

### Requirement: Recordatorios para todos los roles operativos
La página y las acciones de recordatorio SHALL estar disponibles para `ADMIN`, `PROFESIONAL` y `RECEPCION`. Un `403` MUST mostrar el mensaje fijo de falta de permiso.

#### Scenario: Recepción
- **GIVEN** una sesión `RECEPCION`
- **WHEN** abre `#/recordatorios`
- **THEN** ve la lista con los botones "WhatsApp", "Email", "Confirmar" y "Cancelar"

#### Scenario: Sin permiso
- **WHEN** cualquier pedido de recordatorio responde `403`
- **THEN** se lee "No tenés permiso para realizar esta acción."

### Requirement: Contenido y datos seguros en recordatorios
Todo texto de la API SHALL insertarse como texto, nunca como HTML. La SPA MUST NOT escribir en la consola, guardar en `localStorage`/`sessionStorage` ni en la URL el enlace, el teléfono, el email ni el nombre del paciente.

#### Scenario: Nombre malicioso
- **GIVEN** un pendiente con paciente de nombre `<img src=x onerror=alert(1)>`
- **WHEN** se muestra la lista
- **THEN** el nombre aparece como texto literal y el documento no contiene ningún `img`

#### Scenario: Nada en consola ni almacenamiento
- **WHEN** se genera un enlace de WhatsApp y falla un envío de email
- **THEN** `console` no recibe llamadas con el enlace ni el nombre, y `localStorage`, `sessionStorage` y `location.hash` no contienen el enlace

### Requirement: Accesibilidad de la página de recordatorios
La página SHALL tener un `h1` "Recordatorios" que recibe el foco al entrar, la lista como elementos de lista con un nombre accesible por turno (hora y paciente) en cada botón, y los resultados anunciados en una región `role="status"`; los errores de carga en `role="alert"`.

#### Scenario: Nombre de los botones
- **GIVEN** un pendiente de las `10:00` de Ana Pérez
- **WHEN** se muestra la lista
- **THEN** el botón "WhatsApp" tiene un nombre accesible que incluye `10:00` y `Pérez, Ana`

#### Scenario: Foco al entrar
- **WHEN** se navega a `#/recordatorios`
- **THEN** el foco queda en el `h1` "Recordatorios"
