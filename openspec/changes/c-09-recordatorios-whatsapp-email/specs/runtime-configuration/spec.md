# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
