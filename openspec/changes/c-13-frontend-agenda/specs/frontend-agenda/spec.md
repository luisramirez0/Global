## ADDED Requirements

### Requirement: Cliente tipado de turnos
El frontend SHALL exponer un cliente tipado de `/turnos` sobre el cliente HTTP autenticado: listar por rango (`desde` y `hasta` como instantes UTC, con `sillonId` e `incluirCancelados` opcionales), obtener por id, crear, cambiar estado y reprogramar, con el contrato de C-07. Cada respuesta MUST validarse con un decodificador; una forma inesperada (estado desconocido, instante no ISO, paciente o prestación faltante) MUST producir `unexpected`.

#### Scenario: Listado de un rango
- **WHEN** se listan los turnos de `2026-11-24T03:00:00Z` a `2026-11-25T03:00:00Z` incluyendo cancelados
- **THEN** se envía `GET /turnos?desde=2026-11-24T03:00:00Z&hasta=2026-11-25T03:00:00Z&incluirCancelados=true` con el token y se obtienen los turnos decodificados

#### Scenario: Estado desconocido
- **WHEN** la API devuelve un turno con `estado: "REABIERTO"`
- **THEN** el cliente rechaza con un error `unexpected`

### Requirement: Cuerpos e ids de las requests de turnos
Los ids de ruta de turnos SHALL ser enteros positivos y un id inválido MUST fallar sin enviar la request. Los campos opcionales sin valor (`profesionalId`, `sobreturno`, `notas`, `motivoCancelacion`, `sillonId` al reprogramar) MUST omitirse del cuerpo.

#### Scenario: Alta sin campos opcionales
- **WHEN** se crea un turno con paciente 7, prestación 2, sillón 1 e inicio `2026-11-24T13:00:00Z`
- **THEN** se envía `POST /turnos` con exactamente `{pacienteId: 7, prestacionId: 2, sillonId: 1, inicio: "2026-11-24T13:00:00Z"}`

#### Scenario: Id inválido
- **WHEN** se pide cambiar el estado del turno con id `0`
- **THEN** la operación falla con error de programación y no se envía ninguna request

### Requirement: Página de agenda con vistas diaria y semanal
La aplicación SHALL ofrecer la ruta protegida `#/agenda` con un `h1` y un selector de vista "Día"/"Semana". La vista diaria MUST mostrar una columna por sillón para la fecha elegida; la vista semanal MUST mostrar una columna por día, de lunes a domingo, de la semana que contiene la fecha elegida. Al abrir, la fecha MUST ser hoy en la zona del consultorio.

#### Scenario: Vista diaria por sillón
- **GIVEN** los sillones activos `Sillón 1` y `Sillón 2` y un turno en cada uno el 2026-11-24
- **WHEN** se abre `#/agenda` el 2026-11-24 en la vista "Día"
- **THEN** se ven dos columnas encabezadas `Sillón 1` y `Sillón 2`, cada una con su turno

#### Scenario: Vista semanal
- **GIVEN** la fecha elegida es el miércoles 2026-11-25
- **WHEN** se cambia a la vista "Semana"
- **THEN** se ven siete columnas del lunes 23/11 al domingo 29/11 y se pide el rango de esa semana

### Requirement: Navegación de fechas y estados de carga
La agenda SHALL ofrecer "Anterior", "Hoy" y "Siguiente", que mueven un día o una semana según la vista, y mostrar el rango visible como texto. La página MUST mostrar un estado de carga, un aviso cuando el rango no tiene turnos y, si la carga falla, un mensaje fijo con un botón "Reintentar".

#### Scenario: Navegación de fechas
- **GIVEN** la vista "Día" en 2026-11-24
- **WHEN** se pulsa "Siguiente"
- **THEN** el rango visible pasa a 2026-11-25 y se piden los turnos de ese día

#### Scenario: Rango sin turnos
- **WHEN** la API devuelve una lista vacía
- **THEN** se muestra la grilla vacía y un aviso "No hay turnos en este rango."

#### Scenario: Error al cargar
- **WHEN** la carga de turnos falla por red
- **THEN** se muestra un mensaje de conexión y un botón "Reintentar" que vuelve a pedir el mismo rango

### Requirement: Filtro de sillón y turnos cancelados
La agenda SHALL ofrecer un filtro de sillón ("Todos" o un sillón) que se aplique a ambas vistas y un interruptor "Mostrar cancelados", apagado por defecto. Con el interruptor apagado los turnos `CANCELADO` MUST NOT mostrarse; encendido MUST mostrarse con su estado. Los sillones del filtro y las columnas MUST incluir todo sillón referido por un turno del rango aunque esté inactivo, para que ningún turno quede sin columna.

#### Scenario: Filtro por sillón
- **GIVEN** turnos en `Sillón 1` y `Sillón 2`
- **WHEN** se elige `Sillón 2` en el filtro
- **THEN** solo se muestran los turnos del `Sillón 2` y la request lleva `sillonId=2`

#### Scenario: Cancelados ocultos por defecto
- **GIVEN** un turno `CANCELADO` en el rango
- **WHEN** se abre la agenda
- **THEN** ese turno no se muestra y la request no pide cancelados

#### Scenario: Mostrar cancelados
- **WHEN** se enciende "Mostrar cancelados"
- **THEN** se piden los turnos con `incluirCancelados=true` y el turno cancelado se ve con la etiqueta "Cancelado"

#### Scenario: Turno en un sillón inactivo
- **GIVEN** un turno del rango en el sillón 3, que está inactivo
- **WHEN** se muestra la vista diaria
- **THEN** existe una columna para el sillón 3 con ese turno

