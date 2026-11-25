# Proposal

## Why

US-040 (CA-1) pide consultar el log de accesos y exportar los datos de un paciente. RN-DS-06 reconoce el derecho de acceso del paciente o su titular (Ley 25.326) y RN-DS-02 exige que cada exportación de la historia clínica quede en `AuditLog`. C-06 dejó `GET /api/auditoria` y la acción `EXPORT` en el enum, pero nada la usa: no existe el export ni una pantalla para leer el log. El Flujo 7 de la KB describe `GET /api/pacientes/{id}/export`.

Al relevar el código apareció además que el contrato publicado por C-08 (`GET /api/auditoria?entidadId=<pacienteId>` "devuelve todos los accesos a la historia clínica") no es exacto: `entidadId` no depende de la entidad, así que también trae filas de `Turno` o `LOGIN` con el mismo número. Este change lo corrige en la spec y en la UI sin tocar el backend de C-06.

## What Changes

- **Backend** (paquete nuevo `paciente/export/`):
  - `GET /api/pacientes/{id}/export`, solo `ADMIN`/`PROFESIONAL`. Devuelve un JSON con `paciente`, `ficha` (o `null`), `notas`, `turnos`, `consentimientos` y `exportadoEn`, con `Content-Disposition: attachment; filename="paciente-<id>-export.json"` y `Cache-Control: no-store`.
  - Cada export exitoso registra `EXPORT` sobre la entidad `Paciente` con `entidadId = pacienteId` y un detalle con conteos (sin contenido clínico), en la misma transacción de lectura-escritura que arma el paquete. Si la auditoría falla, `500` genérico y no sale ningún dato.
  - Repositorio de solo lectura propio con JPQL portable; `agenda/` y `auditoria/` no se tocan.
- **Frontend**:
  - Pantalla `#/auditoria` (`pages/auditoria/`): tabla paginada del log con filtros de fecha (hora local → UTC), acción, entidad, id de entidad (solo con entidad elegida) y usuario.
  - Componente reutilizable de exportación (`components/exportarPaciente.ts`) que descarga el JSON sin poner el token en una URL; por ahora se monta en `#/auditoria` por id de paciente. C-12 lo montará en la ficha.
  - Menú según rol: `NavItem` gana `roles?`; "Auditoría" se oculta a `RECEPCION`.
- **Sin migraciones ni dependencias nuevas.** Solo JSON (el PDF de US-040 queda fuera).

Fuera de alcance: PDF, filtro multientidad en `GET /api/auditoria`, vista "historial del paciente" en un solo pedido, vinculación de los accesos a turnos con el paciente, inclusión del propio log en el export, botón en la ficha (lo monta C-12).

## Capabilities

### New Capabilities

- `patient-data-export`: exportación de los datos de un paciente (contenido, permisos, auditoría `EXPORT` fail-closed, aislamiento por consultorio, sin datos de salud en logs).
- `frontend-audit-log`: pantalla de consulta del log de auditoría y componente de exportación de datos de un paciente.

### Modified Capabilities

- `audit-log`: aclara que el filtro por id de entidad no distingue entidades y que, para obtener los accesos de un paciente, debe combinarse con la entidad.
- `frontend-shell`: menú filtrado por rol y navegación a la auditoría.

## Impact

- Código nuevo: `backend/src/main/java/ar/global/odonto/paciente/export/` y sus tests; `frontend/src/pages/auditoria/`, `frontend/src/api/auditoria.ts`, `frontend/src/components/exportarPaciente.ts`.
- Código existente (cambios aditivos): `frontend/src/components/layout.ts` (`NavItem.roles`), `frontend/src/router/routes.ts`, `frontend/src/api/types.ts`/`decoders.ts`.
- API: un endpoint nuevo; ninguno existente cambia.
- Esquema: ninguno.
- Consumidores: C-12 (monta el botón en la ficha), C-16 (smoke E2E de auditoría/export).
- Zona de riesgo (regla 12): exportación de datos de salud y auditoría. Governance CRITICO: decisiones D1–D11 aprobadas por la persona el 2026-11-24; el PR requiere review de integrante-1 o integrante-2.
