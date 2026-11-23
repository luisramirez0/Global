# Spec Delta

## MODIFIED Requirements

### Requirement: Acceso denegado por defecto
Toda ruta de la API que no esté declarada explícitamente como pública MUST ser rechazada para solicitudes sin credenciales válidas, y la API MUST ser stateless (sin sesión HTTP). Las rutas públicas son `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login` y los preflight `OPTIONS`.

#### Scenario: Ruta no pública sin credenciales
- **WHEN** un cliente sin token envía `GET /api/cualquier-recurso`
- **THEN** el backend responde `401` y no expone datos

#### Scenario: Sin cookie de sesión
- **WHEN** un cliente envía `GET /api/health` o `POST /api/auth/login`
- **THEN** la respuesta no establece una cookie de sesión (`JSESSIONID`)
