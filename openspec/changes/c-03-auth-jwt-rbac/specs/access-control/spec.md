# Spec Delta

## Purpose

Asegurar que cada request a la API se ejecute con la identidad, el rol y el consultorio del token presentado: las rutas no públicas exigen token válido, el rol limita las operaciones según la matriz RBAC y el consultorio del token acota todos los datos accesibles.

## ADDED Requirements

### Requirement: Rutas públicas explícitas
Solo `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login` y los preflight `OPTIONS` SHALL ser accesibles sin token; toda otra ruta MUST responder `401` sin token o con token inválido.

#### Scenario: Ruta protegida sin token
- **WHEN** se envía `GET /api/auth/me` sin encabezado `Authorization`
- **THEN** la respuesta es `401` en formato `ProblemDetail` sin datos del recurso

#### Scenario: Login accesible sin token
- **WHEN** se envía `POST /api/auth/login` sin encabezado `Authorization`
- **THEN** la petición llega al endpoint (no es rechazada por la capa de seguridad)

### Requirement: Autorización por rol
El backend SHALL mapear el rol del token (`ADMIN`, `PROFESIONAL`, `RECEPCION`) a una autoridad y MUST rechazar con `403` toda operación cuyo permiso no incluya ese rol, según la matriz de KB 03. Las operaciones de gestión (configuración, usuarios, auditoría, exportación, ficha clínica) MUST requerir `ADMIN` o `PROFESIONAL`; las operativas (turnos, pacientes, bloqueos, recordatorios, lectura de configuración) MUST admitir además `RECEPCION`.

#### Scenario: Rol insuficiente
- **GIVEN** un token válido con rol `RECEPCION`
- **WHEN** invoca una operación de gestión
- **THEN** la respuesta es `403`

#### Scenario: Rol suficiente
- **GIVEN** un token válido con rol `PROFESIONAL`
- **WHEN** invoca una operación de gestión
- **THEN** la operación se ejecuta

### Requirement: Consultorio en curso tomado del token
Para toda request autenticada el backend MUST fijar el consultorio en curso con el `cid` del token antes de acceder a datos, y MUST limpiarlo al terminar la request, con éxito o con error. Un token sin `cid` válido MUST ser rechazado con `401`.

#### Scenario: Aislamiento entre consultorios por token
- **GIVEN** los consultorios A y B registrados, cada uno con su usuario
- **WHEN** el usuario de A consulta datos con su token
- **THEN** solo obtiene datos del consultorio A, nunca de B

#### Scenario: Contexto limpio tras la request
- **WHEN** termina una request autenticada, incluso si falló
- **THEN** el hilo que la atendió no conserva consultorio en curso

#### Scenario: Token sin consultorio
- **GIVEN** un token correctamente firmado sin claim `cid`
- **WHEN** se usa en una ruta protegida
- **THEN** la respuesta es `401`

### Requirement: Errores homogéneos sin datos personales
Las respuestas de error de la API (`400`, `401`, `403`, `409`, `429`, `500`) SHALL usar el formato `ProblemDetail` y MUST NOT incluir valores enviados por el cliente, datos personales, trazas ni la causa técnica de un rechazo de autenticación.

#### Scenario: Error de validación sin valores
- **WHEN** un registro falla por email inválido `x@`
- **THEN** la respuesta `400` nombra el campo `email` y no contiene `x@`
