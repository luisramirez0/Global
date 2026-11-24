# Spec Delta

## Purpose

Permitir que el personal de un consultorio registre, busque, edite, dé de baja y reactive a sus pacientes, con DNI único por consultorio y teléfono en formato E.164 listo para los recordatorios, sin borrar nunca un paciente y sin exponer pacientes de otros consultorios.

## ADDED Requirements

### Requirement: Alta de paciente
El backend SHALL permitir crear un paciente con nombre, apellido y DNI obligatorios y fecha de nacimiento, sexo, teléfono, email, dirección y obra social (texto libre) opcionales. El paciente MUST quedar asignado al consultorio del token y activo, y la respuesta MUST ser `201` con el encabezado `Location` y los datos guardados (ya normalizados).

#### Scenario: Alta válida
- **GIVEN** un usuario autenticado del consultorio A
- **WHEN** envía `POST /api/pacientes` con nombre `Ana`, apellido `Pérez`, DNI `30.111.222` y teléfono `+54 9 11 2345-6789`
- **THEN** la respuesta es `201` con `Location` `/api/pacientes/{id}`, DNI `30111222`, teléfono `+5491123456789` y `activo` verdadero
- **AND** el paciente pertenece al consultorio A

#### Scenario: Campos obligatorios ausentes
- **WHEN** se envía un alta sin apellido
- **THEN** la respuesta es `400` y nombra el campo `apellido`

### Requirement: DNI válido y único por consultorio
El DNI MUST guardarse normalizado (sin puntos, espacios ni guiones) y MUST tener 7 u 8 dígitos. Dos pacientes del mismo consultorio MUST NOT tener el mismo DNI normalizado, aunque uno esté dado de baja; un alta o edición que lo intente MUST responder `409` indicando el id del paciente existente y sin repetir el DNI. El mismo DNI SHALL poder existir en consultorios distintos.

#### Scenario: DNI duplicado con otro formato
- **GIVEN** el consultorio A tiene el paciente P1 con DNI `30111222`
- **WHEN** se da de alta en A otro paciente con DNI `30.111.222`
- **THEN** la respuesta es `409` con `pacienteId` igual al id de P1 y el cuerpo no contiene `30111222`

#### Scenario: DNI duplicado de un paciente dado de baja
- **GIVEN** el paciente P1 del consultorio A con DNI `30111222` está dado de baja
- **WHEN** se da de alta en A otro paciente con DNI `30111222`
- **THEN** la respuesta es `409` con `pacienteId` igual al id de P1

#### Scenario: Mismo DNI en otro consultorio
- **GIVEN** el consultorio B tiene un paciente con DNI `30111222`
- **WHEN** el consultorio A da de alta un paciente con DNI `30111222`
- **THEN** la respuesta es `201`

#### Scenario: DNI con formato inválido
- **WHEN** se envía un alta con DNI `12AB`
- **THEN** la respuesta es `400`, nombra el campo `dni` y no contiene `12AB`

#### Scenario: Altas simultáneas con el mismo DNI
- **WHEN** dos altas del mismo DNI en el consultorio A llegan al mismo tiempo
- **THEN** una responde `201` y la otra `409`, y queda un solo paciente con ese DNI

### Requirement: Teléfono en formato E.164
Si se informa un teléfono, el backend MUST guardarlo en formato E.164 (`+` seguido de 8 a 15 dígitos, el primero distinto de cero), quitando espacios, guiones, puntos y paréntesis; un teléfono que no cumpla el formato tras esa limpieza MUST ser rechazado con `400`. El teléfono vacío SHALL guardarse como ausente.

#### Scenario: Teléfono con separadores
- **WHEN** se envía el teléfono `+54 (9) 11 2345.6789`
- **THEN** se guarda `+5491123456789`

#### Scenario: Teléfono sin código de país
- **WHEN** se envía el teléfono `011 15 2345 6789`
- **THEN** la respuesta es `400`, nombra el campo `telefono` y no contiene el número enviado

#### Scenario: Teléfono vacío
- **WHEN** se envía el teléfono `"  "`
- **THEN** el paciente se guarda sin teléfono

### Requirement: Consulta y búsqueda de pacientes
El backend SHALL listar los pacientes del consultorio en curso paginados (tamaño por defecto 20, máximo 50) y ordenados por apellido, nombre e id. El parámetro `q` MUST filtrar por nombre o apellido que contengan el texto sin distinguir mayúsculas, o por DNI que empiece con los dígitos de `q`. Por defecto MUST listar solo pacientes activos; con `incluirInactivos=true` SHALL incluir los dados de baja.

#### Scenario: Búsqueda por apellido
- **GIVEN** el consultorio A tiene a `Ana Pérez` y `Luis Gómez`
- **WHEN** se envía `GET /api/pacientes?q=pér`
- **THEN** el resultado contiene solo a `Ana Pérez`

#### Scenario: Búsqueda por nombre y apellido
- **WHEN** se envía `GET /api/pacientes?q=ana pér`
- **THEN** el resultado contiene a `Ana Pérez`

