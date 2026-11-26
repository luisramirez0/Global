# api-cors-policy Specification

## Purpose

Restringe qué orígenes de navegador pueden consumir la API y establece que toda ruta no declarada pública queda denegada por defecto (desde C-03, sin un token JWT válido).

## Requirements

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
La política CORS SHALL permitir los métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS` y los encabezados `Authorization` y `Content-Type`, para que el frontend pueda enviar el token que incorpora C-03. A los orígenes permitidos MUST exponerles el encabezado `Retry-After` (y solo ese), para que la SPA pueda leer la espera del `429` de login.

#### Scenario: Preflight con encabezado Authorization
- **WHEN** un origen permitido envía un preflight con `Access-Control-Request-Headers: authorization,content-type`
- **THEN** la respuesta autoriza ambos encabezados

#### Scenario: Retry-After legible desde otro origen
- **GIVEN** la SPA en `http://localhost:5173` y la API en otro origen
- **WHEN** el login responde `429` con `Retry-After` a una solicitud con `Origin: http://localhost:5173`
- **THEN** la respuesta incluye `Access-Control-Expose-Headers: Retry-After`

#### Scenario: Origen no permitido sin encabezados expuestos
- **WHEN** llega una solicitud con `Origin: http://evil.example`
- **THEN** la respuesta no incluye `Access-Control-Expose-Headers`

### Requirement: Acceso denegado por defecto
Toda ruta de la API que no esté declarada explícitamente como pública MUST ser rechazada para solicitudes sin credenciales válidas, y la API MUST ser stateless (sin sesión HTTP). Las rutas públicas son `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login` y los preflight `OPTIONS`.

#### Scenario: Ruta no pública sin credenciales
- **WHEN** un cliente sin token envía `GET /api/cualquier-recurso`
- **THEN** el backend responde `401` y no expone datos

#### Scenario: Sin cookie de sesión
- **WHEN** un cliente envía `GET /api/health` o `POST /api/auth/login`
- **THEN** la respuesta no establece una cookie de sesión (`JSESSIONID`)
