# Design

## Context

- Motivación y alcance: `proposal.md`. Requisitos: `specs/appointment-scheduling/spec.md`.
- C-02 dejó `agenda/Turno` (`TenantEntity`, `@Version`, instantes UTC) y `TurnoRepository` vacío; V2 ya tiene columnas, FK compuestas por consultorio, `CHECK` de estado y rango, e índices `(sillon_id, inicio)`, `(profesional_id, inicio)`, `(consultorio_id, inicio)`, `(paciente_id)`.
- C-04 (handoff, "Contrato para C-07"): grilla en `agenda.config.GrillaAgenda.MINUTOS` (15, provisional, PA-03); solo sillones y prestaciones activos; `diaSemana` ISO (lunes = 1) y horas locales del consultorio (`consultorio.zona_horaria`); bloqueos en `Instant` UTC con ámbito sillón/profesional/ambos/todo el consultorio; lock `ConsultorioRepository.lockById(TenantContext.require())`; excepciones `RecursoNoEncontradoException` (404), `ConflictoException` (409), `ReferenciaInvalidaException(campo)` (422), `ValidacionException(campo, mensaje)` (400); profesional por defecto (D8 de C-04).
- C-05: `Paciente` con baja lógica (`activo`).
- C-06 (handoff, "Contrato para C-07 / C-08 / C-15"): `AuditService.registrar(accion, entidad, entidadId, DetalleAuditoria)` con `@Transactional(MANDATORY)`; detalle con claves `^[a-z][A-Za-z0-9]{0,39}$` y valores `long|boolean|Enum|codigo`; **un método auditado no puede ser `readOnly`** (MySQL rechaza el `INSERT` en conexión read-only y H2 no lo detecta); detalle dinámico → `registrar` explícito, no `@Audited`; cada consumidor prueba su fila en `audit_log`; fail-closed.
- Infraestructura: bean `Clock` (`config.ClockConfig`, UTC) y `testsupport.TestClockConfig.MutableClock` para tests; `AuthFlows`, `TestTokens`, `TenantFixtures`, `DomainFixtures`, `@PersistenceTest`, `ApiCalls`.
- Restricciones: reglas 1, 2, 5, 6, 7, 8 de `CLAUDE.md`; entrega 25/11/2026 → diseño pragmático, sin dependencias ni migraciones nuevas.

## Goals / Non-Goals

**Goals:**
- Ningún par de turnos no cancelados solapados en el mismo sillón, ni en el mismo profesional salvo sobreturno, **también bajo concurrencia**.
- Reglas de agenda como funciones puras sin Spring; el servicio solo orquesta lock → carga → reglas → escritura → auditoría.
- Contrato estable para C-09 y C-13.

**Non-Goals:** reapertura de estados finales; `AUSENTE` automático; lista de espera; políticas de cancelación/seña; detectar bloqueos creados sobre turnos existentes; auditar lecturas de agenda; paginado; `GET /api/profesionales`.

## Decisions

> D1–D11 aprobadas por la persona el 2026-11-24 (D3 confirmada con la propuesta base el mismo día).

### D1 — Concurrencia: lock pesimista sobre la fila del consultorio
- Toda escritura de turnos (alta, cambio de estado, reprogramación) corre en un único `@Transactional` (lectura-escritura) cuya **primera sentencia** es `ConsultorioRepository.lockById(TenantContext.require())` (`PESSIMISTIC_WRITE` → `SELECT … FOR UPDATE`).
- Resultado: las escrituras de turnos de un mismo consultorio se serializan; la validación ve siempre lo confirmado por la transacción anterior. Consultorios distintos no se esperan entre sí.
- Por qué no lock por sillón + profesional (DD-06 literal): dos locks por transacción exigen orden fijo para evitar deadlocks, reprogramar de sillón suma un tercero, y el paralelismo extra no se nota con 1 odontólogo y 1–2 sillones. **Desvío de la letra de DD-06 documentado acá**; la intención de DD-06 (validación en servicio dentro de transacción con lock pesimista, sin constraints exclusivos de MySQL) se cumple. El paso a lock por fila no cambia API ni esquema.
- El cambio de estado no puede crear solapamientos, pero toma el mismo lock para que todas las escrituras sean uniformes y la `version` (optimista, C-02) nunca dispare en la práctica. Si dispara (`ObjectOptimisticLockingFailureException`), se mapea a `409` genérico.
- `TenantContext` está fijado desde el token antes del `@Transactional` (C-03), así que el lock y todas las consultas quedan acotados al consultorio.

