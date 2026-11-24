# Spec Delta

## Purpose

Permitir que un consultorio reserve, consulte, confirme, cancele, reprograme y marque la asistencia de turnos por API, sin solapamientos por sillón ni por profesional, respetando horarios de atención y bloqueos, con sobreturno explícito y auditado, permisos por rol, concurrencia segura y aislamiento por consultorio.

## ADDED Requirements

### Requirement: Alta de turno
El sistema SHALL permitir crear un turno indicando paciente, prestación, sillón, inicio y, opcionalmente, profesional, notas y la marca de sobreturno. El turno MUST crearse en estado `PROGRAMADO` y su fin MUST calcularse como el inicio más la duración de la prestación; el cliente MUST NOT poder fijar el fin.

#### Scenario: Alta válida
- **GIVEN** una prestación activa de 30 minutos, un sillón activo, un paciente activo y una franja del profesional que cubre el horario
- **WHEN** se crea un turno con inicio a las 10:00 hora local
- **THEN** la respuesta es `201` con `Location`, `estado` `PROGRAMADO` y fin a las 10:30 hora local

#### Scenario: Profesional por defecto
- **GIVEN** un consultorio con un único profesional activo
- **WHEN** se crea un turno sin `profesionalId`
- **THEN** el turno queda asignado a ese profesional

#### Scenario: Profesional ambiguo
- **GIVEN** un consultorio con dos profesionales activos
- **WHEN** se crea un turno sin `profesionalId`
- **THEN** la respuesta es `422` con el campo `profesionalId`

#### Scenario: Referencia inactiva o ajena
- **WHEN** se crea un turno con un sillón inactivo, una prestación inactiva, un paciente dado de baja o cualquiera de ellos de otro consultorio
- **THEN** la respuesta es `422` con el campo correspondiente y no se crea el turno

### Requirement: Sin solapamiento por sillón
El sistema MUST rechazar con `409` todo alta o reprogramación cuyo intervalo `[inicio, fin)` se interseque con el de otro turno no cancelado del mismo sillón, aun cuando se pida sobreturno. La respuesta MUST identificar el turno en conflicto por id, inicio, fin, sillón y profesional, y MUST NOT incluir datos del paciente.

#### Scenario: Solapamiento exacto
- **GIVEN** un turno de 10:00 a 10:30 en el sillón 1
- **WHEN** se crea otro de 10:00 a 10:30 en el sillón 1
- **THEN** la respuesta es `409` con `conflicto.turnoId` del turno existente y `conflicto.motivo` `SILLON`

#### Scenario: Solapamiento parcial
- **GIVEN** un turno de 10:00 a 10:30 en el sillón 1
- **WHEN** se crea otro de 10:15 a 10:45 en el sillón 1
- **THEN** la respuesta es `409`

#### Scenario: Turnos adyacentes
- **GIVEN** un turno de 10:00 a 10:30 en el sillón 1
- **WHEN** se crea otro de 10:30 a 11:00 en el sillón 1
- **THEN** la respuesta es `201`

#### Scenario: Turno cancelado libera el hueco
- **GIVEN** un turno cancelado de 10:00 a 10:30 en el sillón 1
- **WHEN** se crea otro de 10:00 a 10:30 en el sillón 1
- **THEN** la respuesta es `201`

#### Scenario: Sobreturno no exceptúa el sillón
- **GIVEN** un turno de 10:00 a 10:30 en el sillón 1
- **WHEN** se crea otro de 10:00 a 10:30 en el sillón 1 con `sobreturno` verdadero
- **THEN** la respuesta es `409`

### Requirement: Sin solapamiento por profesional salvo sobreturno
El sistema MUST rechazar con `409` todo alta o reprogramación que se interseque con otro turno no cancelado del mismo profesional, salvo que el pedido incluya `sobreturno` verdadero de forma explícita. El sistema MUST NOT inferir un sobreturno.

