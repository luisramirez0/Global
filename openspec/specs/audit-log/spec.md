# audit-log Specification

## Purpose

Almacenar el registro de auditoría de accesos y cambios sobre datos sensibles de forma inmutable (solo inserción), aislado por consultorio, como base para el aspecto de auditoría de C-06 (RN-DS-02).

## Requirements

### Requirement: Registro de auditoría con campos mínimos
Cada registro de auditoría SHALL guardar consultorio, usuario (nullable para eventos sin usuario identificado), acción (`READ`, `CREATE`, `UPDATE`, `DELETE`, `EXPORT`, `LOGIN`), entidad, id de entidad, detalle, IP y fecha de creación en UTC, y MUST NOT guardar datos personales o de salud en el detalle.

#### Scenario: Alta de un registro de auditoría
- **GIVEN** el tenant en curso es el consultorio A y el usuario 5
- **WHEN** se registra la acción `READ` sobre la entidad `FichaClinica` con id 12
- **THEN** queda persistido un registro con consultorio A, usuario 5, acción `READ`, entidad `FichaClinica`, id de entidad 12 y fecha de creación

### Requirement: Auditoría solo inserción
Un registro de auditoría persistido MUST NOT poder modificarse ni borrarse a través de la aplicación: el acceso a datos de auditoría ofrece solo alta y consulta, y todo intento de actualización MUST fallar o no tener efecto sobre la fila guardada.

#### Scenario: Sin operaciones de borrado ni actualización
- **WHEN** se inspecciona la interfaz de acceso a datos de auditoría
- **THEN** expone solo operaciones de alta y de consulta

#### Scenario: Modificar una entidad cargada no cambia la fila
- **GIVEN** un registro de auditoría persistido con acción `READ`
- **WHEN** se carga, se cambia su acción a `DELETE` y se confirma la transacción
- **THEN** la fila en la base conserva la acción `READ`

#### Scenario: Actualización masiva rechazada
- **GIVEN** registros de auditoría persistidos
- **WHEN** se ejecuta una consulta de actualización o borrado sobre la entidad de auditoría
- **THEN** la operación falla con error

### Requirement: Auditoría aislada por consultorio
Las consultas de auditoría MUST devolver solo registros del consultorio en curso.

#### Scenario: Auditoría de otro consultorio invisible
- **GIVEN** existen registros de auditoría de los consultorios A y B
- **WHEN** con tenant A se listan los registros de auditoría
- **THEN** solo se obtienen los del consultorio A

### Requirement: Registro de acciones desde otros módulos
El backend SHALL ofrecer a los demás módulos un único mecanismo para registrar una acción auditable, tanto de forma explícita como declarando la acción sobre una operación. Cada registro MUST tomar el consultorio del tenant en curso y el usuario del token autenticado, sin que el módulo invocante los indique. Una operación declarada como auditada SHALL registrar una entrada solo cuando termina con éxito.

#### Scenario: Operación declarada como auditada
- **GIVEN** una operación de lectura declarada como auditada con acción `READ` sobre la entidad `FichaClinica` y el id tomado de su argumento
- **WHEN** el usuario 5 del consultorio A la invoca con id 12 y termina con éxito
- **THEN** existe una entrada con consultorio A, usuario 5, acción `READ`, entidad `FichaClinica` e id de entidad 12

#### Scenario: Id tomado del resultado de un alta
- **GIVEN** una operación de alta declarada como auditada con acción `CREATE` y el id tomado del resultado
- **WHEN** la operación crea el registro con id 40
- **THEN** la entrada `CREATE` tiene id de entidad 40

#### Scenario: Operación fallida no auditada
- **GIVEN** una operación declarada como auditada
- **WHEN** la operación termina con error de negocio, sin acceso o recurso inexistente
- **THEN** no se registra ninguna entrada para esa invocación

#### Scenario: Sin usuario autenticado
- **GIVEN** un proceso interno sin request ni token, ejecutando con tenant A
- **WHEN** registra una acción auditable
- **THEN** la entrada queda con consultorio A, usuario vacío e IP vacía

### Requirement: Fallo de auditoría hace fallar la operación
El registro de auditoría de una operación MUST confirmarse junto con la operación: si el registro no puede guardarse, la operación auditada MUST fallar, sus cambios MUST revertirse y la respuesta MUST ser un error `500` genérico, sin devolver los datos solicitados. El fallo SHALL quedar en el log de aplicación solo con identificadores y tipo de error.

#### Scenario: Lectura sin registro posible
- **GIVEN** una lectura auditada de datos clínicos y el registro de auditoría falla al guardarse
- **WHEN** se invoca la lectura por la API
- **THEN** la respuesta es `500` en formato `ProblemDetail` y no contiene los datos clínicos

#### Scenario: Alta revertida si falla la auditoría
- **GIVEN** un alta auditada y el registro de auditoría falla al guardarse
- **WHEN** se invoca el alta
- **THEN** la operación falla y el registro de negocio no queda persistido

#### Scenario: Log del fallo sin datos personales
- **WHEN** falla el registro de auditoría de una operación sobre el paciente 7
- **THEN** el log de aplicación nombra la acción, la entidad, el id 7 y el tipo de error, sin datos personales ni de salud

#### Scenario: Operación sin transacción rechazada
- **GIVEN** una operación declarada como auditada que se ejecuta sin poder unir el registro a su transacción
- **WHEN** se invoca
- **THEN** la operación falla en lugar de ejecutarse sin auditoría

### Requirement: Detalle estructurado y sin datos personales
El detalle de un registro SHALL ser un objeto JSON plano de claves cortas con valores numéricos, booleanos o códigos breves sin espacios. El backend MUST rechazar antes de guardar un detalle que no cumpla ese formato o supere el tamaño máximo, y MUST NOT permitir que datos ingresados por usuarios (nombres, DNI, teléfonos, emails, texto clínico) lleguen al detalle.