### D2 — Semántica de solapamiento
- Intervalos semiabiertos `[inicio, fin)`: `a.inicio < b.fin && b.inicio < a.fin`. Adyacentes (10:00–10:30 y 10:30–11:00) no solapan.
- Cuentan todos los turnos del consultorio con estado distinto de `CANCELADO` (RN-AG-07: cancelar libera el hueco). `ASISTIO`/`AUSENTE` sí cuentan (un turno pasado no deja de haber ocupado el sillón).
- Un turno existente marcado como sobreturno ocupa su sillón y su profesional como cualquier otro: un turno nuevo normal que lo pise también da `409`.
- En la reprogramación se excluye al propio turno.

### D3 — Sobreturno
- Solo con `sobreturno: true` explícito en el cuerpo. Con el flag, se omiten: solapamiento **por profesional** (RN-AG-02), horario de atención y alineación a la grilla, y bloqueos (RN-AG-04).
- **Nunca** se omite el solapamiento **por sillón** (RN-AG-01 no tiene excepción): `409` también con sobreturno.
- Lo pueden usar los tres roles (`OPERACION`, KB 03 "Turnos: CRUD" para RECEPCION). Siempre auditado (`detalle.sobreturno = true`).
- Sin el flag, un conflicto de profesional devuelve `409` aunque hubiera podido ser sobreturno: el sistema nunca lo infiere.
- **Confirmado por la persona (2026-11-24)**: propuesta base. No se omite el solapamiento por sillón; el sobreturno sí omite los bloqueos (también los de sillón); habilitado para los tres roles.

### D4 — Auditoría
- No se usa `@Audited`: todas las escrituras llaman a `AuditService.registrar(...)` como último paso **dentro** de la transacción de la operación (misma conexión lectura-escritura, fail-closed: si el `INSERT` falla, se revierte el turno y responde `500` genérico vía `AuditoriaFallidaException`/manejo de C-06).
- Entidad auditada: `"Turno"`; `entidadId` = id del turno.

| Operación | Acción | Detalle |
|---|---|---|
| Alta | `CREATE` | `{sobreturno: bool}` |
| Cambio de estado | `UPDATE` | `{operacion: CAMBIO_ESTADO, estadoAnterior: <enum>, estado: <enum>}` |
| Reprogramación | `UPDATE` | `{operacion: REPROGRAMAR, inicioAnterior: <epoch s>, sillonIdAnterior: <long>, profesionalIdAnterior: <long>, sobreturno: bool}` |

- `operacion` es un enum interno (`OperacionTurnoAuditada`) → nunca viene del input. `motivoCancelacion` y `notas` (texto libre) **nunca** van al detalle. Ningún nombre ni dato del paciente.
- `inicioAnterior` en epoch (segundos UTC) porque `DetalleAuditoria` no admite fechas; el nuevo inicio se reconstruye leyendo el turno.
- Los `GET` de agenda **no** se auditan (datos administrativos, no clínicos; RN-DS-02 apunta a la ficha). Por eso los métodos de lectura pueden llevar `@Transactional(readOnly = true)` sin contradecir la regla 5 de C-06: **ningún método de C-07 combina `@Audited` con `readOnly`**. Un test de arquitectura lo afirma (tarea 8.1).
- C-07 es el primer consumidor real de escrituras auditadas contra MySQL: la verificación manual (abajo) cubre ese pendiente de C-06.

