# Spec Delta

## MODIFIED Requirements

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
