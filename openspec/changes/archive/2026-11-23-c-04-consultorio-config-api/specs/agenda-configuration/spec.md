# Spec Delta

## Purpose

Permitir que un consultorio administre por API la configuración de su agenda (sillones, prestaciones con su duración, horarios de atención y bloqueos) con validaciones de negocio, permisos por rol y aislamiento por consultorio, como base para el motor de turnos.

## ADDED Requirements

### Requirement: Representación de la configuración por DTO
Las respuestas de `/api/sillones`, `/api/prestaciones`, `/api/horarios-atencion` y `/api/bloqueos` SHALL exponer solo los campos del recurso y los ids de sus referencias (sillón, profesional), y MUST NOT exponer `consultorio_id`, objetos anidados de otras entidades ni campos internos de persistencia.

#### Scenario: Sillón sin datos internos
- **WHEN** un usuario autenticado consulta un sillón de su consultorio
- **THEN** la respuesta contiene `id`, `nombre` y `activo` y no contiene `consultorioId`

#### Scenario: Bloqueo con referencias por id
- **GIVEN** un bloqueo del sillón 3
- **WHEN** se consulta el bloqueo
- **THEN** la respuesta contiene `sillonId` 3 y no contiene un objeto sillón anidado

### Requirement: Grilla de agenda configurable y provisional
El sistema SHALL tomar la grilla de la agenda de un único valor configurado, usado por todas las validaciones de grilla. Su valor actual MUST ser 15 minutos, provisional hasta validarlo con un odontólogo (PA-03).

#### Scenario: Valor provisional vigente
- **GIVEN** la grilla configurada con su valor provisional de 15 minutos
- **WHEN** se valida una duración o una hora contra la grilla
- **THEN** se usa 15 minutos como unidad

### Requirement: Gestión de sillones
El sistema SHALL permitir crear, listar, consultar, editar (nombre y estado activo) y dar de baja lógica sillones del consultorio en curso. El nombre MUST ser obligatorio, no vacío y de hasta 100 caracteres. La baja MUST ser lógica (`activo` falso), sin borrar el registro.

#### Scenario: Alta de sillón
- **GIVEN** un consultorio con un sillón activo
- **WHEN** un `PROFESIONAL` crea el sillón "Sillón 2"
- **THEN** la respuesta es `201` con el sillón creado y activo

#### Scenario: Nombre vacío
- **WHEN** se crea un sillón con nombre en blanco
- **THEN** la respuesta es `400` y nombra el campo `nombre`

#### Scenario: Baja lógica
- **GIVEN** un consultorio con dos sillones activos
- **WHEN** se da de baja uno de ellos
- **THEN** la respuesta es `204`, el sillón sigue existiendo con `activo` falso y el listado por defecto ya no lo incluye

### Requirement: Límite de sillones activos
Un consultorio MUST tener como máximo 2 sillones activos y al menos 1. Crear un sillón o reactivarlo por edición más allá del máximo, o desactivar (por edición o baja) el último sillón activo, MUST responder `409` sin modificar datos.

#### Scenario: Tercer sillón activo por alta
- **GIVEN** un consultorio con dos sillones activos
- **WHEN** se crea otro sillón
- **THEN** la respuesta es `409` y el consultorio sigue con dos sillones activos

#### Scenario: Reactivación más allá del límite
- **GIVEN** un consultorio con dos sillones activos y uno inactivo
- **WHEN** se edita el inactivo con `activo` verdadero
- **THEN** la respuesta es `409` y el sillón sigue inactivo

#### Scenario: Baja del último sillón activo
- **GIVEN** un consultorio con un único sillón activo
- **WHEN** se da de baja ese sillón
- **THEN** la respuesta es `409` y el sillón sigue activo

#### Scenario: Desactivación por edición del último sillón activo
- **GIVEN** un consultorio con un único sillón activo
- **WHEN** se edita ese sillón con `activo` falso
- **THEN** la respuesta es `409` y el sillón sigue activo

#### Scenario: Los inactivos no cuentan
- **GIVEN** un consultorio con un sillón activo y uno inactivo
- **WHEN** se crea un sillón nuevo
- **THEN** la respuesta es `201`