### Requirement: Zona horaria del consultorio
Las fechas y horas de la agenda SHALL mostrarse y elegirse en la zona del consultorio (`America/Argentina/Buenos_Aires`) y MUST viajar a la API como instantes UTC, con un resultado independiente de la zona horaria del entorno donde corre el navegador. El rango de un día MUST ser `[00:00 del día, 00:00 del día siguiente)` en la zona del consultorio; el de una semana, `[00:00 del lunes, 00:00 del lunes siguiente)`. "Hoy" MUST calcularse con el reloj actual en la zona del consultorio.

#### Scenario: Rango de un día
- **WHEN** se muestra el día 2026-11-24
- **THEN** se piden turnos con `desde=2026-11-24T03:00:00Z` y `hasta=2026-11-25T03:00:00Z`

#### Scenario: Turno de la noche
- **GIVEN** un turno con inicio `2026-11-25T01:30:00Z`
- **WHEN** se muestra la agenda del 2026-11-24
- **THEN** el turno aparece el 24/11 a las 22:30

#### Scenario: Navegador en otra zona
- **GIVEN** el entorno corre en `Asia/Tokyo`
- **WHEN** se muestra el día 2026-11-24
- **THEN** el rango pedido y la hora mostrada de cada turno son los mismos que en Argentina

#### Scenario: Hoy cerca de medianoche
- **GIVEN** el reloj marca `2026-11-25T02:30:00Z` (23:30 del 24/11 en Argentina)
- **WHEN** se abre la agenda o se pulsa "Hoy"
- **THEN** la fecha mostrada es el 2026-11-24

### Requirement: Estado por color y etiqueta
Cada turno SHALL mostrar el nombre y apellido del paciente, la prestación, la hora de inicio y fin y una etiqueta de texto visible con su estado ("Programado", "Confirmado", "Cancelado", "Asistió", "Ausente"), además de un color propio de cada estado. El color MUST NOT ser la única señal del estado. Un turno con `sobreturno: true` MUST mostrar además la marca de texto "Sobreturno".

#### Scenario: Etiqueta de estado
- **GIVEN** un turno `CONFIRMADO`
- **WHEN** se muestra en la agenda
- **THEN** el bloque contiene el texto "Confirmado" y tiene la marca de color de ese estado

#### Scenario: Marca de sobreturno
- **GIVEN** un turno `PROGRAMADO` con `sobreturno: true`
- **WHEN** se muestra en la agenda
- **THEN** el bloque contiene "Programado" y "Sobreturno"

### Requirement: Posición por duración en una grilla configurable
En la grilla cada turno SHALL ocupar desde la fila de su inicio y tantas filas como su duración (`fin - inicio`) dividida por la granularidad de la grilla. La granularidad MUST ser un parámetro provisional (hoy 15 minutos, PA-03 sin validar), único para la configuración y la agenda, y no una regla fija del cálculo.

#### Scenario: Turno de 30 minutos con grilla de 15
- **GIVEN** la franja visible empieza a las 08:00 y la grilla es de 15 minutos
- **WHEN** se muestra un turno de 09:00 a 09:30
- **THEN** el turno empieza en la quinta fila de la franja y ocupa dos filas

#### Scenario: Otra granularidad
- **GIVEN** la franja visible empieza a las 08:00 y la grilla es de 10 minutos
- **WHEN** se muestra un turno de 09:00 a 09:30
- **THEN** el turno empieza en la séptima fila y ocupa tres filas

### Requirement: Turnos no alineados y superpuestos
Un turno cuyo inicio o duración no estén alineados a la grilla SHALL mostrarse igual, ocupando las filas que lo cubren (redondeo hacia afuera), como mínimo una, y con su hora real. Los turnos que se superponen en una misma columna (por ejemplo un cancelado visible y el turno que tomó su lugar) MUST mostrarse lado a lado sin taparse.

#### Scenario: Turno no alineado
- **GIVEN** la grilla es de 15 minutos
- **WHEN** se muestra un sobreturno de 09:10 a 09:20
- **THEN** el turno ocupa la fila de 09:00 a 09:15 y la de 09:15 a 09:30, y se ve con su hora real 09:10–09:20

#### Scenario: Turnos superpuestos en una columna
- **GIVEN** "Mostrar cancelados" encendido, un turno cancelado y otro programado en el mismo sillón de 10:00 a 10:30
- **WHEN** se muestra la vista diaria
- **THEN** ambos bloques son visibles en la columna, uno al lado del otro

### Requirement: Franja visible y turnos fuera de horario
La franja horaria visible SHALL ir desde la menor hora de inicio hasta la mayor hora de fin de los horarios de atención configurados (08:00–20:00 si no hay ninguno), ajustada a la grilla. La franja MUST ampliarse para incluir cada turno del rango que empiece antes o termine después de ella (sobreturnos fuera de horario, horarios que cambiaron después de agendar, turnos de la noche), de modo que ningún turno desaparezca ni quede inaccesible.

#### Scenario: Franja según horarios
- **GIVEN** horarios de 09:00 a 13:00 y de 14:00 a 18:00 y ningún turno fuera de ellos
- **WHEN** se muestra la vista diaria
- **THEN** la grilla va de 09:00 a 18:00

#### Scenario: Sin horarios configurados
- **GIVEN** no hay horarios de atención
- **WHEN** se muestra la vista diaria
- **THEN** la grilla va de 08:00 a 20:00

#### Scenario: Sobreturno fuera de horario
- **GIVEN** horarios de 09:00 a 18:00 y un sobreturno de 19:00 a 19:45
- **WHEN** se muestra ese día
- **THEN** la grilla se extiende hasta las 19:45 y el sobreturno se ve con sus acciones

### Requirement: Turnos que cruzan la medianoche
Un turno que cruza la medianoche en la zona del consultorio SHALL mostrarse en cada día que toca, recortado a ese día e indicando "Continúa" o "Viene del día anterior".

