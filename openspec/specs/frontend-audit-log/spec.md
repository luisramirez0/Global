# frontend-audit-log Specification

## Purpose

Pantalla de consulta y filtros del log de auditoría y componente de exportación de los datos de un paciente en el frontend, con acceso solo para ADMIN y PROFESIONAL y contenido renderizado como texto, definidos en C-15.

## Requirements

### Requirement: Consulta del log de auditoría
La aplicación SHALL ofrecer en `#/auditoria` una tabla paginada del log de auditoría del consultorio con fecha en hora local, id de usuario, acción, entidad, id de entidad, detalle e IP. Todo valor recibido MUST mostrarse como texto literal. Mientras carga SHALL indicar el estado; sin entradas SHALL mostrar un mensaje de vacío; ante un error de red SHALL ofrecer "Reintentar".

#### Scenario: Log con entradas
- **GIVEN** la API devuelve dos entradas, una con detalle `{"fichaId":3,"version":1}`
- **WHEN** el `ADMIN` abre `#/auditoria`
- **THEN** la tabla muestra dos filas y la primera muestra el detalle como `fichaId: 3, version: 1`

#### Scenario: Detalle o entidad maliciosos
- **GIVEN** una entrada cuya entidad es `<img src=x onerror=alert(1)>`
- **WHEN** se muestra la tabla
- **THEN** se ve el texto literal y la tabla no contiene elementos `img`

#### Scenario: Paginado
- **GIVEN** la API informa tres páginas
- **WHEN** se pulsa "Siguiente"
- **THEN** se pide la página 1 con los mismos filtros

### Requirement: Filtros del log de auditoría
La pantalla SHALL permitir filtrar por rango de fechas (en hora del consultorio, enviado como instantes UTC con `hasta` exclusivo al inicio del día siguiente), acción, entidad, id de entidad y id de usuario. El id de entidad MUST poder indicarse solo con una entidad elegida y MUST enviarse junto con ella. Un `400` de la API SHALL mostrarse como un mensaje fijo de filtros inválidos.

#### Scenario: Filtro por entidad e id
- **WHEN** el usuario elige la entidad `FichaClinica`, escribe el id 7 y aplica los filtros
- **THEN** se pide `GET /api/auditoria?entidad=FichaClinica&entidadId=7&page=0`

#### Scenario: Id de entidad sin entidad
- **GIVEN** no hay entidad elegida
- **THEN** el campo de id de entidad está deshabilitado

#### Scenario: Rango de un día
- **WHEN** el usuario filtra desde 2026-11-24 hasta 2026-11-24 en un consultorio de Buenos Aires
- **THEN** se pide `desde=2026-11-24T03:00:00Z&hasta=2026-11-25T03:00:00Z`

### Requirement: Acceso a la auditoría por rol
La pantalla de auditoría MUST mostrarse con datos solo a `ADMIN` y `PROFESIONAL`. Con rol `RECEPCION` MUST mostrar un mensaje de sin permiso sin pedir datos a la API; un `403` de la API MUST mostrarse con el mismo mensaje.

#### Scenario: Recepción en la auditoría
- **GIVEN** una sesión con rol `RECEPCION`
- **WHEN** navega a `#/auditoria`
- **THEN** ve el mensaje de sin permiso y no se hace ninguna request a `/api/auditoria`

### Requirement: Exportación de datos de un paciente desde la UI
La aplicación SHALL ofrecer un componente reutilizable que exporte los datos de un paciente por su id: pide el export con el token en el encabezado, descarga el JSON recibido como archivo `paciente-<id>-export.json` y libera el recurso temporal. Mientras descarga el botón MUST estar deshabilitado. El componente MUST NOT mostrar el contenido exportado, guardarlo en almacenamiento local ni escribirlo en la consola. Ante `403`, `404` o error de red SHALL mostrar un mensaje fijo. En el MVP el componente se monta en `#/auditoria`.

#### Scenario: Export descargado
- **WHEN** el `PROFESIONAL` indica el paciente 7 y pulsa "Exportar"
- **THEN** se pide `GET /api/pacientes/7/export` y se descarga `paciente-7-export.json`

#### Scenario: Paciente inexistente
- **GIVEN** la API responde `404`
- **WHEN** se pulsa "Exportar"
- **THEN** se ve el mensaje de paciente no encontrado y no se descarga nada
