# patient-data-export Specification

## Purpose

Exportación JSON completa de los datos de un paciente (datos personales, consentimientos, ficha clínica, notas y turnos) para ADMIN y PROFESIONAL de su consultorio, auditada como `EXPORT` y sin datos de salud ni PII en logs, definida en C-15.

## Requirements

### Requirement: Exportación de los datos de un paciente
El backend SHALL exponer `GET /api/pacientes/{id}/export`, que devuelve en un único JSON los datos personales del paciente, sus consentimientos, su ficha clínica (`null` si no fue cargada), sus notas clínicas y sus turnos de todos los estados, junto con la fecha de exportación del servidor. La respuesta MUST indicar descarga como adjunto con un nombre de archivo que contenga solo el id del paciente y MUST prohibir el almacenamiento en caché. El paquete MUST NOT incluir el consultorio, datos técnicos de versión ni el registro de auditoría.

#### Scenario: Export completo
- **GIVEN** el paciente 7 del consultorio A con un consentimiento, la ficha cargada, dos notas y dos turnos
- **WHEN** el `PROFESIONAL` de A pide `GET /api/pacientes/7/export`
- **THEN** la respuesta es `200` con los datos del paciente, un consentimiento, la ficha, las dos notas y los dos turnos en orden cronológico, y el encabezado `Content-Disposition` indica `attachment; filename="paciente-7-export.json"`

#### Scenario: Paciente sin ficha ni consentimiento
- **GIVEN** el paciente 8 sin consentimiento, sin ficha, sin notas ni turnos
- **WHEN** el `ADMIN` pide su export
- **THEN** la respuesta es `200` con los datos del paciente, `ficha` en `null` y listas vacías

#### Scenario: Paciente dado de baja
- **GIVEN** el paciente 7 dado de baja
- **WHEN** se pide su export
- **THEN** la respuesta es `200` con `activo` en `false`

### Requirement: Export restringido por rol y consultorio
`GET /api/pacientes/{id}/export` MUST requerir rol `ADMIN` o `PROFESIONAL`; `RECEPCION` MUST recibir `403` y una request sin token `401`. Un paciente de otro consultorio o inexistente MUST responder `404` sin datos. Ningún rechazo SHALL dejar entrada de auditoría.

#### Scenario: Recepción sin acceso
- **GIVEN** un token válido con rol `RECEPCION`
- **WHEN** pide el export de un paciente de su consultorio
- **THEN** la respuesta es `403` y no hay entrada `EXPORT`

#### Scenario: Paciente de otro consultorio
- **GIVEN** el paciente 9 del consultorio B
- **WHEN** el `ADMIN` de A pide `GET /api/pacientes/9/export`
- **THEN** la respuesta es `404`, sin datos del paciente y sin entrada `EXPORT`

### Requirement: Auditoría de cada exportación
Cada export exitoso MUST registrar una entrada `EXPORT` sobre la entidad `Paciente` con id de entidad igual al id del paciente, el usuario del token y un detalle con la cantidad de consentimientos, notas y turnos y si había ficha, sin contenido clínico ni datos personales. El registro MUST confirmarse junto con la lectura en una transacción de lectura-escritura; si no puede guardarse, la respuesta MUST ser un `500` genérico sin datos del paciente.

#### Scenario: Export auditado
- **WHEN** el usuario 5 exporta los datos del paciente 7, que tiene ficha, un consentimiento, dos notas y dos turnos
- **THEN** existe una entrada `EXPORT` con entidad `Paciente`, id de entidad 7, usuario 5 y detalle `{"consentimientos":1,"ficha":true,"notas":2,"turnos":2}`

#### Scenario: Auditoría imposible
- **GIVEN** un token cuyo usuario no existe en el consultorio, de modo que la entrada de auditoría es rechazada
- **WHEN** pide el export del paciente 7
- **THEN** la respuesta es `500` genérico y el cuerpo no contiene datos del paciente ni de su ficha

### Requirement: Export sin datos de salud en logs
Los logs de la aplicación durante un export, exitoso o fallido, MUST contener solo identificadores y tipos de error, nunca nombre, DNI ni texto clínico.

#### Scenario: Log de un export
- **WHEN** se exporta un paciente con apellido y alergias conocidos
- **THEN** la salida de log no contiene ese apellido, ese DNI ni ese texto de alergias