#### Scenario: Profesional ocupado en otro sillón
- **GIVEN** un turno de 10:00 a 10:30 del profesional P en el sillón 1
- **WHEN** se crea otro de 10:00 a 10:30 del profesional P en el sillón 2 sin `sobreturno`
- **THEN** la respuesta es `409` con `conflicto.motivo` `PROFESIONAL`

#### Scenario: Sobreturno explícito
- **GIVEN** un turno de 10:00 a 10:30 del profesional P en el sillón 1
- **WHEN** se crea otro de 10:00 a 10:30 del profesional P en el sillón 2 con `sobreturno` verdadero
- **THEN** la respuesta es `201` con `sobreturno` verdadero

### Requirement: Horario de atención y grilla
Salvo sobreturno, el turno MUST caber entero dentro de una única franja de atención de su profesional para el día de la semana de su inicio, evaluada en la zona horaria del consultorio, y su inicio MUST estar alineado a la grilla de la agenda. En caso contrario la respuesta MUST ser `422` con el campo `inicio`.

#### Scenario: Fuera de horario
- **GIVEN** una franja del profesional los lunes de 09:00 a 13:00 hora local
- **WHEN** se crea un turno de 30 minutos el lunes a las 08:30 hora local
- **THEN** la respuesta es `422` con el campo `inicio`

#### Scenario: Cruza el cierre de la franja
- **GIVEN** una franja del profesional los lunes de 09:00 a 13:00 hora local
- **WHEN** se crea un turno de 30 minutos el lunes a las 12:45 hora local
- **THEN** la respuesta es `422`

#### Scenario: Inicio fuera de grilla
- **WHEN** se crea un turno con inicio a las 10:10 hora local
- **THEN** la respuesta es `422` con el campo `inicio`

#### Scenario: Sobreturno fuera de horario
- **WHEN** se crea un turno el lunes a las 08:30 hora local con `sobreturno` verdadero y sin conflicto de sillón
- **THEN** la respuesta es `201`

#### Scenario: Conversión de zona horaria
- **GIVEN** un consultorio en `America/Argentina/Buenos_Aires` con franja de 09:00 a 13:00 hora local
- **WHEN** se crea un turno con inicio `12:00:00Z` de ese día
- **THEN** se evalúa como las 09:00 hora local y la respuesta es `201`

### Requirement: Bloqueos de agenda
Salvo sobreturno, el sistema MUST rechazar con `422` un turno que se interseque con un bloqueo cuyo sillón sea nulo o igual al del turno y cuyo profesional sea nulo o igual al del turno. La respuesta MUST incluir el id del bloqueo y MUST NOT incluir su motivo.

#### Scenario: Bloqueo del sillón
- **GIVEN** un bloqueo del sillón 1 de 11:00 a 12:00
- **WHEN** se crea un turno a las 11:00 en el sillón 1
- **THEN** la respuesta es `422` con `bloqueoId`

#### Scenario: Bloqueo de otro sillón
- **GIVEN** un bloqueo del sillón 2 de 11:00 a 12:00
- **WHEN** se crea un turno a las 11:00 en el sillón 1
- **THEN** la respuesta es `201`

#### Scenario: Bloqueo de todo el consultorio
- **GIVEN** un bloqueo sin sillón ni profesional de 11:00 a 12:00
- **WHEN** se crea un turno a las 11:30 en cualquier sillón
- **THEN** la respuesta es `422`

### Requirement: Máquina de estados del turno
El sistema SHALL permitir cambiar el estado de un turno solo según las transiciones `PROGRAMADO → CONFIRMADO | CANCELADO | ASISTIO | AUSENTE` y `CONFIRMADO → CANCELADO | ASISTIO | AUSENTE`. `CANCELADO`, `ASISTIO` y `AUSENTE` MUST ser finales. Toda otra transición MUST responder `409` sin modificar el turno. `ASISTIO` y `AUSENTE` MUST requerir que el inicio del turno ya haya pasado. El motivo de cancelación SHALL ser opcional y MUST aceptarse solo al cancelar.

