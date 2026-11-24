# Spec Delta

## ADDED Requirements

### Requirement: Registro del consentimiento de datos
El backend SHALL permitir registrar el consentimiento de tratamiento de datos de un paciente indicando una versión del texto que exista en el catálogo y cuya vigencia ya haya comenzado. La fecha de aceptación MUST ser la del servidor y el usuario que lo registra MUST ser el del token; el pedido no los indica. Un paciente MAY tener varios consentimientos registrados, y el backend SHALL listarlos del más reciente al más antiguo. El backend SHALL exponer el texto de consentimiento vigente, que es el de fecha de vigencia más reciente que no sea futura.

#### Scenario: Consentimiento registrado
- **GIVEN** el paciente 7 del consultorio A sin consentimientos
- **WHEN** el usuario 5 registra el consentimiento con la versión `v1`
- **THEN** la respuesta es `201` con la versión `v1`, la fecha del servidor y el usuario 5, y el paciente 7 tiene un consentimiento en su lista

#### Scenario: Versión inexistente
- **WHEN** se registra un consentimiento con una versión que no está en el catálogo
- **THEN** la respuesta es `400` sin repetir la versión enviada y no se guarda nada

#### Scenario: Versión todavía no vigente
- **GIVEN** una versión del catálogo con vigencia futura
- **WHEN** se registra un consentimiento con esa versión
- **THEN** la respuesta es `400` sin repetir la versión enviada y no se guarda nada

#### Scenario: Texto vigente
- **GIVEN** el catálogo con `v1` vigente y una versión con vigencia futura
- **WHEN** se pide el texto vigente
- **THEN** se obtiene `v1` con su contenido

### Requirement: Ficha y notas solo con consentimiento
El backend MUST rechazar con `409` y código `CONSENTIMIENTO_REQUERIDO` la lectura y la escritura de la ficha clínica y el alta y el listado de notas de un paciente sin ningún consentimiento registrado. Un consentimiento de cualquier versión del texto SHALL habilitar el acceso.

#### Scenario: Ficha sin consentimiento
- **GIVEN** el paciente 7 sin consentimiento registrado
- **WHEN** se pide o se guarda su ficha, o se crea o lista una nota
- **THEN** la respuesta es `409` con código `CONSENTIMIENTO_REQUERIDO`, sin datos del paciente, y no se guarda nada

#### Scenario: Ficha con consentimiento de una versión anterior
- **GIVEN** el paciente 7 con un consentimiento de la versión `v1` y un texto vigente posterior
- **WHEN** se pide su ficha
- **THEN** la respuesta es `200`

### Requirement: Lectura y carga de la ficha clínica
El backend SHALL devolver la ficha clínica (anamnesis) de un paciente con consentimiento, o una ficha con todos los campos clínicos vacíos y versión vacía si todavía no fue cargada. Guardar la ficha MUST reemplazar todos sus campos clínicos. Cada campo de texto MUST admitir hasta 4000 caracteres; uno más largo SHALL rechazarse con `400` sin repetir el valor.

#### Scenario: Ficha todavía no cargada
- **GIVEN** el paciente 7 con consentimiento y sin ficha
- **WHEN** se pide su ficha
- **THEN** la respuesta es `200` con los campos clínicos y la versión vacíos

#### Scenario: Primera carga de la ficha
- **GIVEN** el paciente 7 con consentimiento y sin ficha
- **WHEN** se guarda su ficha con versión vacía y alergias informadas
- **THEN** la respuesta tiene las alergias guardadas y la versión 0

#### Scenario: Reemplazo completo
- **GIVEN** la ficha del paciente 7 en versión 0 con alergias y medicación informadas
- **WHEN** se guarda con versión 0 y la medicación vacía
- **THEN** la ficha queda sin medicación y en versión 1

#### Scenario: Campo demasiado largo
- **WHEN** se guarda una ficha con un campo de 4001 caracteres
- **THEN** la respuesta es `400` sin el texto enviado y la ficha no cambia