#### Scenario: Turno que cruza la medianoche
- **GIVEN** un sobreturno del 24/11 23:30 al 25/11 00:30 en hora del consultorio
- **WHEN** se muestran el 24/11 y luego el 25/11
- **THEN** el 24/11 se ve de 23:30 a 24:00 marcado "Continúa" y el 25/11 de 00:00 a 00:30 marcado "Viene del día anterior"

### Requirement: Bloqueos en la agenda
Los bloqueos del rango SHALL mostrarse sombreados y con el texto "Bloqueado" en las columnas que afectan: todas si el bloqueo es de todo el consultorio, o solo la de su sillón.

#### Scenario: Bloqueo de un sillón
- **GIVEN** un bloqueo del `Sillón 2` de 12:00 a 13:00
- **WHEN** se muestra la vista diaria
- **THEN** la columna `Sillón 2` tiene la franja 12:00–13:00 sombreada con el texto "Bloqueado" y la del `Sillón 1` no

### Requirement: Lista accesible de turnos
La agenda SHALL ofrecer, además de la grilla, una lista de los turnos visibles ordenada por inicio y agrupada por día, con hora, paciente, prestación, sillón, estado y las mismas acciones que la grilla, navegable con teclado y legible por lectores de pantalla. Todo turno que se vea en la grilla MUST estar en la lista, y cada día de la vista MUST tener su encabezado aunque no tenga turnos.

#### Scenario: Turno operable desde la lista
- **GIVEN** un turno `PROGRAMADO` a las 10:00
- **WHEN** se recorre la lista con el teclado
- **THEN** la entrada del turno tiene un botón "Acciones" alcanzable con Tab que abre las acciones del turno

#### Scenario: Lista completa
- **GIVEN** cinco turnos visibles en el rango, uno de ellos fuera de los horarios de atención
- **WHEN** se muestra la agenda
- **THEN** la lista contiene los cinco turnos

### Requirement: Alta de turno
La agenda SHALL permitir crear un turno desde un botón "Nuevo turno" o eligiendo un hueco de la grilla (que precarga fecha, hora y sillón) en un diálogo con paciente (buscado por nombre o DNI entre los activos), prestación activa, sillón activo, fecha, hora y notas opcionales. El inicio MUST enviarse como el instante UTC de esa fecha y hora en la zona del consultorio; el fin lo calcula el servidor. Tras un alta exitosa el diálogo MUST cerrarse, la agenda recargarse y anunciarse el resultado.

#### Scenario: Alta exitosa
- **GIVEN** el paciente `Ana Pérez` (id 7), la prestación `Limpieza` (id 2) y el `Sillón 1` (id 1)
- **WHEN** se elige el 24/11 a las 10:00 y se confirma
- **THEN** se envía el alta con `inicio: "2026-11-24T13:00:00Z"`, se recarga el rango y se anuncia "Turno creado."

#### Scenario: Búsqueda de paciente
- **WHEN** se escribe `pér` en el buscador de pacientes
- **THEN** se pide `GET /pacientes?q=pér` y se listan los resultados por apellido, nombre y DNI como opciones elegibles

#### Scenario: Hueco de la grilla
- **WHEN** se elige el hueco de las 11:15 del `Sillón 2` el 24/11
- **THEN** el diálogo se abre con fecha 24/11, hora 11:15 y `Sillón 2` ya elegidos

### Requirement: Validación del alta
Paciente, prestación, sillón, fecha y hora SHALL ser obligatorios y las notas MUST tener como máximo 1000 caracteres. La validación MUST hacerse antes de enviar, marcando cada campo con su error y sin llamar a la API si hay errores.

#### Scenario: Faltan datos
- **WHEN** se confirma sin paciente ni prestación
- **THEN** se marcan los dos campos con su error y no se llama a la API

#### Scenario: Notas demasiado largas
- **WHEN** se confirma con notas de 1001 caracteres
- **THEN** se marca el error en notas y no se llama a la API

### Requirement: Rechazos por solapamiento
Los errores de alta y de reprogramación SHALL mostrarse dentro del diálogo con mensajes fijos, nunca con el `title` ni el `detail` del servidor, y los datos del formulario MUST conservarse para corregir y reintentar. Un `409` con conflicto de sillón MUST mostrar "El sillón ya tiene un turno en ese horario." con la hora del turno en conflicto; uno con conflicto de profesional, "El profesional ya tiene un turno en ese horario.".

#### Scenario: Conflicto de sillón
- **WHEN** el alta responde `409` con `conflicto: {motivo: "SILLON", inicio: "2026-11-24T13:00:00Z", ...}`
- **THEN** el diálogo muestra "El sillón ya tiene un turno en ese horario." con la hora 10:00 y conserva los datos

#### Scenario: Título del servidor no se muestra
- **WHEN** el alta responde `409` con un `title` arbitrario
- **THEN** el texto del `title` no aparece en el documento

### Requirement: Rechazos por agenda, referencia o datos
Un `422` en el inicio sin bloqueo SHALL mostrar un mensaje fijo de horario no disponible; con bloqueo, "El horario está bloqueado."; con error en `pacienteId`, `prestacionId` o `sillonId`, "Alguno de los datos elegidos ya no existe; actualizá la agenda."; sin campos reconocibles, un mensaje fijo genérico. Un `400` MUST mostrar los errores en sus campos. La clasificación MUST usar solo estado y datos tipados, nunca `title` ni `detail`, y los datos del formulario MUST conservarse.

#### Scenario: Fuera de agenda
- **WHEN** el alta responde `422` con `errores: [{campo: "inicio"}]` y sin `bloqueoId`
- **THEN** el diálogo muestra "El horario no está disponible según las reglas de la agenda. Revisá el horario de atención y la grilla."

#### Scenario: Dentro de un bloqueo
- **WHEN** el alta responde `422` con `errores: [{campo: "inicio"}]` y `bloqueoId: 4`
- **THEN** el diálogo muestra "El horario está bloqueado."

