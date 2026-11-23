# Spec Delta

## Purpose

Proveer los datos iniciales que el sistema necesita para operar (roles, texto de consentimiento vigente, prestaciones sugeridas) y un entorno de desarrollo utilizable sin credenciales versionadas.

## ADDED Requirements

### Requirement: Roles fijos
El sistema SHALL reconocer exactamente los roles `ADMIN`, `PROFESIONAL` y `RECEPCION`, definidos en código y sin tabla editable; la base MUST rechazar un usuario con otro rol.

#### Scenario: Roles disponibles
- **WHEN** se consultan los roles del sistema
- **THEN** son exactamente `ADMIN`, `PROFESIONAL` y `RECEPCION`

#### Scenario: Rol desconocido rechazado
- **WHEN** se inserta por SQL un usuario con rol `SUPERUSER`
- **THEN** la base rechaza la inserción

### Requirement: Texto de consentimiento versionado
El esquema SHALL incluir, en todos los entornos, el texto de consentimiento de tratamiento de datos versión `v1` como catálogo global de solo lectura, y cada consentimiento registrado MUST referenciar una versión existente del texto.

#### Scenario: Versión v1 disponible tras migrar
- **WHEN** se aplican las migraciones sobre una base vacía
- **THEN** existe el texto de consentimiento con versión `v1` y contenido no vacío

#### Scenario: Consentimiento con versión inexistente
- **WHEN** se guarda un consentimiento que referencia la versión `v99`
- **THEN** la base rechaza la operación

### Requirement: Prestaciones sugeridas
El sistema SHALL ofrecer un catálogo de prestaciones sugeridas para un consultorio nuevo: Consulta 30 min, Limpieza 45 min, Arreglo/obturación 60 min y Control 15 min (duraciones supuestas, PA-03).

#### Scenario: Catálogo sugerido
- **WHEN** se consulta el catálogo de prestaciones sugeridas
- **THEN** contiene exactamente esas cuatro prestaciones con esas duraciones en minutos

### Requirement: Datos de desarrollo solo en perfil dev
Solo con el perfil `dev` activo, al arrancar el backend SHALL crear, si no existen, un consultorio de desarrollo con un sillón, las prestaciones sugeridas y un usuario `ADMIN` cuyo email y contraseña provienen de `DEV_ADMIN_EMAIL` y `DEV_ADMIN_PASSWORD`; la contraseña MUST guardarse solo como hash.

#### Scenario: Seed con perfil dev
- **GIVEN** el perfil `dev` activo y `DEV_ADMIN_PASSWORD` definida
- **WHEN** arranca el backend sobre una base sin usuarios
- **THEN** existe un usuario `ADMIN` con el email configurado y su contraseña guardada como hash que verifica contra el valor de la variable

#### Scenario: Seed idempotente
- **GIVEN** el seed de desarrollo ya se ejecutó
- **WHEN** el backend arranca de nuevo con el perfil `dev`
- **THEN** no se crean consultorios, sillones, prestaciones ni usuarios duplicados

#### Scenario: Sin seed fuera de dev
- **WHEN** el backend arranca con el perfil `test`
- **THEN** no se crea ningún consultorio ni usuario de desarrollo

#### Scenario: Sin contraseña de admin configurada
- **GIVEN** el perfil `dev` activo y `DEV_ADMIN_PASSWORD` vacía o ausente
- **WHEN** arranca el backend
- **THEN** no se crea el usuario admin y se registra una advertencia que no incluye ninguna credencial