#### Scenario: Confirmar un turno programado
- **WHEN** se cambia a `CONFIRMADO` un turno `PROGRAMADO`
- **THEN** la respuesta es `200` con `estado` `CONFIRMADO`

#### Scenario: Estado final sin salida
- **GIVEN** un turno `CANCELADO`
- **WHEN** se intenta cambiarlo a `CONFIRMADO`
- **THEN** la respuesta es `409` y el turno sigue `CANCELADO`

#### Scenario: Volver a programado
- **GIVEN** un turno `CONFIRMADO`
- **WHEN** se intenta cambiarlo a `PROGRAMADO`
- **THEN** la respuesta es `409`

#### Scenario: Asistencia de un turno futuro
- **GIVEN** un turno cuyo inicio es posterior al momento actual
- **WHEN** se intenta marcarlo `ASISTIO`
- **THEN** la respuesta es `409`

#### Scenario: Cancelación con motivo
- **WHEN** se cancela un turno con `motivoCancelacion`
- **THEN** la respuesta es `200` y el turno guarda el motivo

#### Scenario: Motivo con otro estado
- **WHEN** se cambia un turno a `CONFIRMADO` enviando `motivoCancelacion`
- **THEN** la respuesta es `400` con el campo `motivoCancelacion`

### Requirement: Reprogramación de turno
El sistema SHALL permitir mover el inicio, el sillón y/o el profesional de un turno `PROGRAMADO` o `CONFIRMADO`, conservando su duración y su estado, y MUST revalidar referencias, horario, grilla, bloqueos y solapamientos excluyendo al propio turno. Un turno en estado final MUST responder `409`. Si la validación falla, el turno MUST quedar sin cambios.

#### Scenario: Mover a un hueco libre
- **GIVEN** un turno de 30 minutos a las 10:00
- **WHEN** se reprograma a las 11:30
- **THEN** la respuesta es `200` con inicio 11:30 y fin 12:00

#### Scenario: Mover a un hueco ocupado
- **GIVEN** dos turnos, uno a las 10:00 y otro a las 11:00 en el sillón 1
- **WHEN** se reprograma el de las 10:00 a las 11:00 en el sillón 1
- **THEN** la respuesta es `409` y el turno sigue a las 10:00

#### Scenario: Correr sobre sí mismo
- **GIVEN** un turno de 60 minutos de 10:00 a 11:00
- **WHEN** se reprograma a las 10:30 en el mismo sillón
- **THEN** la respuesta es `200` (el propio turno no cuenta como conflicto)

#### Scenario: Reprogramar un turno final
- **GIVEN** un turno `ASISTIO`
- **WHEN** se intenta reprogramar
- **THEN** la respuesta es `409`

#### Scenario: Duración original tras editar la prestación
- **GIVEN** un turno de 30 minutos cuya prestación pasó a durar 45 minutos
- **WHEN** se reprograma
- **THEN** el turno sigue durando 30 minutos

### Requirement: Consulta de agenda
El sistema SHALL listar los turnos del consultorio que se intersequen con un rango `[desde, hasta)` obligatorio de hasta 42 días, ordenados por inicio, con filtros opcionales por sillón y profesional, excluyendo los cancelados salvo que se pidan. Cada turno MUST exponer sus ids de sillón y profesional, el id, nombre y apellido del paciente y el id y nombre de la prestación, y MUST NOT exponer `consultorioId` ni datos internos de persistencia. Las consultas de agenda MUST NOT registrarse en la auditoría.

#### Scenario: Vista diaria
- **GIVEN** turnos el lunes y el martes
- **WHEN** se consulta el rango del lunes
- **THEN** se devuelven solo los del lunes, ordenados por inicio

#### Scenario: Cancelados a pedido
- **GIVEN** un turno cancelado en el rango
- **WHEN** se consulta sin `incluirCancelados`
- **THEN** no aparece; con `incluirCancelados=true` aparece

#### Scenario: Rango inválido
- **WHEN** se consulta sin `hasta`, con `desde` posterior a `hasta` o con un rango de más de 42 días
- **THEN** la respuesta es `400`