### D5 — Horario de atención y grilla
- Se convierte `[inicio, fin)` a `ZonedDateTime` con `ZoneId.of(consultorio.zonaHoraria)`.
- El turno MUST caber **entero** en **una** franja `HorarioAtencion` del profesional para el `diaSemana` ISO del inicio local: `horaDesde <= inicioLocal` y `finLocal <= horaHasta`, misma fecha local. No se encadenan franjas contiguas; un turno que cruza la medianoche local nunca cabe.
- `inicio` MUST estar alineado a la grilla en hora local (`GrillaAgenda.alineada(LocalTime)`: minutos múltiplo de `MINUTOS`, segundos y nanos en 0). La duración ya es múltiplo de la grilla (C-04), así que `fin` también queda alineado.
- Error → `422` con `errores[{campo: "inicio"}]`. Grilla provisional (PA-03): si cambia, solo cambia `GrillaAgenda`.
- Sobreturno omite este chequeo completo (D3).

### D6 — Duración
- Alta: `fin = inicio + prestacion.duracionMinutos`. El cuerpo no tiene `fin`.
- Reprogramación: conserva la duración guardada (`fin - inicio` actual), porque la spec de C-04 dice que editar la duración de una prestación MUST NOT alterar turnos ya registrados. La prestación del turno no se cambia al reprogramar (fuera de alcance: se cancela y se crea otro).

### D7 — Máquina de estados
- Tabla pura `TransicionesTurno` (RN-AG-05): `PROGRAMADO → {CONFIRMADO, CANCELADO, ASISTIO, AUSENTE}`, `CONFIRMADO → {CANCELADO, ASISTIO, AUSENTE}`; `CANCELADO`, `ASISTIO`, `AUSENTE` sin salidas; la transición a sí mismo es inválida.
- Inválida → `409` (`ConflictoException`, título genérico, sin eco del estado pedido).
- `ASISTIO`/`AUSENTE` exigen `inicio <= now(Clock)` → si no, `409`. `CONFIRMADO`/`CANCELADO` se permiten en cualquier momento.
- `motivoCancelacion` opcional, ≤ 255 bytes UTF-8 (`@MaxUtf8Bytes`), solo se guarda con `CANCELADO`; enviado con otro estado → `400` campo `motivoCancelacion`.
- Reapertura de finales: fuera de alcance.
- La reprogramación solo se admite en `PROGRAMADO`/`CONFIRMADO` (otro estado → `409`) y no cambia el estado.

### D8 — Referencias del cuerpo
- `pacienteId`, `prestacionId`, `sillonId`: deben existir en el consultorio y estar activos → si no, `422` con el campo. Inexistente, ajeno o inactivo dan la misma respuesta (no revela existencia en otro consultorio).
- `profesionalId`: indicado → existente y activo, si no `422`; omitido → si hay exactamente 1 profesional activo se usa ese, con 0 o > 1 → `422` (mismo patrón D8 de C-04).
- Reprogramación: `sillonId` y `profesionalId` omitidos = se conservan; indicados se validan igual que en el alta.
- Id de ruta inexistente o ajeno → `404`.

### D9 — Errores
| Caso | HTTP | Cuerpo |
|---|---|---|
| Forma inválida (Bean Validation, rango, `desde >= hasta`) | 400 | `errores[{campo, mensaje}]` |
| Turno inexistente o ajeno | 404 | genérico |
| Solapamiento | 409 | `conflicto{turnoId, inicio, fin, sillonId, profesionalId, motivo: SILLON\|PROFESIONAL}` |
| Transición inválida / estado no reprogramable / asistencia futura | 409 | genérico |
| Referencia inválida | 422 | `errores[{campo}]` |
| Fuera de horario o grilla | 422 | `errores[{campo: "inicio"}]` |
| Dentro de un bloqueo | 422 | `errores[{campo: "inicio"}]` + `bloqueoId` |
- Ningún cuerpo de error contiene nombre, DNI o teléfono del paciente, `notas` ni `motivo` del bloqueo. Excepciones nuevas en `agenda/turno` (`TurnoEnConflictoException`, `FueraDeAgendaException`) mapeadas en `ApiExceptionHandler` con `instance = about:blank` (gotcha de C-04).
- Si coinciden conflicto de sillón y de profesional, se informa el de sillón (no exceptuable). Orden de validación: referencias (422) → grilla/horario (422) → bloqueos (422) → solapamiento sillón (409) → solapamiento profesional (409).

