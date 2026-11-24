# Spec Delta

## MODIFIED Requirements

### Requirement: Auditoría del inicio de sesión
Cada login de un usuario existente SHALL registrar en `audit_log`, mediante el mecanismo común de auditoría, una entrada `LOGIN` del consultorio del usuario sobre la entidad `Usuario`, con el id de usuario, la IP y el detalle `{"resultado":"ok"}` o `{"resultado":"fallido"}`, sin email ni contraseña. Un login con email inexistente MUST NOT escribir en `audit_log` y solo deja un log de aplicación sin el email.

#### Scenario: Login exitoso auditado
- **WHEN** un usuario inicia sesión correctamente
- **THEN** existe una entrada `LOGIN` con su `usuario_id`, su `consultorio_id`, entidad `Usuario`, id de entidad igual a su id y detalle `{"resultado":"ok"}`

#### Scenario: Contraseña incorrecta auditada
- **WHEN** un usuario existente intenta iniciar sesión con una contraseña incorrecta
- **THEN** la respuesta es `401` y existe una entrada `LOGIN` con su `usuario_id` y detalle `{"resultado":"fallido"}`

#### Scenario: Email inexistente sin PII en logs
- **WHEN** se intenta un login con `nadie@x.test`
- **THEN** no se escribe en `audit_log` y la salida de log no contiene `nadie@x.test`
