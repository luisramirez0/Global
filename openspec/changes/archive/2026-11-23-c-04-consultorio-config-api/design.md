# Design

## Context

- Motivación y alcance: `proposal.md`. Requisitos: `specs/agenda-configuration/spec.md` y el delta de `specs/access-control/spec.md`.
- C-02 dejó en `agenda/` las entidades `Sillon`, `Prestacion`, `HorarioAtencion`, `BloqueoAgenda`, `Profesional` (todas `TenantEntity` con `@TenantId`) y sus `JpaRepository` vacíos. Hibernate agrega `consultorio_id` a toda consulta **y a la búsqueda por id** (spec `tenant-isolation`) y lo completa al insertar.
- V1 ya cubre el esquema: `sillon(nombre, activo)`, `prestacion(nombre, duracion_minutos INT CHECK > 0, activo)`, `horario_atencion(profesional_id, dia_semana 1..7, hora_desde < hora_hasta)`, `bloqueo_agenda(profesional_id?, sillon_id?, inicio < fin, motivo)` con FK compuestas `(consultorio_id, id)`.
- C-03 dejó: `TenantContext` fijado desde el token antes de todo `@Transactional`, `Permisos.GESTION`/`Permisos.OPERACION`, `ApiExceptionHandler` con `ProblemDetail` (400 con `errores[{campo, mensaje}]`, 401, 403, 409, 429, 500) y `MaxUtf8Bytes`. Test support: `AuthFlows`, `TestTokens`, `TenantFixtures`, `DomainFixtures`, `@PersistenceTest`.
- Restricciones: reglas 1, 2, 5, 6, 8 de `CLAUDE.md`; entrega 25/11/2026 → diseño pragmático, sin dependencias nuevas.

## Goals / Non-Goals

**Goals:**
- Un patrón repetible (controller → service transaccional → mapper estático → DTO record) igual para los cuatro recursos.
- Reglas de negocio como funciones puras testeables sin Spring; el servicio orquesta lock + repositorio + regla.
- Invariantes entre filas correctos bajo concurrencia, tanto en altas como en ediciones.
- Contrato estable para C-07 y C-11.

**Non-Goals:** validar turnos contra horarios/bloqueos (C-07); detectar bloqueos sobre turnos existentes; auditoría de configuración; paginación; grilla por consultorio; `GET /api/profesionales` y ABM de profesionales; exponer `PrestacionSugerida` por API (queda intacta); unicidad de nombres; tope superior de duración.

## Decisions

### D1 — Paquetes: entidades quedan donde están
- Entidades y repositorios siguen en `ar.global.odonto.agenda` (moverlos tocaría C-02, `DomainFixtures`, `RegistroService` y tests de aislamiento sin beneficio funcional).
- Nuevos subpaquetes `agenda/sillon`, `agenda/prestacion`, `agenda/horario`, `agenda/bloqueo`, cada uno con `XController`, `XService`, `XRequest`/`XResponse` (records) y `XMapper` (estático: `toResponse(entity)`, `apply(request, entity)`). Reglas puras: `agenda/config/GrillaAgenda`, `agenda/sillon/LimiteSillones`, `agenda/horario/SolapamientoHorario`.
- Tests: unitarios junto a su subpaquete; ITs HTTP por recurso en `src/test/.../agenda/{sillon,prestacion,horario,bloqueo}/`; transversales (RBAC, aislamiento A/B, concurrencia) en `src/test/.../agenda/config/` (zona de `CHANGES.md`).

### D2 — Sin migración nueva
V1 alcanza. Límite de sillones, grilla y no-solapamiento no son expresables de forma portable H2 `MODE=MySQL` ↔ MySQL 8 (triggers o exclusion constraints) → servicio. Los `CHECK` de V1 quedan como red de seguridad. Regla 6 intacta.

### D3 — Grilla: único punto de configuración, valor provisional
- `GrillaAgenda.MINUTOS = 15` es **el único lugar** donde vive la grilla. Todas las validaciones (duración de prestación, alineación de horarios) y C-07 la leen de ahí; ningún otro código ni test de producción repite el literal 15 (los tests de integración la referencian como `GrillaAgenda.MINUTOS` o la documentan como el valor vigente).
- **Estado: supuesto SU-03, pendiente de validación con un odontólogo (PA-03, prioridad Alta). No es una decisión funcional aprobada.**
- Cómo cambia: editar la constante (un cambio de una línea + ajustar los casos de test que usen valores concretos). Si PA-03 pide grilla por consultorio o por entorno, se mueve a `AppProperties` (`app.agenda.grilla-minutos`) o a una columna de `consultorio` (migración nueva) sin cambiar la API.
- Chequeos puros: `esDuracionValida(int minutos)` = `minutos > 0 && minutos % MINUTOS == 0`; `alineada(LocalTime)` = minutos del día múltiplo de `MINUTOS`, segundos y nanos en 0.
- **Sin tope superior de duración**: V1 solo tiene `CHECK (duracion_minutos > 0)` sobre `INT` y KB 04/05 no fijan máximo; el rango de `int` de Java/`INT` de MySQL cubre cualquier valor razonable. Se valida `@NotNull` + `@Positive` + múltiplo de grilla.
- **Alineación de horarios a la grilla**: se aplica ahora, pero queda **condicionada a la validación de la grilla en PA-03**; si PA-03 la descarta, se quita el chequeo `alineada` sin tocar el resto.

