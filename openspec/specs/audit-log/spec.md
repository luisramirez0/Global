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
