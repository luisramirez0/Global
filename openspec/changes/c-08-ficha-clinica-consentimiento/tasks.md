# Tasks

> **Gate de governance ALTO**: D1–D11 y checkpoints 1–2 de `design.md` aprobados por la persona el 2026-11-24 (apply autorizado). Si alguna decisión cambia, actualizar `design.md`, el spec y estas tareas antes de codear.
>
> **Entorno local (esta máquina):** la JVM por defecto es Java 26 (Gradle 8.14 no la soporta) y la ruta del repo tiene "Ñ", que rompe el argfile del classpath del worker de tests (`ClassNotFoundException`). Los tests se corren con JDK 24 desde una copia en ruta ASCII; no cambia nada del repo.
>
> Strict TDD: cada tarea arranca con un test que falla (RED), luego el mínimo código para pasarlo (GREEN), un segundo caso con otros datos (TRIANGULATE) y refactor con tests verdes. Antes de tocar archivos, correr `cd backend && ./gradlew test` y registrar la línea base en la tarea 1.1 (si algo falla, frenar y reportarlo como falla previa). Integración contra H2 `MODE=MySQL` con las migraciones reales, sin mockear la base (regla 8); `@PersistenceTest` + `TenantFixtures` para persistencia; `@SpringBootTest` + `@AutoConfigureMockMvc` con `TestTokens`/`AuthFlows` para HTTP. Orden: dominio puro → persistencia → servicios/HTTP.
>
> **Regla de C-06 (MySQL 8.4):** ningún método `@Audited` lleva `@Transactional(readOnly = true)`. **Cada endpoint auditado tiene un test que afirma su fila en `audit_log`** con acción, entidad y `entidadId = pacienteId` (design D8).
>
> **Sin migraciones** (design D16). Zona de riesgo (regla 12): datos de salud, consentimiento, auditoría y `ApiExceptionHandler`. El PR **requiere review de integrante-1 o integrante-2**.

## 1. Preparación y reglas puras

- [x] 1.1 (LÍNEA BASE: 545 tests, 0 fallas, 0 skipped, con JDK 24 desde copia ASCII) Registrar la línea base de `./gradlew test` (conteo en verde; esperado 545) en esta tarea.
- [x] 1.2 RED: `ReglasFichaTest` (JUnit puro): sin ficha + `version` `null` → crear; ficha versión 3 + `version` 3 → actualizar. TRIANGULATE: sin ficha + `version` 0, ficha + `version` `null`, ficha versión 3 + `version` 2 → conflicto. GREEN: `paciente.ficha.ReglasFicha` (design D6).
- [x] 1.3 (en `FichaErroresHandlerTest`, MockMvc standalone) RED: `ApiExceptionHandler` (test MockMvc con un probe controller en `src/test`): una `ConflictoException` con código `CONSENTIMIENTO_REQUERIDO` → `409` con propiedad `codigo`; sin código → `409` sin `codigo` (comportamiento actual intacto); `ObjectOptimisticLockingFailureException` → `409` genérico; `ProfesionalNoVinculadoException` → `422` con `codigo`. GREEN: `codigo` opcional en `ConflictoException`, excepciones de design D12 y handlers. Verificar que los tests existentes de errores siguen verdes.

## 2. Persistencia

- [x] 2.1 RED: `ConsentimientoDatosRepositoryTest` (`@PersistenceTest`): `existsByPacienteId` `false` sin filas y `true` con una; `findByPacienteIdOrderByAceptadoEnDescIdDesc` ordena del más reciente al más antiguo. TRIANGULATE: consentimiento del paciente en el tenant B invisible desde A. GREEN: consultas en `ConsentimientoDatosRepository`.
- [x] 2.2 RED: `ConsentimientoTextoRepositoryTest`: el texto vigente es `v1`; con una versión de prueba de `vigente_desde` futuro insertada en el test, sigue siendo `v1`; con una de `vigente_desde` pasado y posterior a `v1`, es esa. GREEN: consulta JPQL portable del vigente (sin SQL nativo).
- [x] 2.3 RED: `NotaClinicaRepositoryTest`: `findByPacienteId` paginado y ordenado `fecha desc, id desc`; notas de otro paciente excluidas. TRIANGULATE: aislamiento A/B. GREEN.
- [x] 2.4 RED: `ProfesionalVinculadoRepositoryTest`: `findByUsuarioIdAndActivoTrue` devuelve el profesional vinculado; profesional inactivo excluido. TRIANGULATE: usuario de B no trae profesionales desde A. GREEN: `paciente.ficha.ProfesionalVinculadoRepository` (solo lectura; `agenda/ProfesionalRepository` no se toca, design D12).

