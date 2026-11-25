# runtime-configuration Specification

## Purpose

Define cómo el backend y el entorno local obtienen su configuración (base de datos, JWT, SMTP, URLs, CORS) desde variables de entorno y perfiles, sin secretos versionados.

## Requirements

### Requirement: Configuración por variables de entorno
El backend SHALL leer la conexión a base de datos, la configuración JWT, SMTP, la URL pública y los orígenes CORS de las variables `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MIN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_STARTTLS`, `APP_BASE_URL` y `CORS_ALLOWED_ORIGINS`. Si `SMTP_PORT` no está definida, el puerto SMTP MUST ser `587`; la ausencia de `SMTP_HOST` o `SMTP_FROM` MUST NOT impedir el arranque.

#### Scenario: Orígenes CORS desde el entorno
- **GIVEN** la variable `CORS_ALLOWED_ORIGINS` vale `http://a.test,http://b.test`
- **WHEN** arranca la aplicación
- **THEN** la configuración de CORS contiene exactamente esos dos orígenes

#### Scenario: Valores por defecto no sensibles
- **GIVEN** `CORS_ALLOWED_ORIGINS` y `APP_BASE_URL` no están definidas
- **WHEN** arranca la aplicación
- **THEN** ambas toman el valor `http://localhost:5173`

#### Scenario: Puerto SMTP por defecto
- **GIVEN** `SMTP_PORT` no está definida
- **WHEN** arranca la aplicación
- **THEN** el puerto SMTP configurado es `587`

#### Scenario: Remitente desde el entorno
- **GIVEN** `SMTP_FROM` vale `turnos@consultorio.test`
- **WHEN** se envía un recordatorio por email
- **THEN** el remitente del email es `turnos@consultorio.test`

#### Scenario: Arranque sin SMTP configurado
- **GIVEN** `SMTP_HOST` y `SMTP_FROM` no están definidas
- **WHEN** arranca la aplicación
- **THEN** el arranque termina sin errores

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

### Requirement: Secreto JWT obligatorio y robusto
El backend MUST negarse a arrancar si `JWT_SECRET` no está definida o tiene menos de 32 bytes, con un mensaje que nombra la variable sin mostrar su valor; `.env.example` MUST dejar `JWT_SECRET` vacía e indicar la longitud mínima, y el perfil `test` MAY definir un secreto de prueba no sensible.

#### Scenario: Secreto ausente
- **GIVEN** `JWT_SECRET` no está definida
- **WHEN** arranca la aplicación
- **THEN** el arranque falla con un mensaje que menciona `JWT_SECRET`

#### Scenario: Secreto corto sin filtrarse
- **GIVEN** `JWT_SECRET` vale `corto`
- **WHEN** arranca la aplicación
- **THEN** el arranque falla y el mensaje no contiene `corto`

### Requirement: Conexión SMTP cifrada
La conexión SMTP MUST exigir autenticación y STARTTLS habilitado y requerido, de modo que las credenciales SMTP nunca viajen en texto plano. Solo si `SMTP_STARTTLS` vale explícitamente `false` (SMTP local de desarrollo sin TLS) el STARTTLS MAY desactivarse; la autenticación sigue activa.

#### Scenario: STARTTLS obligatorio por defecto
- **GIVEN** `SMTP_STARTTLS` no está definida
- **WHEN** se configura el emisor SMTP
- **THEN** la autenticación y STARTTLS (habilitado y requerido) están activos

#### Scenario: STARTTLS desactivado explícitamente
- **GIVEN** `SMTP_STARTTLS` vale `false`
- **WHEN** se configura el emisor SMTP
- **THEN** STARTTLS no está habilitado ni requerido y la autenticación sigue activa
