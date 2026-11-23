# Spec Delta

## Purpose

Restringe qué orígenes de navegador pueden consumir la API y establece que toda ruta no declarada pública queda denegada por defecto hasta que C-03 incorpore autenticación.

## ADDED Requirements

### Requirement: CORS restringido a orígenes configurados
La API SHALL permitir solicitudes cross-origin únicamente desde los orígenes listados en `CORS_ALLOWED_ORIGINS` (lista separada por comas), sin usar el comodín `*`.

#### Scenario: Preflight desde origen permitido
- **GIVEN** `CORS_ALLOWED_ORIGINS` incluye `http://localhost:5173`
- **WHEN** el navegador envía `OPTIONS /api/health` con `Origin: http://localhost:5173` y `Access-Control-Request-Method: GET`
- **THEN** la respuesta es 2xx e incluye `Access-Control-Allow-Origin: http://localhost:5173`

#### Scenario: Preflight desde origen no permitido
- **WHEN** el navegador envía un preflight con `Origin: http://evil.example`
- **THEN** la respuesta es `403` y no incluye el encabezado `Access-Control-Allow-Origin`

#### Scenario: Varios orígenes configurados
- **GIVEN** `CORS_ALLOWED_ORIGINS` es `http://localhost:5173,http://127.0.0.1:5173`
- **WHEN** llega una solicitud con `Origin: http://127.0.0.1:5173`
- **THEN** la respuesta incluye `Access-Control-Allow-Origin: http://127.0.0.1:5173`

### Requirement: Métodos y encabezados CORS permitidos
La política CORS SHALL permitir los métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS` y los encabezados `Authorization` y `Content-Type`, para que el frontend pueda enviar el token que incorpora C-03.

#### Scenario: Preflight con encabezado Authorization
- **WHEN** un origen permitido envía un preflight con `Access-Control-Request-Headers: authorization,content-type`
- **THEN** la respuesta autoriza ambos encabezados

### Requirement: Acceso denegado por defecto
Toda ruta de la API que no esté declarada explícitamente como pública MUST ser rechazada para solicitudes sin credenciales válidas, y la API MUST ser stateless (sin sesión HTTP).

#### Scenario: Ruta no pública sin credenciales
- **WHEN** un cliente sin token envía `GET /api/cualquier-recurso`
- **THEN** el backend responde `401` o `403` y no expone datos

#### Scenario: Sin cookie de sesión
- **WHEN** un cliente envía `GET /api/health`
- **THEN** la respuesta no establece una cookie de sesión (`JSESSIONID`)
