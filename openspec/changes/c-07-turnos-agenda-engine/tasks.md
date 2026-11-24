# Tasks

> Strict TDD: cada tarea arranca con un test que falla (RED), luego el mínimo código para pasarlo (GREEN), al menos un segundo caso (TRIANGULATE) y refactor con tests verdes. Antes de tocar archivos, `cd backend && ./gradlew test` y registrar la línea base (C-06: 545/545). Dominio puro sin Spring; integración contra H2 `MODE=MySQL` con las migraciones reales (regla 8), cuentas vía `AuthFlows`/`TestTokens`, datos vía `TenantFixtures`/`DomainFixtures`, reloj con `TestClockConfig.MutableClock`. Sin migraciones nuevas, sin SQL nativo, sin `sleep`. La grilla se toma de `GrillaAgenda.MINUTOS` (provisional, PA-03). Governance MEDIO con checkpoints: se reporta a la persona al cerrar las secciones 2, 4 y 7.

## 1. Línea base

- [x] 1.1 Correr `./gradlew test` y anotar la línea base (esperado 545/545). Verificar: suite verde; si algo falla, reportarlo como preexistente y no seguir.

## 2. Dominio puro (sin Spring) — checkpoint

- [x] 2.1 RED: `IntervaloTurnoTest`: 10:00–10:30 vs 10:00–10:30 solapa (exacto); vs 10:15–10:45 solapa (parcial); vs 10:05–10:20 solapa (contenido); vs 09:00–12:00 solapa (contenedor); vs 10:30–11:00 y 09:30–10:00 no (adyacentes); `fin <= inicio` lanza `IllegalArgumentException`. GREEN: `agenda/turno/IntervaloTurno` (design D2).
- [x] 2.2 RED: `TransicionesTurnoTest`: matriz completa 5×5 (las 7 válidas de RN-AG-05 aceptadas; las 18 restantes, incluidas las autotransiciones, rechazadas); `reprogramable` solo `PROGRAMADO`/`CONFIRMADO`; `requiereInicioPasado` solo `ASISTIO`/`AUSENTE`. GREEN: `agenda/turno/TransicionesTurno` (design D7).
- [x] 2.3 RED: `ReglasAgendaTest` (horario y grilla, design D5): franja lunes 09–13 local en `America/Argentina/Buenos_Aires`; `12:00Z` lunes 30 min cabe; 08:30 local no; 12:45 local 30 min no (cruza cierre); 12:30 local 30 min sí (termina justo al cierre); dos franjas 09–11 y 11–13 no se encadenan para un turno 10:30–11:30; 10:10 local no alineado; otro día de la semana sin franja no cabe; turno que cruza la medianoche local no cabe.
- [x] 2.4 RED: `ReglasAgendaTest` (bloqueos y sobreturno): bloqueo del sillón 1 aplica al sillón 1 y no al 2; bloqueo del profesional P aplica a P en cualquier sillón; bloqueo sin ámbito aplica a todo; bloqueo adyacente no aplica; `ExcepcionesSobreturno` con flag omite profesional, horario, grilla y bloqueos y **nunca** sillón; sin flag no omite nada. GREEN: `agenda/turno/ReglasAgenda` (design D3, D5). **Checkpoint**: reportar a la persona; D3 ya confirmada (propuesta base).

## 3. Repositorios (JPQL portable)

- [x] 3.1 RED: `TurnoRepositoryAgendaTest` (`@PersistenceTest`, clase nueva junto a `TurnoRepositoryTest` para no mezclar con los tests de esquema de C-02): `primerConflictoSillon` encuentra solapado exacto y parcial, ignora adyacentes, cancelados, otro sillón y el `excluirId`; `primerConflictoProfesional` igual por profesional; ambos con datos en A y B devuelven solo A (aislamiento). GREEN: métodos en `TurnoRepository` (design D11).
- [x] 3.2 RED: `buscarAgenda`: intersección con `[desde, hasta)`, filtros `sillonId`/`profesionalId` (ajeno → vacío), `incluirCancelados`, orden `inicio, id`, `join fetch` de paciente y prestación (se verifica accediendo a paciente y prestación con la transacción ya cerrada: sin `join fetch` lanzaría `LazyInitializationException`), aislamiento A/B. GREEN.
- [x] 3.3 RED: `BloqueoAgendaRepository.aplicables` (`BloqueoAgendaAplicablesTest`, clase nueva): incluye bloqueos de sillón igual, profesional igual, sin ámbito; excluye otro sillón, otro profesional, adyacentes y los de B. GREEN (design D11: no reutilizar `buscar`).