### Requirement: Edición concurrente de la ficha
Para guardar la ficha, el pedido MUST indicar la versión que leyó: vacía si la ficha no existía. El backend MUST rechazar con `409` y código `FICHA_DESACTUALIZADA`, sin cambiar la ficha, una versión que no coincida con la guardada, también cuando dos guardados o dos primeras cargas ocurren a la vez.

#### Scenario: Versión desactualizada
- **GIVEN** la ficha del paciente 7 en versión 2
- **WHEN** se guarda con versión 1
- **THEN** la respuesta es `409` con código `FICHA_DESACTUALIZADA` y la ficha sigue en versión 2

#### Scenario: Primera carga cuando ya existe
- **GIVEN** la ficha del paciente 7 ya cargada
- **WHEN** se guarda con versión vacía
- **THEN** la respuesta es `409` con código `FICHA_DESACTUALIZADA`

#### Scenario: Guardados simultáneos
- **GIVEN** la ficha del paciente 7 en versión 0
- **WHEN** dos usuarios la guardan a la vez con versión 0
- **THEN** uno obtiene `200`, el otro `409` con código `FICHA_DESACTUALIZADA`, y la ficha queda en versión 1

### Requirement: Notas clínicas inmutables
El backend SHALL permitir agregar notas clínicas a un paciente con consentimiento y listarlas paginadas de la más reciente a la más antigua (página de 20, máximo 100). El autor MUST ser el profesional activo vinculado al usuario del token y la fecha MUST ser la del servidor. Si el usuario no tiene exactamente un profesional activo vinculado, el alta MUST rechazarse con `422` y código `PROFESIONAL_NO_VINCULADO`. Una nota MAY referir un turno del mismo consultorio. Las notas MUST NOT poder editarse ni borrarse: una corrección SHALL registrarse como una nota nueva. El texto MUST tener entre 1 y 10000 caracteres.

#### Scenario: Nota del profesional vinculado
- **GIVEN** el usuario 5 vinculado al profesional 3, y el paciente 7 con consentimiento
- **WHEN** el usuario 5 agrega una nota al paciente 7
- **THEN** la respuesta es `201` con el profesional 3 como autor y la fecha del servidor

#### Scenario: Usuario sin profesional vinculado
- **GIVEN** un `ADMIN` sin profesional vinculado
- **WHEN** agrega una nota
- **THEN** la respuesta es `422` con código `PROFESIONAL_NO_VINCULADO` y no se guarda la nota

#### Scenario: Turno de otro consultorio
- **WHEN** se agrega una nota que refiere un turno que no pertenece al consultorio en curso
- **THEN** la respuesta es `422` y no se guarda la nota

#### Scenario: Listado ordenado y acotado
- **GIVEN** el paciente 7 con 25 notas
- **WHEN** se piden sus notas con tamaño de página 1000
- **THEN** se obtienen 25 notas en una página de tamaño 100, de la más reciente a la más antigua

#### Scenario: Nota no editable
- **GIVEN** una nota existente
- **WHEN** se intenta modificarla o borrarla por la API
- **THEN** la operación no existe y la nota no cambia

### Requirement: Historia clínica de pacientes dados de baja
La ficha y las notas de un paciente dado de baja SHALL poder leerse. Guardar su ficha, agregarle notas o registrarle un consentimiento MUST rechazarse con `409` y código `PACIENTE_INACTIVO`.

#### Scenario: Lectura de un paciente dado de baja
- **GIVEN** el paciente 7 dado de baja, con consentimiento y ficha
- **WHEN** se pide su ficha
- **THEN** la respuesta es `200`

#### Scenario: Escritura sobre un paciente dado de baja
- **GIVEN** el paciente 7 dado de baja
- **WHEN** se guarda su ficha, se le agrega una nota o se le registra un consentimiento
- **THEN** la respuesta es `409` con código `PACIENTE_INACTIVO` y no se guarda nada

