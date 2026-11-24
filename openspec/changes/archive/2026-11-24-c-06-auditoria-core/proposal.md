# Proposal

## Why

RN-DS-02 exige que cada lectura, alta, modificación y exportación de la ficha clínica quede en un registro inmutable, y C-07, C-08 y C-15 no pueden empezar sin un mecanismo común para hacerlo. Hoy solo existe la tabla `audit_log` insert-only (C-02) y un uso puntual desde `LoginService` (C-03), que escribe en el repositorio a mano con un `detalle` de texto plano. Falta el servicio/aspecto reutilizable, la política ante un fallo de auditoría y la consulta del log para ADMIN/PROFESIONAL (US-040 CA-1, primera mitad).

## What Changes

- Nuevo `AuditService` en `auditoria/`: único punto de escritura en `audit_log`. Toma consultorio del `TenantContext`, usuario del token en curso e IP de la request; recibe acción, entidad, id de entidad y un detalle estructurado.
- Nueva anotación `@Audited` + aspecto: los servicios de C-07/C-08/C-15 declaran qué se audita (acción, entidad, id por expresión sobre argumentos o resultado) sin escribir código de auditoría.
- **Política de fallo fail-closed**: el registro de auditoría se escribe en la **misma transacción** que la operación auditada; si no se puede escribir, la operación falla con `500` genérico, se revierte y se loguea el error solo con ids. Nunca se devuelven datos clínicos sin su registro.
- `detalle` pasa a ser **JSON con claves y valores restringidos** (ids, números, booleanos, códigos cortos), validado antes de escribir; no admite PII ni datos de salud.
- `LoginService` migra a `AuditService` (sin cambiar cuándo se audita); el `detalle` de `LOGIN` pasa de `ok`/`fallido` a `{"resultado":"ok"}` / `{"resultado":"fallido"}`. **BREAKING** menor para quien lea `detalle` de LOGIN en crudo (hoy nadie lo consume).
- Captura de IP centralizada: se toma de `getRemoteAddr()`; `X-Forwarded-For` **no** se interpreta en el código (se resolverá con `server.forward-headers-strategy` cuando haya proxy, C-16).
- Nuevo endpoint `GET /api/auditoria`: solo `ADMIN`/`PROFESIONAL` (`RECEPCION` → `403`), paginado con `Pagina<T>`, filtros por rango de fechas, acción, entidad, id de entidad y usuario, orden más reciente primero, aislado por consultorio, con DTO propio.
- Dependencia `spring-boot-starter-aop` (parte de Spring Boot, gratuita) declarada explícitamente.
- **Sin migración nueva**: `audit_log` (V2) y su índice `(consultorio_id, created_at)` alcanzan; V1/V2 no se tocan.

Fuera de alcance: auditar endpoints concretos de ficha/turnos (lo hacen C-07/C-08 con `@Audited`), exportación del log o de datos del paciente (C-15), `GRANT` insert-only en MySQL y confianza en `X-Forwarded-For` (C-16), UI del log (frontend posterior), auditoría de lectura del propio log.

## Capabilities

### New Capabilities

_(ninguna: el comportamiento nuevo amplía la capacidad existente `audit-log`)_

### Modified Capabilities

- `audit-log`: se agregan el registro de acciones desde otros módulos (servicio y anotación declarativa), la política fail-closed ante fallos de auditoría, el formato y las restricciones del `detalle`, la captura de usuario e IP, y la consulta paginada y filtrada `GET /api/auditoria` restringida a ADMIN/PROFESIONAL.
- `authentication`: el requisito "Auditoría del inicio de sesión" cambia el formato del detalle (`{"resultado": "ok"|"fallido"}`) y exige que el registro pase por el servicio de auditoría.

## Impact

- Código: `backend/src/main/java/ar/global/odonto/auditoria/` (servicio, anotación, aspecto, detalle, consulta, controller, DTO, mapper), `AuditLogRepository` (nueva consulta filtrada, sigue sin update/delete), `usuario/auth/LoginService` y `AuthController` (IP vía resolutor común), `common/web/ApiExceptionHandler` (400 de filtros inválidos si hace falta).
- Build: `build.gradle` suma `spring-boot-starter-aop`.
- API: nuevo `GET /api/auditoria`. Sin cambios en endpoints existentes.
- Esquema: ninguno (sin `V3`).
- Consumidores: C-07 (sobreturno, cancelaciones), C-08 (ficha: READ/CREATE/UPDATE), C-15 (EXPORT) usan `@Audited`/`AuditService`; C-13/C-15 frontend consumen `GET /api/auditoria`.
- Zona de riesgo (regla 12): auditoría y login. Governance CRÍTICO: el diseño requiere aprobación humana antes del apply; el PR requiere review de integrante-1.
