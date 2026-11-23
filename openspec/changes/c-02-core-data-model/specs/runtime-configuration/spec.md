# Spec Delta

## ADDED Requirements

### Requirement: Credenciales del admin de desarrollo por entorno
El backend SHALL leer el email y la contraseña del admin de desarrollo de `DEV_ADMIN_EMAIL` (default no sensible `admin@dev.local`) y `DEV_ADMIN_PASSWORD` (sin default); `.env.example` MUST listar ambas con `DEV_ADMIN_PASSWORD` vacía o con el marcador `changeme`, y ninguna contraseña MUST quedar escrita en código, migraciones ni configuración versionada.

#### Scenario: Plantilla con variables del admin de desarrollo
- **WHEN** se revisa `.env.example`
- **THEN** contiene `DEV_ADMIN_EMAIL` y `DEV_ADMIN_PASSWORD`, esta última vacía o con `changeme`

#### Scenario: Email por defecto
- **GIVEN** `DEV_ADMIN_EMAIL` no está definida
- **WHEN** arranca la aplicación con el perfil `dev`
- **THEN** el email del admin de desarrollo es `admin@dev.local`

### Requirement: Sin SQL ni parámetros de consultas en los logs
En todos los perfiles la configuración MUST mantener desactivados el volcado de SQL y el log de parámetros enlazados de Hibernate, para que ningún dato personal o de salud llegue a los logs a través de las consultas.

#### Scenario: Volcado de SQL desactivado
- **WHEN** arranca la aplicación en cualquier perfil
- **THEN** `spring.jpa.show-sql` es falso y el logger de parámetros enlazados de Hibernate no está en nivel `TRACE`
