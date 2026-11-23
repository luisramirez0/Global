# tenant-isolation Specification

## Purpose

Garantizar que todo dato de negocio quede confinado al consultorio (tenant) al que pertenece: las lecturas y escrituras se acotan automáticamente al consultorio en curso y, si no hay consultorio en curso, el acceso falla en lugar de exponer datos.

## Requirements

### Requirement: Contexto de tenant por operación
El backend SHALL mantener un contexto de tenant que identifica el consultorio en curso para cada operación (request o tarea), que se puede fijar, consultar y limpiar, y que MUST quedar vacío al terminar la operación para no filtrarse a la siguiente que use el mismo hilo.

#### Scenario: Tenant fijado y consultado
- **GIVEN** se fija el consultorio 7 como tenant en curso
- **WHEN** se consulta el tenant en curso
- **THEN** el resultado es el consultorio 7

#### Scenario: Tenant limpiado al terminar
- **GIVEN** una operación ejecutada con el consultorio 7 como tenant
- **WHEN** la operación termina, con éxito o con error
- **THEN** el contexto de tenant queda vacío

### Requirement: Lecturas acotadas al consultorio en curso
Toda lectura de datos de negocio (consultas, búsquedas por criterio y búsqueda por id) MUST devolver solo registros cuyo `consultorio_id` sea el del tenant en curso, sin que cada consulta tenga que agregar el filtro manualmente.

#### Scenario: Listado aislado entre dos consultorios
- **GIVEN** el consultorio A tiene los pacientes P1 y P2 y el consultorio B tiene el paciente P3
- **WHEN** con tenant A se listan todos los pacientes
- **THEN** el resultado contiene exactamente P1 y P2

#### Scenario: Búsqueda por id de otro consultorio
- **GIVEN** el paciente P3 pertenece al consultorio B
- **WHEN** con tenant A se busca el paciente por el id de P3
- **THEN** el resultado está vacío

#### Scenario: Búsqueda por criterio no cruza consultorios
- **GIVEN** los consultorios A y B tienen cada uno un paciente con DNI 30111222
- **WHEN** con tenant A se busca el paciente por DNI 30111222
- **THEN** se obtiene solo el paciente del consultorio A

#### Scenario: Aislamiento en todas las entidades de negocio
- **GIVEN** existen registros de cada tabla de negocio en los consultorios A y B
- **WHEN** con tenant A se listan los registros de cada una
- **THEN** ninguna devuelve registros del consultorio B

### Requirement: Escrituras asignadas al consultorio en curso
Al crear un registro de negocio el backend SHALL asignarle el `consultorio_id` del tenant en curso, y MUST rechazar la creación o modificación de un registro cuyo `consultorio_id` no coincida con el tenant en curso.

#### Scenario: Alta con consultorio automático
- **GIVEN** el tenant en curso es el consultorio A
- **WHEN** se guarda un sillón nuevo sin indicar consultorio
- **THEN** el sillón queda persistido con `consultorio_id` de A

#### Scenario: Alta con consultorio ajeno rechazada
- **GIVEN** el tenant en curso es el consultorio A
- **WHEN** se intenta guardar un sillón con `consultorio_id` de B
- **THEN** la operación falla y no se persiste ningún registro

### Requirement: Referencias entre consultorios imposibles
La base de datos MUST impedir que un registro de un consultorio referencie a un registro padre de otro consultorio (por ejemplo, un turno de A con un paciente de B), aunque la aplicación lo intente.

#### Scenario: Turno con paciente de otro consultorio
- **GIVEN** el paciente P3 pertenece al consultorio B
- **WHEN** se inserta un turno del consultorio A que referencia a P3
- **THEN** la base rechaza la inserción por violación de clave foránea

### Requirement: Fail-closed sin tenant
Si no hay tenant en curso y no se declaró explícitamente el modo sistema, todo acceso a datos de negocio MUST fallar con un error de tenant ausente, sin devolver registros ni persistir cambios.

#### Scenario: Lectura sin tenant
- **GIVEN** el contexto de tenant está vacío
- **WHEN** se listan los pacientes
- **THEN** la operación falla con error de tenant ausente y no devuelve datos

#### Scenario: Escritura sin tenant
- **GIVEN** el contexto de tenant está vacío
- **WHEN** se intenta guardar un paciente
- **THEN** la operación falla con error de tenant ausente y no se persiste nada

### Requirement: Modo sistema explícito
El backend SHALL ofrecer un modo sistema, que se activa solo de forma explícita y acotada a un bloque de código, para operaciones legítimas que no tienen tenant previo (búsqueda de usuario por email en el login, alta de consultorio, seed de desarrollo); fuera de ese bloque MUST restablecerse el comportamiento fail-closed.

#### Scenario: Login busca usuario sin tenant
- **GIVEN** existe el usuario `admin@a.test` del consultorio A y no hay tenant en curso
- **WHEN** dentro del modo sistema se busca el usuario por email `admin@a.test`
- **THEN** se obtiene el usuario con su `consultorio_id`

#### Scenario: Modo sistema no persiste
- **GIVEN** un bloque ejecutado en modo sistema terminó
- **WHEN** a continuación se listan pacientes sin tenant en curso
- **THEN** la operación falla con error de tenant ausente
