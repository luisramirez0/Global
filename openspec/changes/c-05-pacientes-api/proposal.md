# Proposal

## Why

Con C-03 mergeado, el sistema autentica y fija el consultorio de cada request, pero no hay ningún endpoint de negocio: no se puede cargar un paciente. C-05 es co-requisito de C-07 (turnos), C-08 (ficha clínica) y C-12 (frontend de pacientes) y forma parte del corte vertical que nunca se recorta (R-01). Cubre US-020 (CA-1: alta, edición, baja lógica, búsqueda por nombre y DNI, DNI único) y las reglas RN-PA-01..03. Governance MEDIO: datos personales, no clínicos.

## What Changes

- `POST /api/pacientes`: alta. `201` con `Location` y el paciente creado. DNI ya existente en el consultorio (activo o inactivo) → `409` con el `pacienteId` existente.
- `GET /api/pacientes?q=&incluirInactivos=&page=&size=`: listado paginado y ordenado por apellido y nombre. `q` busca por nombre/apellido (contiene, sin distinguir mayúsculas) o por DNI (prefijo, ignorando puntos y espacios). Por defecto solo activos.
- `GET /api/pacientes/{id}`: detalle. Id inexistente o de otro consultorio → `404` (mismo cuerpo en ambos casos).
- `PUT /api/pacientes/{id}`: edición de datos personales y de contacto (no cambia `activo`). DNI duplicado → `409`.
- `DELETE /api/pacientes/{id}`: **baja lógica** (`activo = false`), idempotente, `204`. Nunca hay borrado físico (RN-PA-03).
- `POST /api/pacientes/{id}/reactivar`: revierte la baja, `204`. Hace falta porque el DNI de un paciente dado de baja sigue ocupado (`UNIQUE (consultorio_id, dni)` de V2) y, sin esto, un error de baja no tendría vuelta atrás.
- Normalización y validación: DNI sin puntos ni espacios, solo dígitos (7–8). Teléfono opcional y, si viene, normalizado a E.164 (`+` y 8–15 dígitos, sin espacios, guiones, puntos ni paréntesis) para los enlaces `wa.me` de C-09 (RN-PA-02). Textos recortados (vacío → `null`), email opcional válido.
- RBAC (KB 03): `ADMIN`, `PROFESIONAL` y `RECEPCION` crean, leen y editan (`Permisos.OPERACION`); baja y reactivación solo `ADMIN`/`PROFESIONAL` (`Permisos.GESTION`).
- Errores `ProblemDetail` sin PII: se agrega `404` al manejador común; el `409` de DNI no repite el DNI.
- Tests: alta, DNI duplicado (también con otro formato y en carrera), búsqueda por nombre y por DNI, E.164 inválido, baja lógica e idempotencia, reactivación, RBAC por rol, aislamiento A/B en todos los endpoints.

## Capabilities

### New Capabilities
- `patient-management`: alta, consulta, búsqueda, edición, baja lógica y reactivación de pacientes por consultorio, con DNI único y teléfono E.164.

### Modified Capabilities
- `access-control`: "Errores homogéneos sin datos personales" incluye `404` (recurso inexistente o de otro consultorio, sin distinguirlos).

## Impact

- **Código**: `paciente/abm/` (controller, servicio, DTOs, mapper, normalizadores, excepciones); `PacienteRepository` suma la consulta de búsqueda y un `existsByDni…`; `common/web/` suma `RecursoNoEncontradoException` (404), el DTO genérico de página y sus handlers en `ApiExceptionHandler`.
- **Esquema**: **ninguna migración nueva**; V1/V2 de `main` quedan intactas. La tabla `paciente` de V2 ya tiene todas las columnas, `UNIQUE (consultorio_id, dni)` e índice `(consultorio_id, apellido, nombre)`.
- **Dependencias**: ninguna (la validación E.164 es una regex; no se agrega libphonenumber).
- **Consumidores**: C-07 referencia pacientes por id y debe rechazar inactivos; C-08 cuelga `/api/pacientes/{id}/ficha|notas|consentimientos` de este recurso; C-09 usa `telefono` E.164; C-12 consume todo el contrato.
- **Fuera de alcance**: ficha clínica, notas y consentimiento (C-08); auditoría de accesos (C-06; los datos de contacto no son clínicos, RN-DS-02 aplica a la ficha); búsqueda sin acentos uniforme entre H2 y MySQL; conversión de números locales (`011 15…`) a E.164; obras sociales estructuradas (C-22); borrado físico o anonimización.
- **Riesgo**: MEDIO. Se toca `common/web/ApiExceptionHandler`, que C-03 marcó como zona a revisar (no filtrar información): se avisa a integrante-1/2 en el PR (regla 12). Posible conflicto de merge con C-04/C-06, que trabajan en paralelo sobre el mismo archivo.