### D10 — Consulta de agenda
- `GET /api/turnos?desde&hasta`: ambos obligatorios, `Instant` ISO-8601 UTC, `desde` inclusivo por intersección (`t.fin > desde && t.inicio < hasta`), `desde < hasta`, rango ≤ 42 días → si no, `400`.
- Filtros opcionales `sillonId`, `profesionalId` (ajeno → lista vacía, igual que C-04), `incluirCancelados` (default `false`). Orden `inicio, id`. Sin paginado (acotado por el rango).
- `GET /api/turnos/{id}` → `TurnoResponse` o `404`.
- `TurnoResponse`: `id, inicio, fin, estado, sobreturno, motivoCancelacion, notas, sillonId, profesionalId, paciente{id, nombre, apellido}, prestacion{id, nombre}`. Sin `consultorioId` ni `version`. Paciente y prestación con `join fetch` (sin N+1). Nombre y apellido viajan solo en la respuesta a usuarios autorizados; nunca en logs.
- Lectura con `@Transactional(readOnly = true)` (no auditada, D4).

### D11 — Paquetes y clases
- La entidad sigue en `agenda/Turno` (C-02, sin mover). Se reemplazan los setters sueltos por métodos de dominio: `cambiarEstado(EstadoTurno, String motivo)`, `reprogramar(Sillon, Profesional, Instant inicio, Instant fin, boolean sobreturno)`.
- `agenda/turno/` (zona de `CHANGES.md`):
  - Dominio puro sin Spring: `IntervaloTurno` (record `inicio, fin` con `solapaCon`), `TransicionesTurno`, `ReglasAgenda` (cabe en franja, alineación, bloqueo aplicable, qué omite el sobreturno).
  - `DetectorConflictos` (bean): consultas de conflicto por sillón y por profesional y bloqueos aplicables. Bean separado a propósito: es el punto que el test de concurrencia decora (abajo).
  - `TurnoService`, `TurnoController`, `TurnoCreateRequest`, `TurnoReprogramarRequest`, `TurnoEstadoRequest`, `TurnoResponse`, `TurnoMapper` (estático), excepciones.
- Repositorios (JPQL portable, sin SQL nativo ni `JpaSpecificationExecutor`):
  - `TurnoRepository.primerConflictoSillon(sillonId, inicio, fin, excluirId)`, `primerConflictoProfesional(...)`, `buscarAgenda(desde, hasta, sillonId, profesionalId, incluirCancelados)` con `join fetch`.
  - `BloqueoAgendaRepository.aplicables(inicio, fin, sillonId, profesionalId)`: intersección y `(b.sillon is null or b.sillon.id = :sillonId) and (b.profesional is null or b.profesional.id = :profesionalId)`. **No** se reutiliza `buscar` de C-04: ese filtra por igualdad y no incluiría los bloqueos de todo el consultorio.
- Sin logs con datos del paciente (regla 5); si hace falta, solo ids.

## Test de concurrencia determinista

Objetivo: probar que el lock impide dos turnos solapados **sin depender de cómo el planificador intercale los hilos** (sin `sleep`, sin tiempos al azar, sin "correrlo 3 veces").

1. `TurnoConcurrencyIT` (sin `@Transactional` en el test, `TenantContext` fijado en cada hilo, servicio real contra H2 `MODE=MySQL`). Un `@TestConfiguration` registra un decorador `@Primary` de `DetectorConflictos` (el de producción no tiene hooks): para el hilo marcado como A, después de consultar conflictos, hace `validoA.countDown()` y espera `continuarA.await()`.
2. Hilo A llama `crear(turno 10:00–10:30)`: toma el lock, valida (sin conflicto) y queda detenido **dentro** de su transacción, con el lock tomado y sin haber insertado.
3. El test espera `validoA` y lanza el hilo B: `crear(turno 10:15–10:45, mismo sillón)`.
4. El test espera la **primera** de dos señales:
   - **B bloqueado por A**: `INFORMATION_SCHEMA.SESSIONS` de H2 muestra la sesión de B con `BLOCKER_ID` = sesión de A (consulta de test, no de producción; se confirma la columna en el paso RED). Es un hecho de la base, no una suposición de tiempo.
   - **B llegó a validar** (el decorador ve una segunda consulta mientras A está detenido): solo es posible sin lock → el test **falla en el acto**.