#### Scenario: Referencia inválida
- **WHEN** el alta responde `422` con `errores: [{campo: "prestacionId"}]`
- **THEN** el diálogo muestra "Alguno de los datos elegidos ya no existe; actualizá la agenda."

#### Scenario: 422 sin campos reconocibles
- **WHEN** el alta responde `422` sin `errores` y con un `title` arbitrario
- **THEN** el diálogo muestra el mensaje fijo genérico, conserva los datos, no ofrece sobreturno y el `title` no aparece en el documento

### Requirement: Aviso previo con varios profesionales
(DP-1, opción A.) Si los horarios cargados tienen más de un `profesionalId` distinto, la agenda SHALL mostrar un aviso persistente en `role="status"` y "Nuevo turno" MUST quedar deshabilitado con una explicación clara; el clic en hueco MUST NOT abrir el alta. Reprogramar y las acciones de estado MUST seguir disponibles. Un alta que igual responda `422` en `profesionalId` MUST mostrar un mensaje fijo claro y el diálogo MUST conservar todos los datos cargados.

#### Scenario: Horarios de dos profesionales
- **GIVEN** horarios del profesional 1 y del profesional 2
- **WHEN** se abre la agenda
- **THEN** se ve en `role="status"` el aviso "La agenda con varios profesionales no está disponible en esta versión." y "Nuevo turno" tiene `aria-disabled="true"` con esa explicación asociada por `aria-describedby`, y activarlo no abre el alta

#### Scenario: Un solo profesional
- **GIVEN** todos los horarios son del profesional 1
- **WHEN** se abre la agenda
- **THEN** no hay aviso y "Nuevo turno" está habilitado

#### Scenario: Reprogramar con varios profesionales
- **GIVEN** horarios de dos profesionales y un turno `PROGRAMADO`
- **WHEN** se abren sus acciones
- **THEN** "Reprogramar" y las acciones de estado están disponibles

#### Scenario: Profesional no resuelto al enviar
- **GIVEN** el alta completada con paciente `Ana Pérez`, prestación `Limpieza`, `Sillón 1`, fecha 24/11, hora 10:00 y notas `Control`
- **WHEN** el alta responde `422` con `errores: [{campo: "profesionalId"}]`
- **THEN** el diálogo sigue abierto, muestra "No se pudo asignar el profesional del consultorio. Contactá al administrador.", no ofrece sobreturno y los campos siguen con `Ana Pérez`, `Limpieza`, `Sillón 1`, 24/11, 10:00 y `Control`

### Requirement: Ofrecimiento de sobreturno
La UI SHALL ofrecer "Agendar como sobreturno" solo cuando el alta o la reprogramación fue rechazada por un conflicto de profesional (`409` con `motivo: "PROFESIONAL"`) o por estar fuera de horario, de grilla o en un bloqueo (`422` en el inicio). La opción MUST NOT ofrecerse para un conflicto de sillón (el sobreturno nunca omite el solapamiento de sillón) ni para una referencia inválida.

#### Scenario: Sin sobreturno para el sillón
- **WHEN** el alta responde `409` con `motivo: "SILLON"`
- **THEN** no se ofrece "Agendar como sobreturno"

#### Scenario: Sin sobreturno por referencia inválida
- **WHEN** el alta responde `422` con `errores: [{campo: "pacienteId"}]`
- **THEN** no se ofrece "Agendar como sobreturno"

### Requirement: Sobreturno no ofrecido a recepción
(Pendiente de DP-2, pregunta al product owner.) Con rol `RECEPCION` la UI SHALL NOT ofrecer "Agendar como sobreturno" en el alta ni en la reprogramación: un rechazo que lo admitiría MUST mostrar su mensaje fijo normal y además "El sobreturno requiere un usuario profesional o administrador.". `ADMIN` y `PROFESIONAL` MUST recibir el ofrecimiento. Es un resguardo de UI, no un control de seguridad: el backend no cambia y sigue aceptando sobreturno de los tres roles.

#### Scenario: Recepción sin ofrecimiento de sobreturno
- **GIVEN** una sesión con rol `RECEPCION`
- **WHEN** el alta responde `409` con `motivo: "PROFESIONAL"`
- **THEN** se muestra "El profesional ya tiene un turno en ese horario." y "El sobreturno requiere un usuario profesional o administrador.", sin botón "Agendar como sobreturno"

#### Scenario: Recepción al reprogramar fuera de agenda
- **GIVEN** una sesión con rol `RECEPCION`
- **WHEN** la reprogramación responde `422` con `errores: [{campo: "inicio"}]`
- **THEN** no se ofrece "Agendar como sobreturno" y ninguna request lleva `sobreturno: true`

#### Scenario: Administrador y profesional reciben el ofrecimiento
- **GIVEN** una sesión con rol `ADMIN` o `PROFESIONAL`
- **WHEN** el alta responde `409` con `motivo: "PROFESIONAL"`
- **THEN** se ofrece "Agendar como sobreturno" y no se muestra el aviso de rol

### Requirement: Confirmación de sobreturno
Elegir "Agendar como sobreturno" SHALL pedir una confirmación explícita que advierta que queda registrado como sobreturno, y solo al confirmar MUST reenviarse la misma operación con `sobreturno: true`. Ninguna operación MUST enviar `sobreturno: true` sin esa confirmación.

#### Scenario: Sobreturno tras conflicto de profesional
- **GIVEN** el alta respondió `409` con `motivo: "PROFESIONAL"`
- **WHEN** se elige "Agendar como sobreturno" y se confirma
- **THEN** se reenvía el mismo alta con `sobreturno: true`

#### Scenario: Sobreturno fuera de horario
- **GIVEN** la reprogramación respondió `422` en el inicio
- **WHEN** se elige "Agendar como sobreturno" y se confirma
- **THEN** se reenvía la reprogramación con `sobreturno: true`