#### Scenario: Búsqueda por DNI con puntos
- **GIVEN** `Ana Pérez` tiene DNI `30111222`
- **WHEN** se envía `GET /api/pacientes?q=30.111`
- **THEN** el resultado contiene a `Ana Pérez`

#### Scenario: Comodines escapados
- **WHEN** se envía `GET /api/pacientes?q=%`
- **THEN** solo se devuelven pacientes cuyo nombre, apellido o DNI contenga el carácter `%`

#### Scenario: Inactivos excluidos por defecto
- **GIVEN** el paciente P1 está dado de baja
- **WHEN** se lista sin `incluirInactivos`
- **THEN** P1 no aparece, y con `incluirInactivos=true` sí aparece

#### Scenario: Paginación acotada
- **WHEN** se envía `GET /api/pacientes?size=500`
- **THEN** la página devuelta tiene como máximo 50 elementos e informa el total de elementos y de páginas

#### Scenario: Detalle de un paciente
- **WHEN** se envía `GET /api/pacientes/{id}` con el id de un paciente del consultorio
- **THEN** la respuesta es `200` con sus datos, incluido `activo`

### Requirement: Edición de paciente
El backend SHALL permitir reemplazar los datos personales y de contacto de un paciente del consultorio en curso, con las mismas validaciones y normalizaciones que el alta. La edición MUST NOT cambiar el estado activo/inactivo y MUST responder `409` si el nuevo DNI pertenece a otro paciente del consultorio.

#### Scenario: Edición válida
- **WHEN** se envía `PUT /api/pacientes/{id}` con un teléfono nuevo
- **THEN** la respuesta es `200` con el teléfono nuevo normalizado

#### Scenario: Edición con DNI de otro paciente
- **GIVEN** P1 y P2 en el consultorio A
- **WHEN** se edita P2 con el DNI de P1
- **THEN** la respuesta es `409` y P2 conserva su DNI

#### Scenario: Edición conservando el propio DNI
- **WHEN** se edita P1 enviando su mismo DNI
- **THEN** la respuesta es `200`

### Requirement: Baja lógica y reactivación
La baja de un paciente MUST marcarlo inactivo sin borrarlo físicamente, conservando sus datos y relaciones (RN-PA-03), y MUST ser idempotente. El backend SHALL permitir reactivar un paciente dado de baja. Ambas operaciones responden `204`.

#### Scenario: Baja lógica
- **WHEN** se envía `DELETE /api/pacientes/{id}`
- **THEN** la respuesta es `204`, el paciente sigue existiendo con `activo` falso y `GET /api/pacientes/{id}` lo devuelve

#### Scenario: Baja repetida
- **GIVEN** un paciente ya dado de baja
- **WHEN** se envía de nuevo `DELETE /api/pacientes/{id}`
- **THEN** la respuesta es `204` y no hay cambios

#### Scenario: Reactivación
- **GIVEN** un paciente dado de baja
- **WHEN** se envía `POST /api/pacientes/{id}/reactivar`
- **THEN** la respuesta es `204` y el paciente vuelve a aparecer en el listado por defecto

### Requirement: Permisos por rol sobre pacientes
`ADMIN`, `PROFESIONAL` y `RECEPCION` SHALL poder crear, consultar y editar pacientes. La baja y la reactivación MUST requerir `ADMIN` o `PROFESIONAL`; `RECEPCION` MUST recibir `403` sin que el paciente cambie.

#### Scenario: Recepción opera datos de contacto
- **GIVEN** un token con rol `RECEPCION`
- **WHEN** crea, consulta y edita un paciente
- **THEN** las respuestas son `201`, `200` y `200`

#### Scenario: Recepción no da de baja
- **GIVEN** un token con rol `RECEPCION`
- **WHEN** envía `DELETE /api/pacientes/{id}` o `POST /api/pacientes/{id}/reactivar`
- **THEN** la respuesta es `403` y el estado del paciente no cambia

### Requirement: Pacientes aislados por consultorio
Toda operación sobre pacientes MUST acotarse al consultorio del token. Un id de paciente de otro consultorio MUST tratarse igual que uno inexistente: `404` con el mismo cuerpo, sin leer ni modificar el registro ajeno.

#### Scenario: Listado sin pacientes ajenos
- **GIVEN** el consultorio A tiene a P1 y el consultorio B a P3
- **WHEN** el usuario de A lista pacientes, también con `q` igual al DNI de P3
- **THEN** el resultado contiene solo pacientes de A

#### Scenario: Operaciones sobre un paciente ajeno
- **GIVEN** P3 pertenece al consultorio B
- **WHEN** el usuario de A envía `GET`, `PUT`, `DELETE` o `POST …/reactivar` sobre el id de P3
- **THEN** cada respuesta es `404`, idéntica a la de un id inexistente, y P3 no cambia

### Requirement: Datos personales fuera de logs y errores
Las respuestas de error y los logs de la gestión de pacientes MUST NOT contener nombre, DNI, teléfono, email ni dirección de pacientes; los logs SHALL identificar al paciente solo por su id.

#### Scenario: Alta rechazada sin eco de datos
- **WHEN** un alta falla por DNI duplicado o teléfono inválido
- **THEN** ni la respuesta ni la salida de log contienen el DNI, el teléfono ni el nombre enviados