## 3. Consentimiento

- [x] 3.1 RED: `ConsentimientoControllerIT`: `POST /api/pacientes/{id}/consentimientos` `{versionTexto:"v1"}` como `PROFESIONAL` → `201` con `aceptadoEn` del `Clock` de test y `registradoPorUsuarioId` del token; fila `CREATE` `ConsentimientoDatos` con `entidadId = pacienteId` y detalle `{"consentimientoId":…,"versionTexto":"v1"}`. TRIANGULATE: segundo registro → dos filas en la lista; `versionTexto` inexistente o con vigencia futura → `400` sin eco y sin fila de auditoría; paciente inactivo → `409` `PACIENTE_INACTIVO`. GREEN: `ConsentimientoService.registrar`, DTOs, controller (design D10).
- [x] 3.2 RED→GREEN: `GET /api/pacientes/{id}/consentimientos` (vacía y con dos, orden desc) y `GET /api/consentimientos/texto-vigente` (`v1` con contenido). Sin filas de auditoría (design D8).

## 4. Ficha clínica

- [x] 4.1 RED: `FichaControllerIT` — sin consentimiento: `GET` y `PUT /ficha` → `409` `CONSENTIMIENTO_REQUERIDO`, sin fila de auditoría, sin ficha creada. TRIANGULATE con dos pacientes. GREEN: `PacienteClinico` (404 / inactivo / consentimiento, design D9).
- [x] 4.2 RED: con consentimiento y sin ficha: `GET` → `200` con campos en `null` y `version: null` + fila `READ` `FichaClinica` (design D5). Con ficha cargada → `200` con sus datos + otra fila `READ`. GREEN: `FichaService.obtener` con `@Audited(accion = READ, entidad = "FichaClinica", entidadId = "#pacienteId")`, sin `@Transactional`.
- [x] 4.3 RED: `PUT` con `version: null` → crea y responde `version` 0 + fila `CREATE` con `{"fichaId":…,"version":0}`; `PUT` con `version` 0 → actualiza (reemplazo completo, un campo pasa a `null`) + fila `UPDATE`. TRIANGULATE conflictos → `409` `FICHA_DESACTUALIZADA` sin cambios ni fila: `version` vieja, `null` con ficha existente, número sin ficha. GREEN: `FichaService.guardar` con `TransactionTemplate` + `AuditService.registrar` (design D6, D13).
- [x] 4.4 RED: carreras (`FichaConcurrenciaIT`, dos hilos con `CountDownLatch`): dos `PUT` con la misma `version` → uno `200` y otro `409`; dos altas simultáneas → una crea y la otra `409`; en ambos casos una sola fila de auditoría de escritura. GREEN: traducción de `ObjectOptimisticLockingFailureException` y de la violación de `uq_ficha_clinica_paciente` fuera de la transacción.
- [x] 4.5 RED: validación → `400` sin eco: campo de 4001 caracteres, campo con 4000 (válido, frontera). Paciente inactivo: `GET` `200`, `PUT` `409` `PACIENTE_INACTIVO`. GREEN.

## 5. Notas clínicas

- [x] 5.1 RED: `NotaControllerIT`: `POST /notas` como `PROFESIONAL` vinculado → `201` con `profesionalId` del vinculado y `fecha` del `Clock`; fila `CREATE` `NotaClinica` con `entidadId = pacienteId` y `{"notaId":…}`. TRIANGULATE: con `turnoId` válido → detalle con `turnoId`; `turnoId` de otro consultorio o inexistente → `422`. GREEN: `NotaService.crear` (design D7).
- [x] 5.2 RED: `ADMIN` sin profesional vinculado → `422` `PROFESIONAL_NO_VINCULADO`; profesional vinculado inactivo → mismo `422`. Sin consentimiento → `409`; paciente inactivo → `409` `PACIENTE_INACTIVO`; texto vacío o de 10001 caracteres → `400` sin eco. Ninguno deja fila de auditoría. GREEN.
- [x] 5.3 RED: `GET /notas` → `Pagina` ordenada desc, `size=1000` → 100, + fila `READ` `NotaClinica`; sin consentimiento → `409`. GREEN: `NotaService.listar` con `@Audited`, sin `@Transactional`.
- [x] 5.4 RED→GREEN: notas inmutables (design D2): `PUT` y `DELETE` sobre `/api/pacientes/{id}/notas/{notaId}` → `405` o `404` (sin ruta), y la nota no cambia.