#### Scenario: Confirmación cancelada
- **GIVEN** se eligió "Agendar como sobreturno"
- **WHEN** se cancela la confirmación
- **THEN** no se envía ninguna request y el diálogo vuelve al formulario con sus datos

### Requirement: Transiciones de estado
Las acciones de un turno SHALL incluir solo las transiciones válidas para su estado: `PROGRAMADO` → "Confirmar", "Cancelar", "Asistió", "Ausente"; `CONFIRMADO` → "Cancelar", "Asistió", "Ausente"; ambos ofrecen además "Reprogramar"; `CANCELADO`, `ASISTIO` y `AUSENTE` no tienen acciones de estado ni "Reprogramar". Tras un cambio exitoso la agenda MUST recargarse y anunciarse el resultado.

#### Scenario: Acciones de un turno programado
- **GIVEN** un turno `PROGRAMADO` de ayer
- **WHEN** se abren sus acciones
- **THEN** se ofrecen "Confirmar", "Cancelar", "Reprogramar", "Asistió" y "Ausente", todas habilitadas

#### Scenario: Turno final
- **GIVEN** un turno `ASISTIO`
- **WHEN** se abren sus acciones
- **THEN** no se ofrece ninguna acción de estado ni "Reprogramar"

#### Scenario: Confirmar
- **WHEN** se pulsa "Confirmar" en un turno `PROGRAMADO`
- **THEN** se envía `PATCH /turnos/{id}/estado` con `{estado: "CONFIRMADO"}`, se recarga el rango y se anuncia "Turno confirmado."

### Requirement: Asistencia solo en turnos iniciados
"Asistió" y "Ausente" SHALL estar deshabilitados, con un aviso, mientras el inicio del turno sea posterior al momento actual, comparando instantes y no horas locales.

#### Scenario: Asistencia en un turno futuro
- **GIVEN** un turno `CONFIRMADO` que empieza dentro de una hora
- **WHEN** se abren sus acciones
- **THEN** "Asistió" y "Ausente" están deshabilitados y "Cancelar" está habilitado

#### Scenario: Turno que ya empezó
- **GIVEN** un turno `CONFIRMADO` que empezó hace 5 minutos
- **WHEN** se pulsa "Asistió"
- **THEN** se envía `{estado: "ASISTIO"}` y se anuncia el resultado

### Requirement: Acciones de turnos para todos los roles operativos
La UI SHALL ofrecer las mismas acciones de turnos (alta, confirmar, cancelar, reprogramar, asistió, ausente) a `ADMIN`, `PROFESIONAL` y `RECEPCION`, sin ocultarlas ni deshabilitarlas por rol; la única excepción es el ofrecimiento de sobreturno, que no se muestra a `RECEPCION` (DP-2). El backend autoriza y un `403` MUST mostrarse con un mensaje fijo.

#### Scenario: Acción prohibida por el servidor
- **WHEN** cancelar un turno responde `403`
- **THEN** se muestra "No tenés permiso para realizar esta acción." y la agenda no cambia

#### Scenario: Recepción opera turnos
- **GIVEN** una sesión con rol `RECEPCION`
- **WHEN** se abren las acciones de un turno `PROGRAMADO`
- **THEN** se ofrecen las mismas acciones que para `ADMIN`

### Requirement: Cancelación con motivo
Cancelar SHALL pedir un motivo obligatorio en la UI (más estricto que la API, donde es opcional), recortado de espacios y de como máximo 255 bytes medidos en UTF-8 (no en caracteres). Un motivo vacío o más largo MUST marcarse como error sin llamar a la API. El motivo válido MUST enviarse recortado junto con `estado: "CANCELADO"`.

#### Scenario: Cancelación válida
- **WHEN** se cancela con el motivo `  Paciente avisó  `
- **THEN** se envía `{estado: "CANCELADO", motivoCancelacion: "Paciente avisó"}`

#### Scenario: Motivo vacío
- **WHEN** se confirma la cancelación con un motivo de solo espacios
- **THEN** se muestra un error en el motivo y no se llama a la API

#### Scenario: Límite exacto con caracteres multibyte
- **WHEN** el motivo tiene 127 letras `ñ` (2 bytes cada una) y una `a`, en total 255 bytes
- **THEN** el motivo es válido y se envía

#### Scenario: Excede por bytes aunque no por caracteres
- **WHEN** el motivo tiene 128 letras `ñ` (128 caracteres, 256 bytes)
- **THEN** se muestra un error de largo y no se llama a la API

#### Scenario: Emoji en el borde
- **WHEN** el motivo tiene 252 letras `a` y un emoji de 4 bytes (256 bytes)
- **THEN** se muestra un error de largo y no se llama a la API

### Requirement: Reprogramación
"Reprogramar" SHALL abrir un formulario con fecha, hora y sillón precargados con los del turno, y MUST enviar `PUT /turnos/{id}` con el nuevo inicio en UTC y el sillón solo si cambió; la duración la conserva el servidor. Los rechazos MUST tratarse como en el alta (mensajes fijos y sobreturno con confirmación cuando corresponde). No hay arrastrar y soltar.

#### Scenario: Mover de hora
- **GIVEN** un turno del 24/11 a las 10:00 en el `Sillón 1`
- **WHEN** se reprograma al 24/11 a las 11:00 sin cambiar el sillón
- **THEN** se envía `{inicio: "2026-11-24T14:00:00Z"}`, se recarga el rango y se anuncia "Turno reprogramado al martes 24/11 a las 11:00."

#### Scenario: Mover de sillón
- **WHEN** se reprograma el mismo turno al `Sillón 2` a la misma hora
- **THEN** se envía `{inicio: "2026-11-24T13:00:00Z", sillonId: 2}`