### Requirement: Auditoría de cada acceso a la historia clínica
Cada lectura y escritura exitosa de la ficha, de las notas y cada registro de consentimiento MUST dejar una entrada de auditoría con el id del paciente como id de entidad, confirmada junto con la operación. La entidad SHALL indicar qué se accedió (`FichaClinica`, `NotaClinica`, `ConsentimientoDatos`) y la acción (`READ`, `CREATE`, `UPDATE`). El detalle MUST contener solo identificadores y la versión del texto de consentimiento, nunca contenido clínico. Las operaciones rechazadas MUST NOT dejar entrada. Si la entrada no puede guardarse, la operación MUST fallar sin devolver ni guardar datos clínicos.

#### Scenario: Lectura de la ficha auditada
- **WHEN** el usuario 5 del consultorio A lee la ficha del paciente 7
- **THEN** existe una entrada con consultorio A, usuario 5, acción `READ`, entidad `FichaClinica` e id de entidad 7

#### Scenario: Primera carga y modificación auditadas
- **WHEN** se carga por primera vez la ficha del paciente 7 y luego se modifica
- **THEN** existen una entrada `CREATE` y una `UPDATE` sobre `FichaClinica` con id de entidad 7, cuyos detalles tienen el id de la ficha y su versión y no tienen contenido clínico

#### Scenario: Nota y listado auditados
- **WHEN** se agrega una nota al paciente 7 y luego se listan sus notas
- **THEN** existen una entrada `CREATE` sobre `NotaClinica` con id de entidad 7 y el id de la nota en el detalle, y una entrada `READ` sobre `NotaClinica` con id de entidad 7

#### Scenario: Consentimiento auditado
- **WHEN** se registra el consentimiento `v1` del paciente 7
- **THEN** existe una entrada `CREATE` sobre `ConsentimientoDatos` con id de entidad 7 y en el detalle el id del consentimiento y la versión `v1`

#### Scenario: Rechazo sin entrada
- **WHEN** se rechaza un acceso a la ficha del paciente 7 por rol, consentimiento, versión o paciente de otro consultorio
- **THEN** no se registra ninguna entrada para ese acceso

#### Scenario: Lectura auditada en una transacción de escritura
- **WHEN** se lee la ficha o se listan las notas de un paciente
- **THEN** la entrada de auditoría se guarda en una transacción que no es de solo lectura

#### Scenario: Auditoría imposible
- **GIVEN** que la entrada de auditoría no puede guardarse
- **WHEN** se lee o se guarda la ficha del paciente 7
- **THEN** la respuesta es `500` sin contenido clínico y la ficha no cambia

### Requirement: Historia clínica restringida por rol y consultorio
Solo `ADMIN` y `PROFESIONAL` SHALL acceder a la ficha, a las notas y a los consentimientos; `RECEPCION` MUST recibir `403` y una request sin token `401`. Toda operación MUST quedar acotada al consultorio del token: un paciente de otro consultorio SHALL responder `404`.

#### Scenario: Recepción sin acceso clínico
- **GIVEN** un usuario `RECEPCION` del consultorio A
- **WHEN** pide o guarda la ficha, agrega o lista notas, o registra o lista consentimientos del paciente 7 de A
- **THEN** la respuesta es `403`

#### Scenario: Paciente de otro consultorio
- **GIVEN** el paciente 9 del consultorio B
- **WHEN** un `PROFESIONAL` del consultorio A accede a su ficha, notas o consentimientos
- **THEN** la respuesta es `404` y no se devuelve ni se modifica nada de B

### Requirement: Datos de salud fuera de logs y errores
El backend MUST NOT escribir en logs ni en respuestas de error contenido clínico, nombre, DNI ni otros datos personales del paciente; los logs SHALL usar solo identificadores, acción y tipo de error.

#### Scenario: Error de validación sin contenido clínico
- **WHEN** se rechaza una ficha o una nota por largo excedido
- **THEN** ni la respuesta ni el log contienen el texto enviado

#### Scenario: Operación exitosa sin datos en el log
- **WHEN** se guarda una ficha y se agrega una nota
- **THEN** el log de aplicación no contiene el texto clínico, el nombre ni el DNI del paciente