#### Scenario: Altas concurrentes
- **GIVEN** un consultorio con un sillón activo
- **WHEN** dos altas de sillón llegan al mismo tiempo
- **THEN** exactamente una responde `201`, la otra `409`, y quedan dos sillones activos

### Requirement: Gestión de prestaciones
El sistema SHALL permitir crear, listar, consultar, editar (nombre, duración, activo) y dar de baja lógica prestaciones del consultorio en curso. El nombre MUST ser obligatorio y de hasta 150 caracteres. Editar la duración MUST NOT alterar turnos ya registrados.

#### Scenario: Alta de prestación
- **WHEN** un `ADMIN` crea la prestación "Consulta" de 30 minutos
- **THEN** la respuesta es `201` con la prestación activa y `duracionMinutos` 30

#### Scenario: Baja lógica de prestación
- **WHEN** se da de baja una prestación
- **THEN** la respuesta es `204` y la prestación sigue existiendo con `activo` falso

### Requirement: Duración de prestación alineada a la grilla
La duración de una prestación MUST ser un entero positivo y múltiplo de la grilla configurada (RN-AG-03), al crear y al editar; en otro caso la respuesta MUST ser `400` nombrando el campo `duracionMinutos`. No se impone tope superior.

#### Scenario: Duración no múltiplo de la grilla
- **GIVEN** la grilla configurada en 15 minutos
- **WHEN** se crea una prestación de 20 minutos
- **THEN** la respuesta es `400` y nombra `duracionMinutos`

#### Scenario: Duración cero en edición
- **WHEN** se edita una prestación con duración 0
- **THEN** la respuesta es `400` y la prestación conserva su duración anterior

#### Scenario: Duración larga múltiplo de la grilla
- **GIVEN** la grilla configurada en 15 minutos
- **WHEN** se crea una prestación de 600 minutos
- **THEN** la respuesta es `201`

### Requirement: Gestión de horarios de atención
El sistema SHALL permitir crear, listar (opcionalmente por profesional), consultar, editar y borrar franjas de atención (profesional, día de semana 1..7 con lunes = 1, hora desde, hora hasta).

#### Scenario: Alta de franja
- **WHEN** se crea un horario lunes de 09:00 a 13:00 para el profesional del consultorio
- **THEN** la respuesta es `201` con `profesionalId`, `diaSemana` 1 y horas `09:00` y `13:00`

#### Scenario: Borrado de franja
- **WHEN** se borra una franja de atención
- **THEN** la respuesta es `204` y la franja ya no aparece en el listado

### Requirement: Profesional de una franja de atención
Si `profesionalId` se omite al crear o editar una franja, MUST usarse el único profesional activo del consultorio; con 0 o más de 1 activos la respuesta MUST ser `422`. Si se indica, MUST ser un profesional activo del consultorio en curso, sin importar cuántos haya; si no, `422`.

#### Scenario: Omitido con un profesional activo
- **GIVEN** un consultorio con exactamente un profesional activo
- **WHEN** se crea una franja sin `profesionalId`
- **THEN** la respuesta es `201` con el id de ese profesional

#### Scenario: Omitido sin profesionales activos
- **GIVEN** un consultorio cuyo único profesional está inactivo
- **WHEN** se crea una franja sin `profesionalId`
- **THEN** la respuesta es `422` y no se crea la franja

#### Scenario: Omitido con varios profesionales activos
- **GIVEN** un consultorio con dos profesionales activos
- **WHEN** se crea una franja sin `profesionalId`
- **THEN** la respuesta es `422` y no se crea la franja

#### Scenario: Indicado con varios profesionales activos
- **GIVEN** un consultorio con dos profesionales activos
- **WHEN** se crea una franja con el `profesionalId` de uno de ellos
- **THEN** la respuesta es `201` con ese profesional

#### Scenario: Indicado e inactivo
- **WHEN** se crea una franja con el `profesionalId` de un profesional inactivo del consultorio
- **THEN** la respuesta es `422`

### Requirement: Validez de las franjas de atención
Una franja MUST tener `diaSemana` entre 1 y 7, `horaDesde` anterior a `horaHasta` y, mientras la grilla esté vigente (condicionado a la validación de PA-03), ambas horas alineadas a la grilla configurada; en otro caso la respuesta MUST ser `400` nombrando el campo inválido.