## 4. Servicio — checkpoint

- [x] 4.1 RED: `TurnoServiceTest` (`@PersistenceTest` + servicio), alta: válida → `PROGRAMADO`, `fin` desde la prestación, `TenantContext` aplicado; profesional por defecto con 1 activo, `ReferenciaInvalidaException("profesionalId")` con 0 o 2; paciente/sillón/prestación inactivo, inexistente o de B → `ReferenciaInvalidaException` con el campo; fuera de horario y fuera de grilla → `FueraDeAgendaException` campo `inicio`; bloqueo → `FueraDeAgendaException` con `bloqueoId`; conflicto sillón y profesional → `TurnoEnConflictoException` con el id y el motivo; sobreturno exceptúa profesional/horario/bloqueo y no sillón; orden de validación de design D9 (conflicto simultáneo de sillón y profesional informa sillón). GREEN: `TurnoService.crear` con `lockById` como primera sentencia (design D1).
- [x] 4.2 RED: cambio de estado: las transiciones válidas persisten; inválidas → `ConflictoException` sin cambios; `ASISTIO` con `MutableClock` antes del inicio → rechazo, después → ok; `motivoCancelacion` guardado al cancelar; cancelar libera el hueco (alta posterior en el mismo horario ok); turno de B → `RecursoNoEncontradoException`. GREEN: `Turno.cambiarEstado` + servicio.
- [x] 4.3 RED: reprogramación: hueco libre ok conservando duración (también tras editar la duración de la prestación); hueco ocupado → conflicto y turno intacto (recargado de la base); correr sobre sí mismo ok; cambio de sillón y de profesional revalida horario y bloqueos; estado final → `ConflictoException`; sillón/profesional omitidos se conservan. GREEN: `Turno.reprogramar` + servicio.
- [x] 4.4 RED: auditoría (contrato C-06: cada consumidor prueba su fila): alta → 1 `CREATE` `Turno` con `entidadId` y `{sobreturno}`; cambio de estado → `UPDATE` `{operacion: CAMBIO_ESTADO, estadoAnterior, estado}`; reprogramación → `UPDATE` `{operacion: REPROGRAMAR, inicioAnterior (epoch), sillonIdAnterior, profesionalIdAnterior, sobreturno}`; operaciones rechazadas (409/422/404) → 0 filas; el detalle no contiene `motivoCancelacion`, `notas` ni nombre del paciente; fail-closed sin mocks (token con un usuario de otro consultorio: la FK compuesta rechaza el `INSERT`, patrón de `AuditServiceTest` de C-06) → excepción y el turno no existe. GREEN: `AuditService.registrar` al final de cada escritura (design D4). **Checkpoint**: reportar a la persona.

## 5. API HTTP

- [x] 5.1 RED: `TurnoControllerIT` alta: `201` + `Location` y cuerpo `TurnoResponse` sin `consultorioId`/`version`; un `fin` enviado en el cuerpo se ignora (el record no tiene ese campo y Jackson ignora propiedades desconocidas por defecto en Spring Boot) y el `fin` devuelto es el calculado; `inicio` faltante, `notas` > 1000 caracteres → `400` campo; `409` con `conflicto{turnoId, inicio, fin, sillonId, profesionalId, motivo}`; `422` con `errores[{campo}]` y `bloqueoId` en bloqueo; ningún cuerpo de error contiene el nombre/DNI del paciente ni el `motivo` del bloqueo; `instance` = `about:blank`. GREEN: `TurnoController`, DTOs, `TurnoMapper`, handlers en `ApiExceptionHandler` (design D9).
- [x] 5.2 RED: `PATCH /api/turnos/{id}/estado` (`200`, `409` inválida, `400` estado desconocido o motivo con otro estado, `404` inexistente) y `PUT /api/turnos/{id}` (`200`, `409`, `422`, `404`). GREEN.
- [x] 5.3 RED: `GET /api/turnos` (`400` sin `desde`/`hasta`, `desde >= hasta`, > 42 días, fecha mal formada sin eco; `200` ordenado con `paciente{id, nombre, apellido}` y `prestacion{id, nombre}`; filtros; `incluirCancelados`) y `GET /api/turnos/{id}` (`200`/`404`); los `GET` no agregan filas a `audit_log`. GREEN (design D10).

