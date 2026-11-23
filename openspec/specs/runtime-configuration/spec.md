# runtime-configuration Specification

## Purpose

Define cómo el backend y el entorno local obtienen su configuración (base de datos, JWT, SMTP, URLs, CORS) desde variables de entorno y perfiles, sin secretos versionados.

## Requirements

### Requirement: Configuración por variables de entorno
El backend SHALL leer la conexión a base de datos, la configuración JWT, SMTP, la URL pública y los orígenes CORS de las variables `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MIN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `APP_BASE_URL` y `CORS_ALLOWED_ORIGINS`.

#### Scenario: Orígenes CORS desde el entorno
- **GIVEN** la variable `CORS_ALLOWED_ORIGINS` vale `http://a.test,http://b.test`
- **WHEN** arranca la aplicación
- **THEN** la configuración de CORS contiene exactamente esos dos orígenes

#### Scenario: Valores por defecto no sensibles
- **GIVEN** `CORS_ALLOWED_ORIGINS` y `APP_BASE_URL` no están definidas
- **WHEN** arranca la aplicación
- **THEN** ambas toman el valor `http://localhost:5173`

### Requirement: Sin secretos en el repositorio
El repositorio MUST incluir `.env.example` con todas las variables requeridas y sin valores reales para las sensibles (`DB_PASSWORD`, `JWT_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`), y MUST ignorar el archivo `.env`.

#### Scenario: Plantilla de entorno completa
- **WHEN** se revisa `.env.example`
- **THEN** contiene una entrada por cada variable listada y las sensibles están vacías o con el marcador `changeme`

#### Scenario: .env ignorado por git
- **WHEN** existe un archivo `.env` en la raíz
- **THEN** `git check-ignore .env` lo reporta como ignorado

### Requirement: Perfiles dev y test
El backend SHALL ofrecer un perfil `dev` que usa MySQL vía variables de entorno y un perfil `test` que usa H2 en memoria en modo MySQL; en todos los perfiles el esquema MUST gestionarse solo con Flyway y Hibernate MUST validar sin modificar el esquema.

#### Scenario: Perfil de test autocontenido
- **WHEN** se ejecutan los tests sin ninguna variable de entorno definida
- **THEN** la aplicación arranca con el perfil `test` y la base H2

#### Scenario: Hibernate no altera el esquema
- **WHEN** la aplicación arranca en cualquier perfil
- **THEN** Hibernate está configurado en `validate` o `none` y no crea ni altera tablas

### Requirement: Entorno local reproducible
El repositorio SHALL incluir un `docker-compose.yml` que define MySQL 8, el backend y el frontend estático, con el backend esperando a que MySQL esté sano y leyendo su configuración de `.env`.

#### Scenario: Definición de Compose válida
- **GIVEN** existe `.env` copiado de `.env.example`
- **WHEN** se ejecuta `docker compose config`
- **THEN** el comando termina sin errores y lista los servicios `mysql`, `backend` y `frontend`

### Requirement: Script único de tests
El repositorio SHALL incluir un script que ejecuta los tests del backend y del frontend y termina con código distinto de cero si cualquiera falla.

#### Scenario: Falla propagada
- **WHEN** falla algún test del backend o del frontend
- **THEN** el script termina con código de salida distinto de cero

#### Scenario: Todo en verde
- **WHEN** pasan todos los tests del backend y del frontend
- **THEN** el script termina con código de salida cero