### Requirement: Errores de turno sin recarga automática
Ante un error de alta, cambio de estado o reprogramación la UI SHALL NOT recargar la agenda por sí sola. Un `404` al cambiar de estado o reprogramar MUST mostrar "El turno ya no existe."; un `404` en el alta y otro error no identificado, un mensaje fijo genérico; un `409` sin `conflicto`, "No se pudo completar la acción. Es posible que el turno haya cambiado.". Todos MUST ofrecer "Recargar agenda", conservar los datos del diálogo y no leer `title` ni `detail`. Solo un éxito recarga sola.

#### Scenario: 409 sin detalle en una acción
- **WHEN** confirmar un turno responde `409` sin `conflicto`
- **THEN** se muestra "No se pudo completar la acción. Es posible que el turno haya cambiado." y un botón "Recargar agenda", y el diálogo sigue abierto

#### Scenario: No hay recarga automática
- **GIVEN** confirmar un turno respondió `409` sin `conflicto`
- **WHEN** pasa el tiempo sin que el usuario pulse "Recargar agenda"
- **THEN** no se vuelve a llamar al listado de turnos

#### Scenario: Recarga manual
- **GIVEN** se muestra el error con "Recargar agenda"
- **WHEN** se pulsa "Recargar agenda"
- **THEN** el diálogo se cierra y se vuelve a pedir el rango una sola vez

#### Scenario: Turno que ya no existe
- **WHEN** reprogramar un turno responde `404`
- **THEN** se muestra "El turno ya no existe." con "Recargar agenda", los datos del formulario se conservan y no se vuelve a pedir el rango

#### Scenario: 404 durante el alta
- **WHEN** el alta de un turno responde `404`
- **THEN** se muestra el mensaje fijo genérico (no "El turno ya no existe.") con "Recargar agenda", los datos del formulario se conservan y no se vuelve a pedir el rango

#### Scenario: Error del servidor no identificado
- **WHEN** cancelar un turno responde `500`
- **THEN** se muestra el mensaje fijo genérico con "Recargar agenda" y no se vuelve a pedir el rango

#### Scenario: Éxito recarga
- **WHEN** confirmar un turno responde `200`
- **THEN** se vuelve a pedir el rango y se anuncia "Turno confirmado."

### Requirement: Respuestas tardías y envíos dobles
Las respuestas de cargas anteriores que lleguen después de una navegación o de una recarga más reciente SHALL descartarse, y las de una página ya cerrada MUST ignorarse. Mientras una operación está en curso su botón MUST estar deshabilitado.

#### Scenario: Envío doble
- **GIVEN** un alta enviada que todavía no respondió
- **WHEN** se intenta confirmar de nuevo
- **THEN** el botón está deshabilitado y se envió una sola request

#### Scenario: Respuesta tardía descartada
- **GIVEN** se pidió el día 24/11 y luego, antes de que responda, el día 25/11
- **WHEN** la respuesta del 24/11 llega después de la del 25/11
- **THEN** la agenda muestra solo los turnos del 25/11

### Requirement: Contenido seguro
Todo dato de la API (nombre y apellido del paciente, prestación, sillón, notas, motivo de cancelación, DNI en el buscador) SHALL mostrarse como texto literal, sin interpretar HTML. Ningún dato de paciente ni de turno MUST escribirse en la consola ni en la URL.

#### Scenario: Nombre de paciente malicioso
- **GIVEN** un turno cuyo paciente se llama `<img src=x onerror=alert(1)>`
- **WHEN** se muestra en la grilla, en la lista y en el buscador
- **THEN** se ve el texto literal y el documento no contiene elementos `img`

#### Scenario: Notas maliciosas
- **GIVEN** un turno con notas `<script>alert(1)</script>`
- **WHEN** se abre el detalle del turno
- **THEN** se ve el texto literal y el documento no contiene elementos `script` agregados por la página

### Requirement: Diálogos accesibles
Los diálogos de turno (alta, detalle y acciones, cancelación, reprogramación, confirmación de sobreturno) SHALL ser modales con nombre accesible, mantener el foco dentro mientras están abiertos, cerrarse con Escape o con un botón "Cerrar" y, al cerrarse, devolver el foco al elemento que los abrió. Al abrirse, el foco MUST ir al primer campo o, si no hay campos, al primer botón. Los errores MUST anunciarse y quedar asociados a su campo.

#### Scenario: Escape devuelve el foco
- **GIVEN** el diálogo de alta abierto desde "Nuevo turno"
- **WHEN** se pulsa Escape
- **THEN** el diálogo se cierra y el foco vuelve a "Nuevo turno"

#### Scenario: Foco atrapado
- **GIVEN** el diálogo de cancelación abierto con el foco en su último botón
- **WHEN** se pulsa Tab
- **THEN** el foco pasa al primer elemento enfocable del diálogo

#### Scenario: Nombre accesible
- **WHEN** se abre el diálogo de alta
- **THEN** el diálogo está etiquetado "Nuevo turno" y el foco está en el buscador de paciente

### Requirement: Navegación por teclado en la grilla
Cada turno de la grilla SHALL ser un botón con nombre accesible, y la grilla MUST ser una sola parada de Tab (*roving tabindex*): Arriba/Abajo van al turno anterior/siguiente de la misma columna por hora; Izquierda/Derecha, al turno de inicio más cercano en la columna adyacente con turnos; Inicio/Fin, al primero/último de la columna; Enter o Espacio abren sus acciones. En los bordes el foco no se mueve. La lista accesible MUST recorrerse con Tab en orden cronológico.

#### Scenario: Flechas en una columna
- **GIVEN** en el `Sillón 1` turnos a las 09:00, 10:00 y 11:00, con el foco en el de las 10:00
- **WHEN** se pulsa Abajo, otra vez Abajo y luego Inicio
- **THEN** el foco pasa al de las 11:00, se queda en él (borde) y luego va al de las 09:00, que queda como el único bloque con `tabindex="0"`

