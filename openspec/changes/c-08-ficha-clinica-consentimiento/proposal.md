# Proposal

## Why

US-021 pide que el odontólogo registre anamnesis (alergias, medicación, antecedentes) y notas clínicas, con dos condiciones: el consentimiento de datos tiene que estar registrado antes de cargar la ficha (RN-DS-03, CA-1) y cada acceso o cambio tiene que quedar en auditoría (RN-DS-02, CA-2). El esquema ya existe desde C-02 (`ficha_clinica`, `nota_clinica`, `consentimiento_datos`, `consentimiento_texto` con la versión `v1`) y C-06 dejó listo el mecanismo de auditoría (`@Audited`, `AuditService`), pero no hay ningún endpoint que exponga la historia clínica. C-12 (frontend de pacientes y ficha) y C-15 (exportación) dependen de este change.

## What Changes

- Nuevo paquete `paciente/ficha/` con servicios, DTOs, mappers y controllers para la ficha, las notas y el consentimiento.
- `GET /api/pacientes/{id}/ficha` y `PUT /api/pacientes/{id}/ficha`. El PUT crea la ficha la primera vez y la actualiza las siguientes, con control de concurrencia por `version`: si no coincide, `409`.
- `POST /api/pacientes/{id}/notas` y `GET /api/pacientes/{id}/notas` (paginado). Las notas no se editan ni se borran: una corrección es una nota nueva (supuesto PA-08). El autor es el profesional vinculado al usuario del token.
- `POST /api/pacientes/{id}/consentimientos` (registra versión del texto, fecha de aceptación del servidor y usuario que lo registra) y `GET /api/pacientes/{id}/consentimientos` (lista).
- `GET /api/consentimientos/texto-vigente`: texto vigente del catálogo, para que C-12 lo muestre.
- Regla de consentimiento: sin un consentimiento registrado (de cualquier versión), leer o escribir la ficha y crear o listar notas devuelve `409` con código `CONSENTIMIENTO_REQUERIDO`.
- Paciente dado de baja: la ficha y las notas se pueden leer; escribir la ficha, crear notas o registrar consentimiento devuelve `409` con código `PACIENTE_INACTIVO`.
- Permisos: solo `ADMIN` y `PROFESIONAL` (`Permisos.GESTION`); `RECEPCION` recibe `403` en todos los endpoints (supuesto PA-07).
- Auditoría de cada acceso clínico con `entidadId = pacienteId`: `READ` y `CREATE`/`UPDATE` de `FichaClinica`, `READ` y `CREATE` de `NotaClinica`, `CREATE` de `ConsentimientoDatos`. El detalle nunca lleva contenido clínico. Las lecturas auditadas no llevan `@Transactional(readOnly = true)` (regla 5 de C-06).
- `ApiExceptionHandler` suma el código de negocio (`codigo`) en los `409` de este change y traduce el conflicto de bloqueo optimista a `409`.
- **Sin migración nueva**: las tablas de V2 alcanzan; V1 y V2 no se tocan.

Fuera de alcance: odontograma, presupuestos y clínica avanzada (C-21, RN-PA-04), revocación de consentimiento, edición o adenda enlazada de notas (requeriría columna nueva), validación de `turnoId` contra el estado del turno (llega con C-07), exportación de datos del paciente (C-15), UI (C-12).

## Capabilities

### New Capabilities

- `clinical-record`: ficha clínica (anamnesis), notas clínicas y consentimiento de datos del paciente: reglas de consentimiento previo, paciente inactivo, concurrencia de la ficha, autor de las notas, permisos, auditoría de cada acceso, aislamiento por consultorio y ausencia de datos de salud en logs y errores.

### Modified Capabilities

_(ninguna: `access-control` ya exige `ADMIN`/`PROFESIONAL` para la ficha clínica y `audit-log` ya define el registro desde otros módulos; este change los aplica sin cambiar sus requisitos)_

## Impact

- Código nuevo: `backend/src/main/java/ar/global/odonto/paciente/ficha/` y sus tests en `backend/src/test/java/ar/global/odonto/paciente/ficha/`.
- Código existente: `paciente/FichaClinicaRepository`, `NotaClinicaRepository`, `ConsentimientoDatosRepository` y `ConsentimientoTextoRepository` (consultas nuevas de lectura); `agenda/ProfesionalRepository` (búsqueda por usuario, zona de C-04); `common/web/ApiExceptionHandler` y `ConflictoException` (código de negocio y bloqueo optimista).
- API: siete endpoints nuevos; sin cambios en los existentes.
- Esquema: ninguno (sin `V3`).
- Consumidores: C-12 (frontend de ficha), C-15 (exportación y lectura de la auditoría por paciente).
- Zona de riesgo (regla 12): datos de salud, consentimiento y auditoría. Governance ALTO: el diseño requiere aprobación antes del apply (aprobado D1–D11 el 2026-11-24) y el PR requiere review de integrante-1 o integrante-2.