#### Scenario: Detalle válido
- **WHEN** se registra una acción con detalle `{"sobreturno": true, "turnoId": 31}`
- **THEN** la entrada guarda ese JSON tal cual

#### Scenario: Detalle con texto libre rechazado
- **WHEN** se intenta registrar una acción con detalle `{"nombre": "Ana Pérez"}`
- **THEN** el registro se rechaza y no se guarda ninguna entrada

#### Scenario: Detalle demasiado grande
- **WHEN** se intenta registrar un detalle cuyo JSON supera el tamaño máximo
- **THEN** el registro se rechaza

#### Scenario: Sin detalle
- **WHEN** se registra una acción sin detalle
- **THEN** la entrada queda con detalle vacío

### Requirement: IP del cliente en el registro
Cada registro hecho durante una request SHALL guardar la dirección del cliente tal como la ve el servidor (la conexión entrante o la ya resuelta por la configuración de proxy del servidor). El backend MUST NOT tomar la IP de encabezados enviados por el cliente, como `X-Forwarded-For`, por su cuenta.

#### Scenario: IP de la conexión
- **WHEN** una request desde `203.0.113.7` invoca una operación auditada
- **THEN** la entrada guarda la IP `203.0.113.7`

#### Scenario: Encabezado reenviado ignorado
- **GIVEN** la configuración por defecto, sin proxy de confianza
- **WHEN** una request desde `203.0.113.7` envía `X-Forwarded-For: 198.51.100.9`
- **THEN** la entrada guarda `203.0.113.7`

### Requirement: Consulta del registro de auditoría
El backend SHALL exponer `GET /api/auditoria`, paginado con el formato común de páginas, ordenado del más reciente al más antiguo, que devuelve id, fecha, usuario, acción, entidad, id de entidad, detalle e IP de cada entrada del consultorio en curso.

#### Scenario: Listado paginado
- **GIVEN** 25 entradas en el consultorio A
- **WHEN** un `ADMIN` de A pide `GET /api/auditoria?page=0&size=10`
- **THEN** la respuesta es `200` con 10 entradas, la más reciente primero, y un total de 25

#### Scenario: Tamaño de página acotado
- **WHEN** se pide `size=1000`
- **THEN** la página devuelta tiene como máximo el tamaño máximo permitido

#### Scenario: Detalle como objeto JSON
- **GIVEN** una entrada con detalle `{"resultado":"ok"}`
- **WHEN** se lista
- **THEN** la entrada trae `detalle` como objeto con `resultado` igual a `ok`

### Requirement: Filtros de la consulta de auditoría
`GET /api/auditoria` SHALL aceptar filtros opcionales combinables: rango de fechas (`desde` inclusivo, `hasta` exclusivo, en UTC), acción, entidad, id de entidad y usuario. Un filtro con formato inválido, una acción desconocida o un rango con `desde` posterior a `hasta` MUST responder `400` sin repetir el valor recibido. El filtro por id de entidad compara solo el número y MUST NOT interpretarse como propio de una entidad: para obtener los accesos a una entidad concreta (por ejemplo, la ficha clínica de un paciente) el consumidor MUST combinarlo con el filtro de entidad.

#### Scenario: Filtro por acción y entidad
- **GIVEN** entradas `READ` y `UPDATE` sobre `FichaClinica` y `LOGIN` sobre `Usuario`
- **WHEN** se pide `accion=READ&entidad=FichaClinica`
- **THEN** solo se obtienen las entradas `READ` sobre `FichaClinica`

#### Scenario: Filtro por rango de fechas
- **WHEN** se pide `desde=2026-11-01T00:00:00Z&hasta=2026-11-02T00:00:00Z`
- **THEN** solo se obtienen entradas con fecha dentro de ese rango

#### Scenario: Rango invertido
- **WHEN** se pide `desde` posterior a `hasta`
- **THEN** la respuesta es `400` en formato `ProblemDetail`

#### Scenario: Acción desconocida
- **WHEN** se pide `accion=BORRAR`
- **THEN** la respuesta es `400` y no contiene `BORRAR`

#### Scenario: Id de entidad compartido entre entidades
- **GIVEN** una entrada `READ` sobre `FichaClinica` con id de entidad 5 (paciente 5) y una entrada `CREATE` sobre `Turno` con id de entidad 5 (turno 5)
- **WHEN** se pide `entidadId=5`
- **THEN** se obtienen ambas entradas
- **AND WHEN** se pide `entidad=FichaClinica&entidadId=5`
- **THEN** solo se obtiene la entrada sobre `FichaClinica`

### Requirement: Consulta de auditoría restringida por rol y consultorio
`GET /api/auditoria` MUST requerir rol `ADMIN` o `PROFESIONAL`; `RECEPCION` MUST recibir `403` y una request sin token `401`. La consulta MUST devolver solo entradas del consultorio del token, aunque los filtros apunten a usuarios o entidades de otro consultorio.

#### Scenario: Recepción sin acceso
- **GIVEN** un token válido con rol `RECEPCION`
- **WHEN** pide `GET /api/auditoria`
- **THEN** la respuesta es `403`

#### Scenario: Profesional con acceso
- **GIVEN** un token válido con rol `PROFESIONAL`
- **WHEN** pide `GET /api/auditoria`
- **THEN** la respuesta es `200`

#### Scenario: Entradas de otro consultorio invisibles por la API
- **GIVEN** entradas en los consultorios A y B
- **WHEN** el `ADMIN` de A pide `GET /api/auditoria?usuarioId=<id de un usuario de B>`
- **THEN** la respuesta es `200` sin entradas del consultorio B
