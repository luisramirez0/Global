# Spec Delta

## MODIFIED Requirements

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