### D4 — Validación en dos capas, mismo formato de error
- Bean Validation en los `Request` (forma): `@NotBlank`, `@Size`, `@MaxUtf8Bytes(255)` en `motivo`, `@NotNull`, `@Min(1) @Max(7)` en `diaSemana`, `@Positive` + anotación propia `@DuracionEnGrilla` (validator puro sobre `GrillaAgenda`) en `duracionMinutos`.
- Reglas entre campos (servicio): `horaDesde < horaHasta`, horas alineadas, `fin > inicio` → `ValidacionException(campo, mensaje)` → `400` con el mismo `errores[{campo, mensaje}]`.

### D5 — Errores y códigos HTTP
Excepciones nuevas en `common/web` (reutilizables por C-05+), mapeadas en `ApiExceptionHandler` con títulos genéricos y sin eco de valores:

| Excepción | HTTP | Uso |
|---|---|---|
| `RecursoNoEncontradoException` | 404 | id de ruta inexistente **o de otro consultorio** |
| `ConflictoException(titulo)` | 409 | límite de sillones, último sillón activo, franja solapada |
| `ReferenciaInvalidaException(campo)` | 422 | `sillonId`/`profesionalId` inexistente, ajeno o inválido; profesional por defecto ausente o ambiguo |
| `ValidacionException(campo, msg)` | 400 | reglas entre campos (D4) |

### D6 — Endpoints y permisos

| Recurso | GET lista / GET id | POST | PUT id | DELETE id |
|---|---|---|---|---|
| `/api/sillones` (`?incluirInactivos`) | OPERACION | GESTION | GESTION (`nombre`, `activo`) | GESTION (baja lógica, 204) |
| `/api/prestaciones` (`?incluirInactivas`) | OPERACION | GESTION | GESTION (`nombre`, `duracionMinutos`, `activo`) | GESTION (baja lógica, 204) |
| `/api/horarios-atencion` (`?profesionalId`) | OPERACION | GESTION | GESTION | GESTION (borrado físico, 204) |
| `/api/bloqueos` (`?desde&hasta&sillonId&profesionalId`) | OPERACION | OPERACION | OPERACION | GESTION (borrado físico, 204) |

- `@PreAuthorize` con las constantes de `Permisos`; sin expresiones nuevas. `POST` → `201` + `Location`; `PUT` → `200` (reemplazo completo).
- Baja lógica en sillón y prestación (C-07 los referenciará desde `turno`); borrado físico en horario y bloqueo (C-02 design: configuración sin valor histórico).
- Orden: sillones/prestaciones por `nombre`; horarios por `diaSemana, horaDesde`; bloqueos por `inicio`. Filtro de bloqueos por intersección `inicio < hasta AND fin > desde` (extremos opcionales), JPQL sin SQL nativo.

**Decisión RBAC sobre bloqueos (contradicción documentada).** `CHANGES.md` §C-04 (línea 194, commit `1238d0e`) dice "RECEPCION solo lectura en config". KB 03 línea 26 (mismo commit `1238d0e`) da a RECEPCION CRU sobre bloqueos; el spec vigente `access-control` (línea 21, commit `f360c74`, C-03, posterior) los clasifica como operativos que MUST admitir RECEPCION, y `Permisos.OPERACION`/handoff `entrega/C-03.md` lo reflejan. No hay acuerdo posterior que lo contradiga (KB 09, KB 10, handoffs C-01..C-03, designs archivados, engram). **Decisión de la persona (2026-11-23):** RECEPCION lee, crea y edita bloqueos; no los borra. **Fuente de verdad:** KB 03 + spec `access-control`. La redacción de `CHANGES.md` queda por conciliar más adelante (no se edita en este change).

### D7 — Concurrencia: lock del consultorio en toda escritura con invariante entre filas
Invariantes entre filas y operaciones que los tocan:

| Invariante | Operaciones con lock |
|---|---|
| ≤ 2 sillones activos | `POST /api/sillones`; `PUT` que pase `activo` de falso a verdadero |
| ≥ 1 sillón activo | `DELETE /api/sillones/{id}`; `PUT` que pase `activo` de verdadero a falso |
| Franjas sin solapamiento (mismo profesional y día) | `POST /api/horarios-atencion`; `PUT` (cualquier cambio de día, horas o profesional) |

Prestaciones y bloqueos no tienen invariantes entre filas (bloqueos solapados se permiten) → sin lock.

Mecanismo, dentro de **un único método `@Transactional`** por escritura:
1. **Primera sentencia de la transacción**: `ConsultorioRepository.lockById(TenantContext.require())` con `@Lock(LockModeType.PESSIMISTIC_WRITE)` sobre JPQL `select c from Consultorio c where c.id = :id` → `SELECT … FOR UPDATE` sobre la fila de `consultorio`. Soportado por H2 (MVStore, también en `MODE=MySQL`) y por MySQL 8/InnoDB (lock de fila).
2. Leer el recurso por id (si es edición), contar/buscar filas relacionadas, aplicar la regla pura (`LimiteSillones`, `SolapamientoHorario`).
3. Escribir y confirmar; el lock se libera al commit/rollback.

