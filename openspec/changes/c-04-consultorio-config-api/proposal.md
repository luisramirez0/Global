# Proposal

## Why

Tras C-03 el odontólogo puede registrarse y entrar, pero su consultorio queda con un único "Sillón 1" y sin prestaciones, horarios ni bloqueos administrables: la agenda no puede reflejar su trabajo (US-002, US-013). C-04 está en el camino crítico (C-01 → C-02 → C-03 → **C-04** → C-07 → …): el motor de turnos de C-07 necesita sillones, prestaciones con duración, horarios de atención y bloqueos para validar RN-AG-01..04, y el frontend de C-11 necesita estos endpoints.

## What Changes

- `/api/sillones`: alta, listado, detalle, edición (nombre, activo) y baja lógica. Máximo **2 sillones activos** por consultorio (DD-01, RN-MT-02) y **al menos 1 activo**; violación (al crear, reactivar o desactivar) → `409`.
- `/api/prestaciones`: alta, listado, detalle, edición (nombre, duración, activo) y baja lógica. Duración en minutos **positiva y múltiplo de la grilla configurada** (RN-AG-03) → si no, `400`. Sin tope superior: ni V1 (`CHECK (duracion_minutos > 0)`, columna `INT`) ni KB 04/05 imponen uno.
- **Grilla de agenda**: un único punto de configuración en el código (constante de dominio), con **15 minutos como valor provisional** (SU-03). **No es una decisión funcional aprobada: la validación con un odontólogo está pendiente (PA-03, prioridad Alta)**; si cambia, se cambia solo ese valor.
- `/api/horarios-atencion`: alta, listado (filtro por profesional), detalle, edición y borrado. Día 1..7 (lunes = 1), `horaDesde < horaHasta`; horas alineadas a la grilla configurada (regla **condicionada a la validación de la grilla, PA-03**). Dos franjas del mismo profesional y día no pueden solaparse (adyacentes sí) → `409`. Comportamiento explícito si se omite `profesionalId` con 0, 1 o más profesionales activos (spec).
- `/api/bloqueos`: alta, listado (filtros `desde`/`hasta`/`sillonId`/`profesionalId`), detalle, edición y borrado. Instantes UTC, `fin > inicio`; ámbito por sillón, por profesional, por ambos o de todo el consultorio (ambos nulos); `profesionalId` omitido nunca se completa por defecto.
- Invariantes entre filas (límite de sillones, último sillón activo, no-solapamiento de franjas) validados dentro de la misma transacción de escritura con lock pesimista sobre la fila del consultorio, en altas **y** ediciones.
- DTOs (records) + mappers + Bean Validation; las entidades JPA nunca salen por la API (regla 1). Referencias a sillón/profesional inexistentes o de otro consultorio → `422`; id de ruta inexistente o de otro consultorio → `404`.
- RBAC según KB 03 y el spec vigente `access-control`: lectura de sillones/prestaciones/horarios/bloqueos para `ADMIN`, `PROFESIONAL` y `RECEPCION`; escritura de sillones/prestaciones/horarios solo `ADMIN`/`PROFESIONAL`; bloqueos: crear/leer/editar los tres roles, borrar solo `ADMIN`/`PROFESIONAL`.
- `ApiExceptionHandler` suma `404`, `409` de configuración y `422` en formato `ProblemDetail`, sin datos enviados por el cliente.
- Tests (TDD estricto): dominio puro sin Spring y de integración contra H2 `MODE=MySQL` (CRUD, duración inválida, bloqueo por sillón/profesional, RBAC, aislamiento A/B, rutas de edición y concurrencia).

### Decisión RBAC sobre bloqueos (contradicción documentada)

- `CHANGES.md` §C-04 (línea 194, commit `1238d0e`) dice "RBAC (RECEPCION solo lectura en config)". KB 03 (línea 26, mismo commit `1238d0e`) da a RECEPCION **CRU** sobre bloqueos, y el spec vigente `access-control` (línea 21, commit `f360c74` de C-03, posterior) clasifica bloqueos como operativos que MUST admitir RECEPCION; `Permisos.OPERACION` y el handoff `knowledge-base/entrega/C-03.md` lo reflejan.
- **Decisión (confirmada por la persona, 2026-11-23)**: RECEPCION lee, crea y edita bloqueos, **no** los borra. **Fuente de verdad**: KB 03 + spec `access-control`. Para sillones, prestaciones y horarios RECEPCION es solo lectura, coherente con ambos textos.
- La redacción de `CHANGES.md` §C-04 queda pendiente de conciliar más adelante (este change no la edita).

## Capabilities

### New Capabilities
- `agenda-configuration`: administración por API de la configuración de agenda de un consultorio (sillones, prestaciones, horarios de atención y bloqueos) con sus reglas de validación, permisos por rol, concurrencia y aislamiento por consultorio.

### Modified Capabilities
- `access-control`: "Errores homogéneos sin datos personales" incorpora `404` y `422` a los códigos de error con formato `ProblemDetail`.

## Impact

- **Código**: nuevos subpaquetes `agenda/{sillon,prestacion,horario,bloqueo}/` (controlador, servicio, DTOs, mapper, validación de dominio) y `agenda/config/GrillaAgenda`; las entidades y repositorios de C-02 quedan en `agenda/` (sin mover). Métodos de consulta nuevos en los repositorios existentes y un lock pesimista en `ConsultorioRepository`. `common/web/ApiExceptionHandler` + excepciones comunes.
- **Esquema**: **ninguna migración nueva**. V1 ya tiene todas las columnas, FK compuestas por consultorio y `CHECK` de coherencia; límite de sillones, grilla y no-solapamiento se validan en la aplicación (portables a H2 `MODE=MySQL`).
- **Configuración / dependencias**: ninguna nueva.
- **Consumidores**: C-07 consume sillones/prestaciones activos, `duracionMinutos`, horarios, bloqueos (nulos = todo el consultorio) y la grilla desde el mismo punto de configuración; C-11 consume estos endpoints. Solo como interfaz.
- **Fuera de alcance**: turnos (C-07), pacientes (C-05), auditoría de configuración (C-06), frontend (C-11), `GET /api/profesionales` y ABM de profesionales, exponer por API el catálogo `PrestacionSugerida` (queda intacto), grilla por consultorio, precio, horarios por defecto al registrarse, C-17..C-22.
- **Preguntas abiertas**: PA-03 (grilla y duraciones sin validar con odontólogo); conciliar la redacción de `CHANGES.md` §C-04.
- **Governance**: BAJO; no toca auth/JWT ni datos clínicos.
