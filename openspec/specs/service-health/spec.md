# service-health Specification

## Purpose

Expone un endpoint público de salud del backend para verificar que el servicio arrancó, usado como test de humo, por el healthcheck de Docker Compose y por el frontend.

## Requirements

### Requirement: Endpoint de salud público
El backend SHALL exponer `GET /api/health` sin autenticación, respondiendo `200 OK` con cuerpo JSON `{"status":"UP"}` cuando la aplicación arrancó correctamente.

#### Scenario: Consulta de salud sin credenciales
- **WHEN** un cliente sin token envía `GET /api/health`
- **THEN** el backend responde `200 OK` con `Content-Type: application/json` y cuerpo `{"status":"UP"}`

#### Scenario: La respuesta no filtra información interna
- **WHEN** un cliente envía `GET /api/health`
- **THEN** el cuerpo contiene únicamente el campo `status`, sin versiones, rutas, datos de configuración, credenciales ni PII

### Requirement: Solo lectura del endpoint de salud
El endpoint de salud MUST aceptar solo el método `GET`; otros métodos MUST ser rechazados sin modificar estado.

#### Scenario: Método no permitido
- **WHEN** un cliente envía `POST /api/health`
- **THEN** el backend responde con un código 4xx (405, o 401/403 por la política de acceso) y no ejecuta ninguna acción

### Requirement: Arranque del contexto con el perfil de test
La aplicación SHALL arrancar con el perfil `test` contra una base H2 en memoria en modo de compatibilidad MySQL, ejecutando Flyway con las migraciones del proyecto, sin requerir MySQL ni variables de entorno de producción.

#### Scenario: Contexto carga en tests
- **WHEN** se ejecuta la suite de tests del backend con el perfil `test`
- **THEN** el contexto de la aplicación carga sin errores y Flyway se ejecuta sobre H2