5. Se libera A (`continuarA.countDown()`): inserta, audita y confirma. B obtiene el lock, ve el conflicto y lanza `TurnoEnConflictoException`.
6. Verificación: exactamente 1 turno en ese sillón, 1 fila `CREATE` de `Turno` en `audit_log`, B con conflicto cuyo `turnoId` es el de A.

- La espera del paso 4 es por condición con un **timeout de seguridad** (10 s) que solo existe para que la suite no se cuelgue si algo se rompe; el resultado nunca depende del tiempo. Si B agotara el lock timeout de H2, fallaría con error de lock: falla ruidosa, nunca un falso verde.
- Mismo esquema para: reprogramación de dos turnos hacia el mismo hueco; alta vs reprogramación al mismo hueco; dos sobreturnos sobre el mismo sillón (el sillón sigue protegido).
- Control negativo: se ejecuta una vez con el `lockById` comentado y se registra en el handoff que el test falla (paso 4, segunda señal).
- Fallback si H2 no expusiera `BLOCKER_ID`: detectar que el hilo B está esperando dentro del lock de H2 por su `Thread.State` + stack (`org.h2…`). Se decide en el RED de la tarea 7.1 y se documenta.

## Verificación manual contra MySQL 8.4 (a cargo de la persona)

> Regla 9: el stack lo levanta la persona. Comandos para Git Bash; `$API=http://localhost:8080/api`. No pegar tokens ni datos personales reales en issues/PR. Usar datos ficticios.

### 0. Preparación
1. `docker compose up -d mysql` y backend con perfil `dev` (como en C-06). Verificar `GET $API/health` → `UP`.
2. Registrar un consultorio de prueba (`POST $API/auth/register`) y hacer login (`POST $API/auth/login`); guardar `TOKEN`. El registro crea 1 profesional y "Sillón 1".
3. Crear: prestación de 30 min (`POST $API/prestaciones`), franja lunes 09:00–13:00 (`POST $API/horarios-atencion`), un segundo sillón (`POST $API/sillones`), un paciente ficticio (`POST $API/pacientes`). Anotar ids. Elegir un lunes futuro `L`; en Buenos Aires (UTC-3) 09:00 local = `L T12:00:00Z`.

### 1. Funcional (código esperado)
| # | Acción | Esperado |
|---|---|---|
| 1 | `POST /turnos` 10:00 local, sillón 1 | `201`, `estado=PROGRAMADO`, `fin` = +30 min |
| 2 | En `mysql`: `SELECT inicio, fin FROM turno WHERE id=<id>;` | `L 13:00:00` / `L 13:30:00` (UTC) |
| 3 | Mismo horario, sillón 1 | `409`, `conflicto.turnoId` = #1, `motivo=SILLON` |
| 4 | 10:15, sillón 1 (parcial) | `409` |
| 5 | 10:30, sillón 1 (adyacente) | `201` |
| 6 | 10:00, sillón 2, mismo profesional | `409`, `motivo=PROFESIONAL` |
| 7 | Igual que 6 con `sobreturno:true` | `201`, `sobreturno=true` |
| 8 | 10:00, sillón 1, `sobreturno:true` | `409` (sillón nunca exceptuado) |
| 9 | 08:30 local o 12:45 local (cruza el cierre) | `422` campo `inicio` |
| 10 | 10:10 local (fuera de grilla) | `422` campo `inicio` |
| 11 | Crear bloqueo de sillón 2 11:00–12:00 y pedir turno 11:00 en sillón 2 | `422` con `bloqueoId`; con `sobreturno:true` → `201` |
| 12 | `PATCH /turnos/#1/estado` `CONFIRMADO` | `200` |
| 13 | `PATCH` `PROGRAMADO` sobre #1 | `409` |
| 14 | `PATCH` `ASISTIO` sobre un turno futuro | `409` |
| 15 | `PATCH` `CANCELADO` con `motivoCancelacion` sobre #1; luego crear otro turno 10:00 sillón 1 | `200`; `201` (hueco liberado) |
| 16 | `PUT /turnos/#5` a 11:30 | `200`, misma duración |
| 17 | `PUT /turnos/#5` hacia un hueco ocupado | `409`, el turno no cambia |
| 18 | `GET /turnos?desde=L T00:00Z&hasta=L+1 T00:00Z` con y sin `incluirCancelados=true`, y con `sillonId` | lista ordenada por `inicio`, con `paciente{id,nombre,apellido}` |
| 19 | Con token de RECEPCION (si se crea uno) `POST /turnos` | `201`; sin token → `401` |

