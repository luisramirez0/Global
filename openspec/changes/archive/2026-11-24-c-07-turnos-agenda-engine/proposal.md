# Proposal

## Why

Con C-04 (configuración de agenda), C-05 (pacientes) y C-06 (auditoría) cerrados, el consultorio tiene sillones, prestaciones, horarios, bloqueos y pacientes, pero todavía no puede reservar un turno: la tabla `turno` de C-02 existe sin ninguna lógica. C-07 está en el camino crítico (C-01 → C-02 → C-03 → C-04 → **C-07** → C-09 → C-14 → C-16) y desbloquea C-09 (recordatorios), C-13 (frontend de agenda) y C-15. Es el corazón del MVP: "turnos sin solapamiento" es parte del corte vertical que nunca se recorta (R-01, KB 10).

## What Changes

- `POST /api/turnos`: crea un turno `PROGRAMADO` para un paciente, prestación, sillón y profesional. `fin` se calcula desde la duración de la prestación (RN-AG-03); el cliente no envía `fin`.
- Validación transaccional antes de guardar, con lock pesimista sobre la fila del consultorio como primera sentencia (DD-06, design D1):
  - **Solapamiento por sillón** (RN-AG-01) → `409` con el turno en conflicto. Nunca se exceptúa.
  - **Solapamiento por profesional** (RN-AG-02) → `409`, salvo sobreturno explícito.
  - **Horario de atención** (RN-AG-04): el turno debe caber entero en una franja del profesional en la zona horaria del consultorio, con `inicio` alineado a la grilla → si no, `422`, salvo sobreturno.
  - **Bloqueos** (RN-AG-04) del sillón, del profesional o de todo el consultorio → `422`, salvo sobreturno.
  - Intervalos semiabiertos `[inicio, fin)`: turnos adyacentes no se solapan; los `CANCELADO` no ocupan lugar (RN-AG-07).
- **Sobreturno**: solo con `sobreturno: true` explícito; se guarda `es_sobreturno` y queda auditado.
- `PATCH /api/turnos/{id}/estado`: máquina de estados RN-AG-05 (`PROGRAMADO → CONFIRMADO|CANCELADO|ASISTIO|AUSENTE`, `CONFIRMADO → CANCELADO|ASISTIO|AUSENTE`; finales sin salida). Transición inválida → `409`. `ASISTIO`/`AUSENTE` solo cuando ya pasó `inicio`. `motivoCancelacion` opcional al cancelar.
- `PUT /api/turnos/{id}` (reprogramar, RN-AG-06): mueve `inicio`, sillón y/o profesional conservando la duración original, revalida RN-AG-01..04 excluyendo al propio turno; solo en `PROGRAMADO`/`CONFIRMADO`.
- `GET /api/turnos?desde&hasta[&sillonId][&profesionalId][&incluirCancelados]` (vista diaria/semanal, US-010) y `GET /api/turnos/{id}`.
- **Auditoría** (RN-DS-02, contrato de C-06): `CREATE` en el alta y `UPDATE` en cambio de estado y reprogramación, con `AuditService.registrar` explícito dentro de la transacción de la operación (el detalle es dinámico: regla 6 del handoff C-06). Los `GET` de agenda **no** se auditan.
- DTOs (records) + mapper; errores `ProblemDetail` sin eco de datos del cliente ni datos del paciente; RBAC `Permisos.OPERACION` (ADMIN, PROFESIONAL, RECEPCION).
- Tests con TDD estricto, empezando por el dominio puro; test de concurrencia **determinista** (sin `sleep`) que falla si se quita el lock.

## Capabilities

### New Capabilities
- `appointment-scheduling`: alta, consulta, cambio de estado y reprogramación de turnos sin solapamientos, con validación de horario, bloqueos, sobreturno explícito, auditoría de escrituras, permisos por rol, concurrencia y aislamiento por consultorio.

### Modified Capabilities
- Ninguna. `access-control` ya clasifica turnos como operación (`OPERACION`); `audit-log` ya define `AuditService` y el detalle restringido que este change consume.

## Impact

- **Código**: nuevo subpaquete `agenda/turno/` (dominio puro, servicio, controlador, DTOs, mapper). Métodos nuevos en `TurnoRepository` y `BloqueoAgendaRepository` (JPQL portable). La entidad `agenda/Turno` (C-02) recibe métodos de dominio (cambio de estado, reprogramación) en lugar de setters sueltos.
- **Esquema**: **ninguna migración nueva**. V2 ya tiene `turno` con `es_sobreturno`, `version`, FK compuestas por consultorio, `CHECK (fin > inicio)`, `CHECK` de estado e índices `(sillon_id, inicio)`, `(profesional_id, inicio)`, `(consultorio_id, inicio)`.
- **Dependencias**: ninguna nueva.
- **Consumidores**: C-09 (turno, paciente y fecha para el recordatorio), C-13 (endpoints de agenda), C-15 (filas `Turno` en `audit_log`).
- **Zona de revisión (regla 12)**: consume la auditoría de C-06 → se avisa a integrante-1/2 en el PR.
- **Fuera de alcance**: reapertura de estados finales (RN-AG-05 "acción explícita": futura), pasaje automático a `AUSENTE` por tiempo (Flujo 6: lo marca el usuario), lista de espera (C-17), políticas de cancelación/seña (RN-AG-09), recordatorios (C-09), frontend (C-13), detección de bloqueos creados sobre turnos ya agendados, auditoría de lecturas de agenda, `GET /api/profesionales`, C-17..C-22.