#### Scenario: Hora hasta anterior a hora desde
- **WHEN** se crea un horario de 13:00 a 09:00
- **THEN** la respuesta es `400` y nombra `horaHasta`

#### Scenario: Hora fuera de la grilla
- **GIVEN** la grilla configurada en 15 minutos
- **WHEN** se crea un horario de 09:10 a 12:00
- **THEN** la respuesta es `400` y nombra `horaDesde`

#### Scenario: Día inválido
- **WHEN** se crea un horario con `diaSemana` 8
- **THEN** la respuesta es `400` y nombra `diaSemana`

### Requirement: Franjas de atención sin solapamiento
Dos franjas del mismo profesional y el mismo día MUST NOT solaparse; crear o editar una franja (incluido cambiar su día o profesional) de modo que se solape con otra MUST responder `409` sin modificar datos. Franjas adyacentes SHALL aceptarse.

#### Scenario: Alta solapada
- **GIVEN** el profesional atiende el lunes de 09:00 a 13:00
- **WHEN** se crea una franja del lunes de 12:00 a 15:00
- **THEN** la respuesta es `409`

#### Scenario: Franja adyacente
- **GIVEN** el profesional atiende el lunes de 09:00 a 13:00
- **WHEN** se crea una franja del lunes de 13:00 a 17:00
- **THEN** la respuesta es `201`

#### Scenario: Otro día no se solapa
- **GIVEN** el profesional atiende el lunes de 09:00 a 13:00
- **WHEN** se crea una franja del martes de 09:00 a 13:00
- **THEN** la respuesta es `201`

#### Scenario: Edición hacia un solapamiento
- **GIVEN** el profesional atiende el lunes de 09:00 a 13:00 y el martes de 09:00 a 13:00
- **WHEN** se edita la franja del martes a lunes de 11:00 a 14:00
- **THEN** la respuesta es `409` y la franja del martes no cambia

#### Scenario: Edición sin conflicto consigo misma
- **GIVEN** la franja del lunes de 09:00 a 13:00
- **WHEN** se edita esa misma franja a lunes de 09:00 a 14:00
- **THEN** la respuesta es `200`

#### Scenario: Altas solapadas concurrentes
- **WHEN** dos altas de franjas solapadas del mismo profesional y día llegan al mismo tiempo
- **THEN** exactamente una responde `201` y la otra `409`

### Requirement: Gestión de bloqueos de agenda
El sistema SHALL permitir crear, listar, consultar, editar y borrar bloqueos con `inicio` y `fin` en UTC (ISO-8601), `motivo` opcional de hasta 255 bytes y ámbito opcional por sillón y/o profesional; sin sillón ni profesional el bloqueo MUST aplicar a todo el consultorio. El listado SHALL admitir filtros `desde`, `hasta`, `sillonId` y `profesionalId` y ordenarse por `inicio`.

#### Scenario: Bloqueo por sillón
- **WHEN** se crea un bloqueo del sillón 1 del 2026-12-24T12:00:00Z al 2026-12-24T23:00:00Z
- **THEN** la respuesta es `201` con `sillonId` 1 y `profesionalId` nulo

#### Scenario: Bloqueo por profesional
- **WHEN** se crea un bloqueo del profesional del consultorio por vacaciones
- **THEN** la respuesta es `201` con ese `profesionalId` y `sillonId` nulo

#### Scenario: Bloqueo de todo el consultorio
- **WHEN** se crea un bloqueo sin sillón ni profesional
- **THEN** la respuesta es `201` con `sillonId` y `profesionalId` nulos

#### Scenario: Listado por rango
- **GIVEN** bloqueos en diciembre y en enero
- **WHEN** se listan con `desde` 2026-12-01T00:00:00Z y `hasta` 2027-01-01T00:00:00Z
- **THEN** se obtienen solo los bloqueos que se intersecan con diciembre, ordenados por `inicio`

### Requirement: Profesional de un bloqueo
En un bloqueo, `profesionalId` omitido MUST significar "sin ámbito de profesional" y MUST NOT completarse por defecto, haya 0, 1 o más profesionales activos. Si se indica, MUST existir en el consultorio en curso (activo o inactivo); si no, `422`.