## 6. Seguridad, aislamiento y fail-closed

- [x] 6.1 RED→GREEN: `FichaRbacIT`: los siete endpoints con `RECEPCION` → `403`, sin token → `401`, `ADMIN` y `PROFESIONAL` → acceso; ningún `403` deja fila de auditoría.
- [x] 6.2 RED→GREEN: `FichaTenantIsolationIT`: con el token de A, todos los endpoints sobre un paciente de B → `404` y sin filas de auditoría; los datos de B siguen intactos al consultarlos con el token de B.
- [x] 6.3 RED→GREEN: `FichaFailClosedIT` (sin mocks): token con `usuarioId` inexistente en el tenant → `GET /ficha` y `GET /notas` `500` y el cuerpo no contiene el texto clínico sembrado; `PUT /ficha` (primera carga y actualización) `500` y no queda nada guardado, y la actualización no se confunde con un `409`. `POST /notas` no se puede forzar así sin mocks: con un usuario inexistente no hay profesional vinculado y responde `422` antes de auditar; su fail-closed queda garantizado por `AuditService` (`MANDATORY`) dentro de la misma `@Transactional`.
- [x] 6.4 RED→GREEN: `AuditedSinReadOnlyTest` (reflexión sobre `ar.global.odonto.paciente.ficha`): ningún método `@Audited` tiene `@Transactional(readOnly = true)` en el método ni en su clase. Probar el test con una clase de prueba que sí lo tiene (debe fallar sobre ella).
- [x] 6.5 RED→GREEN: logs sin datos de salud (`OutputCaptureExtension`): en los flujos de 4.x y 5.x, incluidos los errores, la salida no contiene los textos clínicos, nombre ni DNI sembrados.

## 7. Verificación y cierre

- [x] 7.1 (623/623 en verde; JaCoCo `paciente.ficha` 99 % instrucciones / 97 % ramas; sin migraciones ni dependencias nuevas; `readOnly` solo en `ConsentimientoService.listar`/`textoVigente`, no auditados) Verificar: `./gradlew test` completo en verde (línea base de 1.1 + nuevos); JaCoCo de `paciente.ficha`; `git diff main -- backend/src/main/resources/db/migration` vacío; sin dependencias nuevas; `grep` de `@Transactional(readOnly` en `paciente/ficha` solo en métodos no auditados.
- [x] 7.2 Handoff `knowledge-base/entrega/C-08.md`: qué se hizo, cómo se verificó, contrato para C-12 (design D15) y C-15 (design D8), supuestos PA-07/PA-08, pendientes de MySQL.
- [x] 7.3 Anotar en `knowledge-base/10_preguntas_abiertas.md` los supuestos aplicados de PA-07 (RECEPCION sin acceso) y PA-08 (notas inmutables, corrección = nota nueva).
- [x] 7.4 Marcar `[x]` la ficha C-08 en `CHANGES.md` con evidencia, sin tocar el resto del archivo.

## Workflow follow-up

- Verificación manual contra MySQL 8.4 a cargo de la persona (regla 9): `GET /ficha` y `GET /notas` (lectura auditada, riesgo read-only heredado de C-06), `PUT /ficha`, `POST /notas` con el profesional del seed y `POST /consentimientos`; revisar las filas en `audit_log`.
- PR único hacia `main` (rama `c-08-ficha-clinica-consentimiento`) solo con autorización explícita, plantilla `.github/pull_request_template.md`, Conventional Commits y Co-Authored-By vigente; **review obligatoria de integrante-1 o integrante-2** (zona de riesgo). Mencionar el cambio en `ApiExceptionHandler` y que `agenda/` no se modifica.
- Archivar el change cuando el PR esté mergeado.