## 6. Permisos y aislamiento transversales

- [x] 6.1 RED: `TurnoRbacIT`: `ADMIN`, `PROFESIONAL` y `RECEPCION` → `POST`/`PATCH`/`PUT`/`GET` permitidos (incluido sobreturno, sujeto a D3); sin token → `401` en los 5 endpoints. GREEN: `@PreAuthorize(Permisos.OPERACION)`.
- [x] 6.2 RED: `TurnoTenantIsolationIT`: A y B registrados por la API; con el token de A, `GET`/`PATCH`/`PUT` de un turno de B → `404` y el turno de B no cambia; alta en A con paciente, sillón, prestación o profesional de B → `422`; la agenda de A no muestra turnos de B en el mismo rango; un turno de B en el mismo horario y "sillón 1" no genera conflicto en A. GREEN.

## 7. Concurrencia determinista — checkpoint

- [x] 7.1 RED: `TurnoConcurrencyIT` según design "Test de concurrencia determinista": decorador `@Primary` de `DetectorConflictos` en `@TestConfiguration` que detiene al hilo A tras validar; B lanzado después de `validoA`; espera por condición de la primera señal (B bloqueado según `INFORMATION_SCHEMA.SESSIONS.BLOCKER_ID` — confirmar la columna en H2 acá; si no existe, aplicar el fallback documentado — o B llegó a validar → fallo inmediato); liberar A; afirmar 1 turno, 1 `CREATE` y conflicto de B con el id de A. Sin `sleep`; timeout de seguridad 10 s solo como guarda. GREEN: debería pasar ya con D1; si no, corregir el orden lock → validación → escritura.
- [x] 7.2 RED: mismo esquema para dos reprogramaciones al mismo hueco, alta vs reprogramación, y dos sobreturnos en el mismo sillón; y un caso de dos consultorios distintos donde B **no** queda bloqueado mientras A está detenido (B termina antes de liberar A). GREEN.
- [x] 7.3 Control negativo: comentar temporalmente `lockById` en `TurnoService`, correr `TurnoConcurrencyIT` y verificar que falla por la segunda señal; restaurar y verificar verde. Registrar el resultado en el handoff (resultado 2026-11-24: con `findById` en lugar de `lockById` fallan los 4 escenarios de cruce, todos por `B_VALIDO_SIN_ESPERAR`; consultorios distintos y la precondición de `information_schema.sessions` pasan igual, como corresponde). **Checkpoint**: reportar a la persona.

## 8. Verificación y entrega

- [x] 8.1 Test de arquitectura (reflexión sobre `agenda/turno`): ningún método combina `@Audited` con `@Transactional(readOnly = true)`; los métodos de escritura de `TurnoService` no son `readOnly` (regla 5 del handoff C-06).
- [x] 8.2 Verificar: `./gradlew test` completo en verde (línea base + nuevos), 2 corridas seguidas iguales; JaCoCo de `agenda/turno` (objetivo ≥ 90 % de instrucciones, reportar el valor real); `grep` sin llamadas de log con datos del paciente, `notas` o `motivo` en `agenda/turno` (regla 5); ningún controlador importa entidades JPA (regla 1); `git diff main -- backend/src/main/resources/db/migration` vacío (regla 6); sin SQL nativo (`nativeQuery`) ni `Thread.sleep` en el código ni en los tests nuevos; el literal de la grilla solo en `GrillaAgenda`.
- [x] 8.3 Handoff `knowledge-base/entrega/C-07.md` (qué se hizo, decisiones D1–D11 con la resolución de D3 y de las Open Questions, cómo se verificó, contrato para C-09/C-13/C-15, guía de verificación manual MySQL 8.4 del design con casillas para resultados, control negativo de 7.3, pendientes) y marcar `[x]` en `CHANGES.md` §C-07 con evidencia (solo el estado). Verificar: archivos presentes con la evidencia de 8.2.

## Workflow follow-up

- Commit (Conventional Commits, `Co-Authored-By` vigente), push y PR único hacia `main` solo con autorización explícita de la persona, con `.github/pull_request_template.md`; avisar a integrante-1/2 por consumir la auditoría (regla 12).
- Verificación manual contra MySQL 8.4 por la persona (design, secciones 0–3); `docker compose up` solo si lo pide.
- Archivar el change y sincronizar la spec `appointment-scheduling` cuando el PR esté mergeado.