#### Scenario: Omitido con un profesional activo
- **GIVEN** un consultorio con exactamente un profesional activo
- **WHEN** se crea un bloqueo sin `profesionalId`
- **THEN** la respuesta es `201` con `profesionalId` nulo

#### Scenario: Omitido sin profesionales activos
- **GIVEN** un consultorio sin profesionales activos
- **WHEN** se crea un bloqueo sin `profesionalId`
- **THEN** la respuesta es `201` con `profesionalId` nulo

#### Scenario: Omitido con varios profesionales activos
- **GIVEN** un consultorio con dos profesionales activos
- **WHEN** se crea un bloqueo sin `profesionalId`
- **THEN** la respuesta es `201` con `profesionalId` nulo

#### Scenario: Indicado e inexistente
- **WHEN** se crea un bloqueo con un `profesionalId` que no existe en el consultorio
- **THEN** la respuesta es `422`

### Requirement: Rango de bloqueo válido
Un bloqueo MUST tener `fin` posterior a `inicio`, al crear y al editar; en otro caso la respuesta MUST ser `400` nombrando el campo `fin`.

#### Scenario: Fin igual al inicio
- **WHEN** se crea un bloqueo con `inicio` y `fin` iguales
- **THEN** la respuesta es `400` y nombra `fin`

### Requirement: Referencias válidas dentro del consultorio
Un sillón o profesional referenciado en el cuerpo de una franja o un bloqueo MUST existir en el consultorio en curso; si no existe o pertenece a otro consultorio, la respuesta MUST ser `422` sin revelar si existe en otro consultorio.

#### Scenario: Sillón de otro consultorio
- **GIVEN** el sillón S de B
- **WHEN** el usuario de A crea un bloqueo con `sillonId` de S
- **THEN** la respuesta es `422` y no se crea el bloqueo

#### Scenario: Profesional inexistente
- **WHEN** se crea un horario con un `profesionalId` que no existe
- **THEN** la respuesta es `422`

### Requirement: Permisos sobre la configuración de agenda
Leer sillones, prestaciones, horarios y bloqueos SHALL permitirse a `ADMIN`, `PROFESIONAL` y `RECEPCION`. Crear, editar o dar de baja sillones, prestaciones y horarios MUST requerir `ADMIN` o `PROFESIONAL`. Crear y editar bloqueos SHALL permitirse a los tres roles; borrar bloqueos MUST requerir `ADMIN` o `PROFESIONAL`. Sin permiso: `403`.

#### Scenario: Recepción lee prestaciones
- **WHEN** un `RECEPCION` lista las prestaciones
- **THEN** la respuesta es `200`

#### Scenario: Recepción no modifica prestaciones
- **WHEN** un `RECEPCION` crea una prestación
- **THEN** la respuesta es `403` y no se crea la prestación

#### Scenario: Recepción crea un bloqueo
- **WHEN** un `RECEPCION` crea un bloqueo válido
- **THEN** la respuesta es `201`

#### Scenario: Recepción no borra bloqueos
- **WHEN** un `RECEPCION` borra un bloqueo
- **THEN** la respuesta es `403` y el bloqueo sigue existiendo

#### Scenario: Sin token
- **WHEN** se lista `/api/sillones` sin token
- **THEN** la respuesta es `401`

### Requirement: Aislamiento de la configuración entre consultorios
Toda operación de configuración MUST actuar solo sobre datos del consultorio del token. Leer, editar o borrar por id un recurso de otro consultorio MUST responder `404`, igual que un id inexistente, y los listados MUST NOT incluir registros de otro consultorio.

#### Scenario: Listado aislado
- **GIVEN** los consultorios A y B con sus propios sillones, prestaciones, horarios y bloqueos
- **WHEN** el usuario de A lista cada recurso
- **THEN** solo obtiene registros de A

#### Scenario: Edición de recurso ajeno
- **GIVEN** la prestación P de B
- **WHEN** el usuario de A edita P por id
- **THEN** la respuesta es `404` y P no cambia

#### Scenario: Borrado de recurso ajeno
- **GIVEN** el bloqueo K de B
- **WHEN** el usuario de A borra K por id
- **THEN** la respuesta es `404` y K sigue existiendo