### 2. Auditoría (escritura auditada real, pendiente de C-06)
1. `SELECT id, accion, entidad, entidad_id, detalle, usuario_id, ip FROM audit_log WHERE entidad='Turno' ORDER BY id;`
   Esperado: `CREATE` por cada `201`, con `{"sobreturno":true}` en los pasos 7 y 11; `UPDATE` con `operacion` `CAMBIO_ESTADO`/`REPROGRAMAR`. **Ninguna** fila por los `409`/`422` ni por los `GET`. Ningún nombre ni `motivoCancelacion` en `detalle`.
2. En el log del backend: **ningún** `Connection is read-only` ni `AuditoriaFallidaException`.
3. Pendiente de C-06: `GET $API/auditoria?entidad=Turno&accion=UPDATE`, `?entidadId=<id>`, `?usuarioId=<id>`, `?desde=…&hasta=…` → filtran como en H2.

### 3. Lock real (determinista, dos sesiones)
1. Sesión `mysql` 1: `START TRANSACTION; SELECT id FROM consultorio WHERE id=<consultorioId> FOR UPDATE;` **sin** `COMMIT`.
2. Terminal 2: `POST /turnos` válido → **queda colgado** (no responde).
3. Opcional, sesión `mysql` 3: `SELECT * FROM performance_schema.data_lock_waits;` → una espera sobre `consultorio`.
4. Sesión 1: `COMMIT;` → el `POST` responde `201` al instante.
5. Repetir: en la sesión 1, antes del `COMMIT`, `INSERT` manual de un turno solapado (o crearlo por API desde una tercera terminal antes de tomar el lock) y confirmar → el `POST` colgado responde `409`.
6. `innodb_lock_wait_timeout` es 50 s por defecto: hacer el `COMMIT` antes; si vence, el `POST` responde `500`/`409` genérico y se repite.
7. Consultorio distinto (otro registro): su `POST` **no** se cuelga mientras la sesión 1 tiene el lock del primero.

Registrar resultados (fecha, OK/NO OK por fila) en el handoff `knowledge-base/entrega/C-07.md`.

## Risks / Trade-offs

- **PA-03 (grilla de 15 min) sigue abierta**: si cambia, cambian `GrillaAgenda` y los tests con valores concretos.
- **H2 vs MySQL en locks**: H2 `MODE=MySQL` emula `FOR UPDATE` pero no es InnoDB → la sección 3 de la verificación manual es obligatoria antes de dar por cerrado C-07.
- **Read-only invisible en H2**: mitigado porque ningún método auditado es `readOnly` (test de arquitectura) y por la verificación manual sección 2.
- **Serialización por consultorio**: aceptable con el volumen del MVP; reversible a lock por fila (D1).
- **Bloqueos creados después**: un bloqueo nuevo no detecta turnos ya agendados (limitación de C-04 que se mantiene).
- **Zona horaria**: depende de `consultorio.zona_horaria` válida; un valor inválido daría `500`. El registro siempre usa el default; no hay ABM de consultorio que lo cambie todavía.

## Open Questions

Resueltas por la persona el 2026-11-24:
1. **D3**: propuesta base (ver D3).
2. **Turnos en el pasado**: permitido crear (y reprogramar a) un `inicio` anterior a ahora, por ejemplo para cargar un turno olvidado; el alta no valida contra el reloj.
3. **Reglas extra**: `notas` hasta 1000 caracteres; si chocan sillón y profesional a la vez se informa el conflicto de sillón (D9).

Sigue abierta: RN-AG-01/02 figuran "(a validar)" en la KB y la grilla depende de PA-03; se implementan tal cual y cualquier cambio se escala.
