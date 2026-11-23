# Spec Delta

## Purpose

Definir el esquema relacional del MVP, versionado con Flyway, portable entre H2 (modo MySQL) y MySQL 8, con las columnas comunes, unicidades, índices y restricciones que el resto de los changes asume.

## ADDED Requirements

### Requirement: Migraciones versionadas y portables
El esquema SHALL crearse exclusivamente con migraciones Flyway versionadas (`V1` cuenta y configuración de agenda; `V2` pacientes, turnos, recordatorios y auditoría) que MUST aplicar sin errores tanto en H2 en modo MySQL como en MySQL 8, sin SQL exclusivo de un motor.

#### Scenario: Migraciones limpias en H2
- **GIVEN** una base H2 vacía en modo MySQL
- **WHEN** arranca la aplicación con el perfil `test`
- **THEN** Flyway aplica `V1` y `V2` sin errores, no quedan migraciones pendientes y existen las 15 tablas del modelo

#### Scenario: Hibernate valida el esquema
- **WHEN** arranca la aplicación con `ddl-auto: validate`
- **THEN** la validación de Hibernate entre entidades y tablas termina sin errores

### Requirement: Columnas comunes de las tablas de negocio
Toda tabla de negocio MUST tener `consultorio_id` no nulo con FK a `consultorio`, `created_at` y `updated_at` no nulos; se exceptúan `consultorio` (es el tenant), el catálogo global `consentimiento_texto` y `audit_log`, que tiene `created_at` pero no `updated_at` por ser inmutable.

#### Scenario: Columnas comunes presentes
- **WHEN** se inspecciona el esquema de cada tabla de negocio
- **THEN** cada una tiene las columnas `consultorio_id`, `created_at` y `updated_at` no nulas

#### Scenario: Timestamps automáticos
- **GIVEN** un reloj fijo en `2026-11-23T13:00:00Z`
- **WHEN** se crea un registro y luego se modifica con el reloj en `2026-11-23T14:00:00Z`
- **THEN** `created_at` vale `2026-11-23T13:00:00Z` y `updated_at` vale `2026-11-23T14:00:00Z`

### Requirement: Identificadores numéricos
Cada tabla SHALL usar como clave primaria un `id` entero de 64 bits generado por la base.

#### Scenario: Id generado al persistir
- **WHEN** se guarda un registro nuevo sin id
- **THEN** el registro recibe un id numérico positivo generado por la base

### Requirement: Fechas y horas en UTC
Los instantes (inicio y fin de turnos y bloqueos, timestamps de auditoría y de registro) MUST persistirse en UTC independientemente de la zona horaria de la JVM o del servidor de base; las fechas sin hora (nacimiento) y las horas de atención se guardan sin zona.

#### Scenario: Instante preservado con JVM en otra zona
- **GIVEN** la JVM corre con zona `America/Argentina/Buenos_Aires`
- **WHEN** se guarda un turno con inicio `2026-11-24T12:00:00Z` y se vuelve a leer
- **THEN** el inicio leído es exactamente `2026-11-24T12:00:00Z`

### Requirement: Enums persistidos como texto
Los valores enumerados (rol, estado de turno, canal y estado de recordatorio, acción de auditoría) MUST guardarse como su nombre en texto y la base MUST rechazar valores fuera del conjunto permitido.

#### Scenario: Enum guardado por nombre
- **WHEN** se guarda un turno con estado `PROGRAMADO`
- **THEN** la columna `estado` contiene el texto `PROGRAMADO`

#### Scenario: Valor fuera del conjunto
- **WHEN** se inserta por SQL un turno con estado `BORRADO`
- **THEN** la base rechaza la inserción

### Requirement: DNI único por consultorio
La combinación (`consultorio_id`, `dni`) de `paciente` MUST ser única; el mismo DNI MUST poder existir en consultorios distintos.

#### Scenario: DNI repetido en el mismo consultorio
- **GIVEN** el consultorio A tiene un paciente con DNI 30111222
- **WHEN** se guarda otro paciente con DNI 30111222 en el consultorio A
- **THEN** la operación falla por violación de unicidad

#### Scenario: Mismo DNI en otro consultorio
- **GIVEN** el consultorio A tiene un paciente con DNI 30111222
- **WHEN** se guarda un paciente con DNI 30111222 en el consultorio B
- **THEN** el paciente se persiste correctamente

### Requirement: Email de usuario único
El email de `usuario` MUST ser único en todo el sistema sin distinguir mayúsculas de minúsculas; el email se normaliza a minúsculas al guardarse.

#### Scenario: Email repetido
- **GIVEN** existe el usuario `ana@a.test`
- **WHEN** se guarda otro usuario, de cualquier consultorio, con email `ana@a.test`
- **THEN** la operación falla por violación de unicidad

#### Scenario: Email repetido con otras mayúsculas
- **GIVEN** existe el usuario `ana@a.test`
- **WHEN** se guarda otro usuario con email `Ana@A.test`
- **THEN** la operación falla por violación de unicidad

### Requirement: Restricciones de coherencia temporal
La base MUST rechazar turnos y bloqueos con `fin` menor o igual a `inicio`, horarios de atención con `hora_hasta` menor o igual a `hora_desde` o `dia_semana` fuera de 1..7, y prestaciones con duración menor o igual a cero.

#### Scenario: Turno con fin anterior al inicio
- **WHEN** se guarda un turno con inicio `2026-11-24T12:00:00Z` y fin `2026-11-24T11:30:00Z`
- **THEN** la base rechaza la operación

#### Scenario: Día de semana inválido
- **WHEN** se guarda un horario de atención con `dia_semana` 8
- **THEN** la base rechaza la operación

### Requirement: Índices para la agenda
La tabla `turno` SHALL tener índices sobre (`sillon_id`, `inicio`), (`profesional_id`, `inicio`), (`consultorio_id`, `inicio`) y (`paciente_id`) para soportar las consultas de solapamiento y de agenda de C-07; `paciente` SHALL tener índice sobre (`consultorio_id`, `apellido`, `nombre`).

#### Scenario: Índices presentes
- **WHEN** se inspeccionan los índices del esquema migrado
- **THEN** existen los índices de `turno` y `paciente` listados

### Requirement: Baja lógica de entidades con historia
Las entidades consultorio, usuario, profesional, sillón, prestación y paciente MUST tener un indicador `activo` (verdadero por defecto) para darlas de baja sin borrarlas; el esquema MUST impedir el borrado físico de un paciente que tenga turnos, notas clínicas o consentimientos.

#### Scenario: Activo por defecto
- **WHEN** se guarda un paciente sin indicar `activo`
- **THEN** el paciente queda con `activo` verdadero

#### Scenario: Borrado físico de paciente con turnos
- **GIVEN** un paciente con un turno registrado
- **WHEN** se intenta borrar físicamente el paciente
- **THEN** la base rechaza el borrado por clave foránea

### Requirement: Entidades sin datos personales en su representación textual
La representación textual de las entidades (la que aparece en logs y mensajes de error) MUST incluir solo identificadores y nunca datos personales o de salud (nombre, DNI, email, teléfono, contraseña, contenido clínico).

#### Scenario: Representación textual de un paciente
- **GIVEN** un paciente con nombre `Ana`, DNI `30111222` y email `ana@a.test`
- **WHEN** se obtiene su representación textual
- **THEN** contiene el id y no contiene `Ana`, `30111222` ni `ana@a.test`
