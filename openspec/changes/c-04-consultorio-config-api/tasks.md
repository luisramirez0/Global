# Tasks

> Strict TDD: cada tarea arranca con un test que falla (RED), luego el mínimo código para pasarlo (GREEN), al menos un segundo caso (TRIANGULATE) y refactor con tests verdes. Antes de tocar archivos existentes, correr `cd backend && ./gradlew test` y registrar la línea base (C-03: 264/264). Dominio puro sin Spring; integración contra H2 `MODE=MySQL` con las migraciones reales (regla 8), `@SpringBootTest` + `@AutoConfigureMockMvc`, cuentas vía `AuthFlows`/`TestTokens` y datos vía `TenantFixtures`/`DomainFixtures`. Sin migraciones nuevas (design D2). La grilla de 15 min es **provisional (PA-03 pendiente)**: los tests la toman de `GrillaAgenda.MINUTOS` o documentan que usan el valor vigente. Governance BAJO.

## 1. Línea base y errores comunes

- [x] 1.1 Correr `./gradlew test` y anotar la línea base (esperado 264/264). Verificar: suite verde antes de cualquier cambio; si algo falla, reportar como falla preexistente y no seguir.
- [x] 1.2 RED: extender `ApiExceptionHandlerTest` (MockMvc standalone con controlador de prueba): `RecursoNoEncontradoException` → `404`; `ConflictoException` → `409`; `ReferenciaInvalidaException("sillonId")` → `422`; `ValidacionException("horaHasta", ...)` → `400` con `errores[{campo: "horaHasta"}]` igual al formato de Bean Validation; ningún cuerpo contiene el id ni valores enviados ni trazas. GREEN: excepciones en `common/web` y handlers (design D5). Verificar: test verde y casos previos intactos.

## 2. Reglas de dominio puras (sin Spring)

- [x] 2.1 RED: `GrillaAgendaTest`: `MINUTOS` es el único valor de grilla (15 provisional, PA-03); `esDuracionValida` acepta `MINUTOS`, `2*MINUTOS` y `40*MINUTOS` (600, sin tope) y rechaza 0, `-MINUTOS` y `MINUTOS+5`; `alineada` acepta 09:00 y 09:45 y rechaza 09:10 y 09:00:30. GREEN: `agenda/config/GrillaAgenda` (design D3). Verificar: test verde.
- [x] 2.2 RED: `DuracionEnGrillaValidatorTest` (Jakarta Validation sin Spring): un DTO con 20 produce violación en `duracionMinutos`; con 45 no; con `null` no (lo cubre `@NotNull`). GREEN: `@DuracionEnGrilla` + validator sobre `GrillaAgenda`. Verificar: test verde.
- [x] 2.3 RED: `LimiteSillonesTest`: `permiteActivar(0|1)` verdadero, `permiteActivar(2)` falso; `permiteDesactivar(1)` falso, `permiteDesactivar(2)` verdadero. GREEN: `agenda/sillon/LimiteSillones`. Verificar: test verde.
- [x] 2.4 RED: `SolapamientoHorarioTest`: 09–13 vs 12–15 solapa; 09–13 vs 13–17 no (adyacente); 09–13 vs 10–11 (contenida) solapa; 09–13 vs 08–09 no. GREEN: `agenda/horario/SolapamientoHorario` (design D8). Verificar: test verde.

## 3. Sillones

- [x] 3.1 RED: `ConsultorioLockTest` (`@PersistenceTest`): `ConsultorioRepository.lockById` devuelve el consultorio en curso dentro de una transacción sin error en H2 `MODE=MySQL`; `SillonRepository.countByActivoTrue()` y `findAllByActivoTrueOrderByNombre()` cuentan/listan solo activos del tenant A con datos en A y B. GREEN: `@Lock(PESSIMISTIC_WRITE)` + JPQL y métodos de repositorio (design D7). Verificar: test verde.
- [x] 3.2 RED: `SillonControllerIT`: `POST` válido → `201` + `Location`, `activo=true`, sin `consultorioId`; nombre en blanco → `400` campo `nombre`; con 2 activos, otro `POST` → `409` y siguen 2; con 1 activo + 1 inactivo, `POST` → `201`; `DELETE` con 2 activos → `204`, queda `activo=false`, sale del listado por defecto y aparece con `?incluirInactivos=true`; `DELETE` del último activo → `409`; `PUT` con `activo=false` sobre el último activo → `409` y sigue activo; `PUT` reactivando con 2 activos → `409` y sigue inactivo; `PUT` de nombre → `200`; `GET` id inexistente → `404`. GREEN: `agenda/sillon/*`; cada escritura con lock como primera sentencia de su `@Transactional` (design D7). Verificar: test verde.

## 4. Prestaciones

- [x] 4.1 RED: `PrestacionControllerIT`: alta "Consulta" 30 → `201`; 20 → `400` campo `duracionMinutos`; 600 → `201` (sin tope); `PUT` con 0 → `400` y la duración anterior se conserva; `PUT` con 20 → `400`; `PUT` válido → `200`; `DELETE` → `204` con `activo=false` y fuera del listado por defecto. GREEN: `agenda/prestacion/*` + métodos de repositorio de listado. Verificar: test verde.

## 5. Horarios de atención