Por qué así:
- **Un solo lock y siempre el primero** → orden de adquisición fijo, sin deadlocks entre escrituras de configuración.
- **Primera lectura de la transacción** → con `REPEATABLE READ` (default de MySQL) el snapshot de las lecturas no bloqueantes se toma en la primera lectura consistente, que ocurre después de obtener el lock, así ve lo confirmado por la transacción anterior. H2 usa `READ COMMITTED` por defecto; también correcto.
- Alternativa descartada: lock por fila de `sillon`/`profesional` (DD-06 de C-07): para contar sillones no hay una fila única que bloquear; el lock del consultorio cubre ambos casos con un mecanismo. Volumen bajo, la serialización por consultorio es despreciable.
- Test: `AgendaConfigConcurrencyIT` lanza dos altas simultáneas (dos hilos, `CountDownLatch`, sin `@Transactional` en el test) y espera exactamente un éxito y un `409`, para sillones y para franjas.

### D8 — Franjas de atención y profesional
- `SolapamientoHorario.seSolapan(desdeA, hastaA, desdeB, hastaB)` = `desdeA < hastaB && desdeB < hastaA` (adyacencia no solapa). El servicio busca `findByProfesionalIdAndDiaSemana(profesionalId, dia)` con los valores **nuevos**, excluye la propia franja al editar y lanza `409`.
- Resolución de profesional (alta y edición), solo con `ProfesionalRepository` existente:

| `profesionalId` | Activos en el consultorio | Resultado |
|---|---|---|
| omitido | 0 | `422` |
| omitido | 1 | se usa ese profesional |
| omitido | > 1 | `422` (debe indicarse) |
| indicado | cualquiera | debe existir en el tenant y estar activo; si no, `422` |

- `diaSemana` ISO-8601 (`DayOfWeek.getValue()`, lunes = 1). Horas = hora local del consultorio (`zona_horaria`), `LocalTime` `HH:mm`.

### D9 — Bloqueos
- `inicio`/`fin` `Instant` UTC ISO-8601. Ámbito opcional: `sillonId` y `profesionalId`; ambos nulos = todo el consultorio. Contrato para C-07: aplica a un turno si se interseca en tiempo y (`sillonId` nulo o igual) y (`profesionalId` nulo o igual).
- `profesionalId` omitido **nunca se completa por defecto** (con 0, 1 o > 1 activos): significa "sin ámbito de profesional". Indicado: debe existir en el tenant (activo o inactivo, para poder bloquear a un profesional dado de baja temporalmente); si no, `422`. Mismo criterio para `sillonId` (se permite un sillón inactivo, p. ej. en reparación).
- `motivo` no se loguea (regla 5).

### D10 — Aislamiento
Sin filtro manual: repositorios dentro del tenant del token. Búsquedas por id → `findById(...).orElseThrow(RecursoNoEncontradoException::new)` (id de B desde A = `404`); referencias del cuerpo → `422`; FK compuestas de V1 como segunda barrera. IT A/B por recurso.

### D11 — Mapeo y carga perezosa
Con `open-in-view: false`, el mapeo a DTO ocurre dentro del `@Transactional` del servicio (que devuelve `XResponse`). De `horario.profesional` y `bloqueo.sillon/profesional` solo se lee el id. Logs solo con ids.

## Risks / Trade-offs

- [Grilla de 15 min y duraciones sin validar con un odontólogo (PA-03)] → valor provisional en un único punto (D3); la alineación de horarios depende de esa validación.
- [Sin tope de duración: una prestación muy larga es aceptada] → no hay base funcional ni de esquema para un máximo; C-07 igual valida contra horario de atención.
- [Prestación/sillón dados de baja con turnos futuros] → no se bloquea la baja; C-07 rechaza turnos nuevos sobre inactivos. Se documenta en el handoff.
- [Bloqueo sobre turnos ya agendados] → C-04 no lo detecta; C-07/C-13 decidirán.
- [Lock pesimista: timeout bajo contención] → H2 y MySQL esperan el lock (timeouts por defecto amplios para dos requests); el test de concurrencia lo cubre en H2. Verificación manual opcional en MySQL.
- [`CHANGES.md` §C-04 contradice la matriz aplicada] → documentado (D6); conciliar la redacción más adelante.

## Migration Plan

Sin migraciones ni configuración nueva. Despliegue: merge del PR. Rollback: revertir el PR.

## Open Questions

- PA-03 (Alta, KB 10): validar con un odontólogo la grilla (15 min provisional) y las duraciones; según el resultado, cambia el valor de `GrillaAgenda.MINUTOS` y se confirma o retira la alineación de horarios.
- Conciliar la redacción de `CHANGES.md` §C-04 ("RECEPCION solo lectura en config") con KB 03 / `access-control` (fuera de este change).