#### Scenario: Flechas entre columnas
- **GIVEN** el foco en el turno de las 10:00 del `Sillón 1` y en el `Sillón 2` turnos a las 09:00 y 10:15
- **WHEN** se pulsa Derecha
- **THEN** el foco pasa al turno de las 10:15 del `Sillón 2`

#### Scenario: Enter abre las acciones
- **GIVEN** el foco en un turno `PROGRAMADO` de la grilla
- **WHEN** se pulsa Enter
- **THEN** se abre el diálogo de acciones de ese turno

#### Scenario: Una sola parada de Tab
- **GIVEN** la grilla con cinco turnos
- **WHEN** se recorre la página con Tab
- **THEN** la grilla recibe el foco una sola vez antes de pasar a la lista

### Requirement: Acciones del turno por teclado y foco
En el diálogo de acciones, todas las acciones disponibles SHALL alcanzarse con Tab; una acción deshabilitada MUST seguir enfocable, anunciar su motivo por `aria-describedby` y no hacer nada al activarse. Escape MUST cerrar el diálogo y devolver el foco al turno que lo abrió. El foco tras una mutación o "Recargar agenda" sigue el requisito "Foco tras un cambio de turno".

#### Scenario: Acciones alcanzables con Tab
- **GIVEN** un turno `CONFIRMADO` futuro con el diálogo de acciones abierto
- **WHEN** se recorre el diálogo con Tab
- **THEN** se alcanzan "Cancelar", "Reprogramar", "Asistió" y "Ausente", y estos dos últimos tienen `aria-disabled="true"` y `aria-describedby` hacia "Disponible cuando empiece el turno."

#### Scenario: Escape devuelve el foco al turno
- **GIVEN** el diálogo de acciones abierto con Enter desde el turno de las 10:00 de la grilla
- **WHEN** se pulsa Escape
- **THEN** el diálogo se cierra y el foco vuelve al bloque del turno de las 10:00

### Requirement: Precarga del alta desde el turno enfocado
"Nuevo turno" con un turno enfocado en la vista actual (parada del *roving tabindex* o último ítem de la lista enfocado desde la última renderización) SHALL precargar su fecha, su sillón y como hora su fin en la zona del consultorio (si el fin es 00:00 del día siguiente, esa fecha). Sin turno enfocado, o si ya no está en la vista, MUST precargar la fecha visible y el sillón filtrado, con la hora vacía. La precarga MUST ser editable y MUST NOT enviar ni confirmar nada sola.

#### Scenario: Precarga desde el turno enfocado
- **GIVEN** el foco estuvo en el turno de 10:00 a 10:30 del `Sillón 2` el 24/11 en la vista diaria
- **WHEN** se pulsa "Nuevo turno"
- **THEN** el alta se abre con fecha 24/11, hora 10:30 y `Sillón 2`, todos editables, y no se envía ninguna request

#### Scenario: Turno que termina a medianoche
- **GIVEN** el foco estuvo en un turno del 24/11 de 23:30 a 00:00 del `Sillón 1`
- **WHEN** se pulsa "Nuevo turno"
- **THEN** el alta se abre con fecha 25/11, hora 00:00 y `Sillón 1`

#### Scenario: Sin turno enfocado
- **GIVEN** la vista diaria del 24/11 con el filtro en `Sillón 2` y ningún turno enfocado
- **WHEN** se pulsa "Nuevo turno"
- **THEN** el alta se abre con fecha 24/11, `Sillón 2` y la hora vacía

#### Scenario: Contexto cambiado
- **GIVEN** el foco estuvo en un turno del 24/11 y después se pulsó "Siguiente"
- **WHEN** se pulsa "Nuevo turno"
- **THEN** el alta se abre con fecha 25/11, el sillón filtrado si hay y la hora vacía, sin datos del turno anterior

#### Scenario: Cerrar descarta la precarga
- **GIVEN** el alta abierta con precarga desde un turno enfocado y la hora editada a 12:00
- **WHEN** se cierra el diálogo, se enfoca otro turno de 15:00 a 15:30 y se vuelve a pulsar "Nuevo turno"
- **THEN** la hora precargada es 15:30

#### Scenario: Hueco sin cambios
- **GIVEN** el foco estuvo en un turno de 10:00 a 10:30
- **WHEN** se hace clic en el hueco de las 11:15 del `Sillón 2`
- **THEN** el alta se abre con hora 11:15 y `Sillón 2`

### Requirement: Aviso no bloqueante sobre la hora sugerida
En el alta precargada desde un turno enfocado la UI SHALL mostrar junto a la hora, asociado por `aria-describedby`, un aviso calculado solo con los datos cargados si la hora se superpone con un turno no cancelado de ese sillón, cae fuera de los horarios de ese día, en un bloqueo, fuera de la grilla o es inválida. El aviso MUST recalcularse al editar fecha, hora, sillón o prestación y MUST NOT impedir el envío; el backend decide.

#### Scenario: Hora sugerida ocupada
- **GIVEN** la precarga sugiere 10:30 en el `Sillón 2`, ese sillón tiene un turno `PROGRAMADO` de 10:30 a 11:00 y se elige una prestación de 30 minutos
- **WHEN** se muestra el alta
- **THEN** junto a la hora se lee "La hora sugerida se superpone con otro turno de este sillón (10:30–11:00). Podés cambiarla." asociado por `aria-describedby` y "Confirmar" sigue habilitado

#### Scenario: Sin prestación elegida
- **GIVEN** la precarga sugiere 10:30, ningún turno contiene las 10:30 y otro empieza a las 10:45
- **WHEN** todavía no se eligió prestación
- **THEN** no se muestra aviso de superposición

#### Scenario: Fuera de horario
- **GIVEN** el horario de atención de ese día termina a las 18:00 y la precarga sugiere 18:00
- **WHEN** se muestra el alta
- **THEN** se muestra el aviso de hora fuera del horario de atención