- [x] 5.1 RED: `HorarioServiceTest` (`@PersistenceTest` + servicio), resolución de profesional (design D8): omitido con 0 activos → `ReferenciaInvalidaException`; omitido con 1 activo → usa ese; omitido con 2 activos → `ReferenciaInvalidaException`; indicado con 2 activos → usa el indicado; indicado inactivo → `ReferenciaInvalidaException`; indicado de B desde A → `ReferenciaInvalidaException`; mismos casos al editar. GREEN: `agenda/horario/HorarioService` (resolución con `ProfesionalRepository.findByActivoTrue()` y `findById`). Verificar: test verde.
- [x] 5.2 RED: `HorarioServiceTest` (solapamiento): alta solapada mismo día → `ConflictoException`; adyacente u otro día → ok; editar la franja del martes a lunes 11–14 sobre lunes 09–13 → `ConflictoException` y la franja del martes no cambia; editar cambiando de profesional hacia uno con franja solapada → `ConflictoException`; editar una franja sobre sí misma ampliándola → ok. GREEN: `findByProfesionalIdAndDiaSemana` con valores nuevos, exclusión de la propia franja, lock como primera sentencia en alta y edición (design D7, D8). Verificar: test verde.
- [x] 5.3 RED: `HorarioControllerIT`: alta lunes 09:00–13:00 → `201` con `profesionalId` y horas `HH:mm`; 13:00–09:00 → `400` campo `horaHasta`; 09:10–12:00 → `400` campo `horaDesde` (alineación a la grilla, condicionada a PA-03); `diaSemana` 8 → `400`; solapada → `409`; `PUT` hacia solapamiento → `409`; `?profesionalId` filtra; `DELETE` → `204` y desaparece del listado; `GET` id inexistente → `404`. GREEN: `HorarioController`, DTOs, mapper. Verificar: test verde.

## 6. Bloqueos

- [x] 6.1 RED: `BloqueoControllerIT`: por sillón → `201` con `sillonId` y `profesionalId` nulo; por profesional → `201`; sin ámbito → `201` con ambos nulos; `profesionalId` omitido con 0, 1 y 2 profesionales activos → `201` con `profesionalId` nulo en los tres casos (nunca se completa por defecto); `profesionalId` inexistente → `422`; profesional inactivo indicado → `201`; `sillonId` inexistente → `422`; `fin == inicio` → `400` campo `fin` (también en `PUT`); `motivo` de 256 bytes → `400`; listado con `desde`/`hasta` devuelve solo los que se intersecan, ordenados por `inicio`, y filtra por `sillonId`/`profesionalId`; `PUT` → `200`; `DELETE` → `204`. GREEN: `agenda/bloqueo/*` con consulta de intersección JPQL en `BloqueoAgendaRepository` (design D9). Verificar: test verde.

## 7. Permisos, aislamiento y concurrencia transversales

- [x] 7.1 RED: `AgendaConfigRbacIT` (`agenda/config/`): con token `RECEPCION`, `GET` de los 4 recursos → `200`; `POST`/`PUT`/`DELETE` de sillones, prestaciones y horarios → `403` sin cambios en la base; `POST` y `PUT` de bloqueos → `201`/`200`; `DELETE` de bloqueo → `403` y el bloqueo sigue; `PROFESIONAL` y `ADMIN` → escritura permitida; sin token → `401`. GREEN: ajustar `@PreAuthorize` si algún caso falla (matriz design D6). Verificar: test verde.
- [x] 7.2 RED: `AgendaConfigTenantIsolationIT` (`agenda/config/`): registrar A y B por la API con datos de cada recurso; con el token de A los listados devuelven solo A; `GET`/`PUT`/`DELETE` por id de un recurso de B → `404` y el recurso de B no cambia; bloqueo u horario de A referenciando sillón/profesional de B → `422`. GREEN: corregir cualquier fuga (design D10). Verificar: test verde.
- [x] 7.3 RED: `AgendaConfigConcurrencyIT` (`agenda/config/`, sin `@Transactional` en el test, dos hilos con `CountDownLatch` sobre los servicios con el tenant fijado en cada hilo): con 1 sillón activo, dos altas simultáneas → exactamente un éxito y un `ConflictoException`, quedan 2 activos; con 2 activos, dos bajas simultáneas → una ok y una `ConflictoException`, queda 1 activo; dos altas simultáneas de franjas solapadas del mismo profesional y día → exactamente una persiste. GREEN: corregir el orden lock → lectura → escritura si falla (design D7). Verificar: test verde y estable en 3 corridas seguidas.

## 8. Verificación y entrega

- [x] 8.1 Verificar: `./gradlew test` completo en verde (línea base + nuevos); `grep` en `src/main/java/ar/global/odonto/agenda` sin logs de `nombre`/`motivo` (regla 5); ninguna entidad JPA en firmas de controladores (regla 1); sin cambios en `db/migration` (regla 6); el literal de grilla solo aparece en `GrillaAgenda`.
- [x] 8.2 Handoff `knowledge-base/entrega/C-04.md` (qué se hizo, cómo se verificó, contrato para C-07: `GrillaAgenda` provisional/PA-03, activos, `diaSemana` ISO, horas locales, ámbito de bloqueos, lock del consultorio, excepciones comunes; endpoints para C-11; contradicción `CHANGES.md` §C-04 vs KB 03 pendiente de conciliar) y marcar `[x]` en `CHANGES.md` con evidencia (solo el estado, sin reescribir el alcance). Verificar: archivos presentes con la evidencia de 8.1.

## Workflow follow-up

- PR único hacia `main` solo con autorización explícita de la persona, plantilla `.github/pull_request_template.md`, Conventional Commits.
- Verificación manual opcional contra MySQL 8 por la persona (`docker compose up` solo si lo pide), incluido el lock pesimista.
- Archivar el change cuando el PR esté mergeado.