#### Scenario: Turno por id ajeno
- **WHEN** se consulta por id un turno de otro consultorio
- **THEN** la respuesta es `404`

### Requirement: Auditoría de escrituras de turnos
Toda alta, cambio de estado y reprogramación exitosa MUST registrar en la auditoría, dentro de la misma transacción, una entrada con entidad `Turno` y el id del turno: `CREATE` en el alta con la marca de sobreturno, y `UPDATE` en el cambio de estado (estado anterior y nuevo) y en la reprogramación (inicio, sillón y profesional anteriores y marca de sobreturno). El detalle MUST NOT contener datos del paciente, notas ni motivo de cancelación. Si el registro de auditoría falla, la operación MUST revertirse. Una operación rechazada MUST NOT dejar entrada.

#### Scenario: Sobreturno auditado
- **WHEN** se crea un turno con `sobreturno` verdadero
- **THEN** existe una entrada `CREATE` de `Turno` con ese id y `detalle.sobreturno` verdadero

#### Scenario: Reprogramación con historial
- **GIVEN** un turno a las 10:00 en el sillón 1
- **WHEN** se reprograma a las 11:00 en el sillón 2
- **THEN** existe una entrada `UPDATE` con `detalle.operacion` `REPROGRAMAR`, `inicioAnterior` de las 10:00 y `sillonIdAnterior` 1

#### Scenario: Rechazo sin auditoría
- **WHEN** un alta es rechazada con `409`
- **THEN** no se agrega ninguna entrada de auditoría

#### Scenario: Fallo de auditoría revierte el alta
- **GIVEN** que el registro de auditoría no puede insertarse
- **WHEN** se crea un turno válido
- **THEN** la respuesta es `500` genérica y el turno no existe

### Requirement: Concurrencia sin solapamientos
Dos escrituras simultáneas de turnos del mismo consultorio MUST NOT poder dejar dos turnos no cancelados solapados en el mismo sillón, ni en el mismo profesional sin sobreturno. Las escrituras de turnos de un consultorio MUST serializarse mediante un bloqueo pesimista tomado antes de cualquier validación, y MUST NOT bloquear las de otro consultorio.

#### Scenario: Dos altas simultáneas en el mismo hueco
- **GIVEN** dos pedidos simultáneos de turno de 10:00 a 10:30 y de 10:15 a 10:45 en el mismo sillón
- **WHEN** ambos se procesan a la vez
- **THEN** exactamente uno se crea y el otro recibe conflicto con el id del creado

#### Scenario: Dos reprogramaciones hacia el mismo hueco
- **GIVEN** dos turnos que se reprograman a la vez hacia el mismo horario y sillón
- **WHEN** ambos se procesan a la vez
- **THEN** exactamente uno se mueve y el otro recibe conflicto y queda sin cambios

### Requirement: Permisos y aislamiento de turnos
Las operaciones de turnos SHALL estar permitidas a `ADMIN`, `PROFESIONAL` y `RECEPCION` y MUST responder `401` sin token. Todo acceso MUST quedar acotado al consultorio del token: un id de turno de otro consultorio MUST responder `404` y una referencia de otro consultorio en el cuerpo MUST responder `422`. Los errores MUST NOT contener datos del paciente ni valores enviados por el cliente.

#### Scenario: Recepción crea turnos
- **WHEN** un usuario `RECEPCION` crea un turno válido
- **THEN** la respuesta es `201`

#### Scenario: Sin token
- **WHEN** se llama a cualquier endpoint de turnos sin token
- **THEN** la respuesta es `401`

#### Scenario: Turno de otro consultorio
- **GIVEN** un turno del consultorio B
- **WHEN** un usuario de A intenta consultarlo, cambiarle el estado o reprogramarlo
- **THEN** la respuesta es `404` y el turno de B no cambia

#### Scenario: Listado aislado
- **GIVEN** turnos en A y en B en el mismo rango
- **WHEN** un usuario de A consulta la agenda
- **THEN** solo recibe los turnos de A