#### Scenario: Dentro de un bloqueo
- **GIVEN** un bloqueo del `Sillón 2` de 12:00 a 13:00 y la precarga sugiere 12:00 en ese sillón
- **WHEN** se muestra el alta
- **THEN** se muestra el aviso de hora bloqueada

#### Scenario: Fuera de la grilla
- **GIVEN** el turno enfocado es un sobreturno de 09:10 a 09:20 y la grilla es de 15 minutos
- **WHEN** se pulsa "Nuevo turno"
- **THEN** la hora sugerida es 09:20 y se muestra el aviso de hora fuera de la grilla

#### Scenario: El aviso se actualiza al editar
- **GIVEN** se muestra el aviso de hora ocupada
- **WHEN** se cambia la hora a una libre dentro del horario y de la grilla
- **THEN** el aviso desaparece y la hora deja de referenciarlo por `aria-describedby`

#### Scenario: El servidor decide
- **GIVEN** no se muestra ningún aviso
- **WHEN** el alta responde `409` con `motivo: "SILLON"`
- **THEN** se muestra el mensaje de conflicto de sillón como en "Rechazos por solapamiento", asociado también al campo hora

### Requirement: Foco tras un cambio de turno
Tras una mutación exitosa o "Recargar agenda" en la grilla, si el turno sigue renderizado en la vista el foco SHALL ir a ese turno en su nueva posición. Si no, MUST ir al siguiente turno por inicio de su columna original, si no hay al anterior, si la columna quedó vacía al más cercano de las columnas adyacentes (regla de Izquierda/Derecha), y con la vista vacía al grupo de la grilla; el `h1` solo como último recurso. El destino MUST recibir el `tabindex="0"`; nunca se navega a otra fecha.

#### Scenario: Sigue visible
- **GIVEN** "Mostrar cancelados" encendido y el foco en el turno de las 10:00 del `Sillón 1`
- **WHEN** se cancela y la operación termina bien
- **THEN** el foco vuelve al bloque con el mismo `data-turno-id`, ahora con la etiqueta "Cancelado"

#### Scenario: Desaparece, va al siguiente
- **GIVEN** "Mostrar cancelados" apagado y en el `Sillón 1` turnos a las 09:00, 10:00 y 11:00
- **WHEN** se cancela el de las 10:00 desde la grilla y termina bien
- **THEN** el foco queda en el turno de las 11:00, que tiene `tabindex="0"`

#### Scenario: Último de la columna, va al anterior
- **GIVEN** en el `Sillón 1` turnos a las 09:00 y 10:00
- **WHEN** se reprograma el de las 10:00 al jueves 26/11 desde la vista diaria del 24/11
- **THEN** el foco queda en el turno de las 09:00 y la vista sigue en el 24/11

#### Scenario: Columna vacía, va a la adyacente
- **GIVEN** el `Sillón 1` con un solo turno a las 10:00 y el `Sillón 2` con turnos a las 09:00 y 10:15
- **WHEN** se cancela el turno del `Sillón 1` con cancelados ocultos
- **THEN** el foco queda en el turno de las 10:15 del `Sillón 2`

#### Scenario: Vista vacía
- **GIVEN** la vista tiene un solo turno
- **WHEN** se cancela con cancelados ocultos
- **THEN** el foco queda en el contenedor `role="group"` de la grilla

#### Scenario: Reprogramado dentro de la vista
- **GIVEN** el foco en el turno de las 10:00 del 24/11 en la vista diaria
- **WHEN** se reprograma a las 11:00 del mismo día
- **THEN** el foco vuelve al bloque del mismo turno, ahora a las 11:00

### Requirement: Foco desde la lista y recarga fallida
Si el cambio se hizo desde la lista accesible, el foco SHALL ir al mismo ítem si sigue y, si no, al siguiente ítem de su día, al anterior, al encabezado del día (`h2` con `tabindex="-1"`) y por último al `h1`. Solo la recarga vigente decide el foco (respuestas tardías descartadas). Si la recarga falla, el foco MUST quedar en el elemento que abrió el diálogo si sigue en el documento o, si no, en la grilla, con el error y "Recargar agenda".

#### Scenario: Desde la lista
- **GIVEN** en la lista del 24/11 turnos a las 09:00 y 10:00 y cancelados ocultos
- **WHEN** se cancela el de las 10:00 desde su botón "Acciones" y termina bien
- **THEN** el foco queda en el botón "Acciones" del turno de las 09:00

#### Scenario: Día vacío en la lista
- **GIVEN** el 24/11 tiene un solo turno en la lista
- **WHEN** se cancela desde la lista con cancelados ocultos
- **THEN** el foco queda en el encabezado `h2` del 24/11

#### Scenario: Recarga fallida
- **GIVEN** el diálogo de acciones abierto desde el bloque de las 10:00
- **WHEN** la confirmación termina bien pero la recarga del rango falla por red
- **THEN** el foco queda en el bloque de las 10:00 y se muestra el error con "Recargar agenda"

### Requirement: Anuncio del destino del turno
Tras un cambio exitoso, `role="status"` SHALL anunciar qué pasó y, en una reprogramación, el día, la hora y el sillón nuevos en la zona del consultorio, agregando "quedó fuera de esta vista." si el turno ya no se muestra. El texto MUST armarse con datos del cliente y nunca con `title` ni `detail`.

#### Scenario: Reprogramado fuera de la vista
- **GIVEN** la vista diaria del 24/11
- **WHEN** se reprograma un turno al jueves 26/11 a las 10:00
- **THEN** se anuncia "Turno reprogramado al jueves 26/11 a las 10:00; quedó fuera de esta vista." y la vista sigue en el 24/11

#### Scenario: Cancelado
- **WHEN** se cancela un turno y termina bien
- **THEN** se anuncia "Turno cancelado."
