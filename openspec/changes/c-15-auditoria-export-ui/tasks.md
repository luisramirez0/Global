# Tasks

> **Gate de governance CRITICO**: D1–D11 de `design.md` aprobados por la persona (Integrante 3) el 2026-11-24; apply autorizado empezando por el backend (tareas 1–4). Si alguna decisión cambia, actualizar `design.md`, los specs y estas tareas antes de codear.
>
> **Entorno local (esta máquina):** la JVM por defecto no sirve para Gradle 8.14; se corre con `JAVA_HOME="/c/Program Files/Java/jdk-21"` y `JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStoreType=Windows-ROOT"`. No cambia nada del repo.
>
> Strict TDD: RED → GREEN → TRIANGULATE (segundo caso con otros datos) → REFACTOR. Integración contra H2 `MODE=MySQL` con las migraciones reales, sin mockear la base (regla 8). **Regla de C-06 (MySQL 8.4):** nada que audite corre en `@Transactional(readOnly = true)`. **Sin migraciones ni dependencias nuevas.** Zona de riesgo (regla 12): el PR requiere review de integrante-1 o integrante-2. Commit y PR solo con autorización de la persona.

## 1. Backend: consultas de solo lectura

- [x] 1.1 (LÍNEA BASE: 785 tests, 0 fallas, 0 skipped, con JDK 21; incluye C-07 y C-08) Registrar la línea base de `./gradlew test` en esta tarea.
- [x] 1.2 RED: `PacienteExportRepositoryTest` (`@PersistenceTest`): `turnosDe` devuelve los turnos del paciente en orden `inicio asc, id asc`, con prestación y sillón cargados, e incluye cancelados; excluye los de otro paciente. TRIANGULATE: turno de un paciente del tenant B invisible desde A. GREEN: `paciente.export.PacienteExportRepository` (JPQL, `Repository<Paciente, Long>` sin escritura).
- [x] 1.3 RED: `notasDe` en orden `fecha asc, id asc`, con profesional y turno opcional; excluye otro paciente. TRIANGULATE: aislamiento A/B. GREEN.

## 2. Backend: servicio de export

- [x] 2.1 RED (por HTTP, en `PacienteExportIT`): paciente con consentimiento, ficha, dos notas y dos turnos → paquete completo con `exportadoEn` del `Clock` y órdenes de D2; fila `EXPORT` `Paciente` `entidadId = pacienteId` con detalle `{"consentimientos":1,"ficha":true,"notas":2,"turnos":2}`. GREEN: `PacienteExportService` con `TransactionTemplate` + `AuditService.registrar` y DTOs de D2.
- [x] 2.2 TRIANGULATE: paciente sin consentimiento, ficha, notas ni turnos → `ficha` `null`, listas vacías, detalle `{"consentimientos":0,"ficha":false,"notas":0,"turnos":0}`; paciente dado de baja → `activo:false` y fila `EXPORT`.
- [x] 2.3 RED→GREEN: paciente inexistente o de otro consultorio → `404`, sin fila `EXPORT` en ningún consultorio y datos de B intactos.

## 3. Backend: HTTP, RBAC y fail-closed

- [x] 3.1 RED (en `PacienteExportIT`): `200`, `Content-Type` JSON, `Content-Disposition: attachment; filename="paciente-<id>-export.json"`, `Cache-Control: no-store`, cuerpo con las claves de D2 y sin `consultorioId`/`version`. GREEN: `PacienteExportController`.
- [x] 3.2 RED→GREEN (en `PacienteExportSeguridadIT`): `RECEPCION` `403`, sin token `401`, `ADMIN` y `PROFESIONAL` `200`; los rechazos no dejan fila `EXPORT`.
- [x] 3.3 RED→GREEN (en `PacienteExportSeguridadIT`; sin mocks, FK de usuario inexistente): `500` genérico sin apellido, DNI ni texto de la ficha ni de las notas en el cuerpo, sin `Content-Disposition`; sin fila `EXPORT`.
- [x] 3.4 Caracterización de D8 en `PacienteExportAuditoriaIT`: con una fila `FichaClinica` y una `Turno` del mismo `entidadId`, `GET /api/auditoria?entidadId=N` trae ambas y `?entidad=FichaClinica&entidadId=N` solo la de ficha; `?accion=EXPORT&entidad=Paciente&entidadId=<id>` trae la fila del export.

## 4. Backend: arquitectura y logs

- [x] 4.1 RED→GREEN: `PacienteExportArchTest` (reflexión): ningún método ni clase de `paciente.export` lleva `@Transactional(readOnly = true)` ni `@Audited`; el repositorio no expone `save`/`delete`/`flush`; controles negativos con clases de prueba que violan la regla. Además `PacienteExportTransaccionTest` (puro, sin Spring): la transacción programática del export es `REQUIRED` y no `readOnly` (la reflexión no la ve y H2 tampoco).
- [x] 4.2 RED→GREEN (en `PacienteExportSeguridadIT`): la salida de log de un export exitoso y de uno fallido (500) no contiene apellido, DNI ni texto de la ficha.
- [x] 4.3 (811/811, 0 fallas, 0 skipped: línea base 785 + 26 nuevos; mutaciones detectadas: sin auditoría, `readOnly`, sin `join fetch`, orden invertido, log de fallo, RBAC `OPERACION`) `./gradlew test` completo en verde; `git diff main -- backend/src/main/resources/db/migration` vacío; `build.gradle` sin cambios; sin `nativeQuery`.

## 5. Frontend: clientes API

- [x] 5.1 (LÍNEA BASE frontend: 393 tests en 25 archivos; `npm ci` desde el lockfile, sin dependencias nuevas) RED→GREEN (`api/auditoria.test.ts`, 21 tests; tipos en `types.ts`, decodificadores en `decoders.ts`): `api/auditoria.ts` (`createAuditoriaApi(http)`): `listar(filtros)` arma la query (omite vacíos, `entidadId` solo con `entidad`), decodifica `Pagina<AuditLog>` (`detalle` objeto plano o `null`, acción del enum); `exportarPaciente(id)` rechaza ids no enteros positivos sin request y devuelve el JSON como `unknown` validado como objeto.

## 6. Frontend: pantalla `#/auditoria`

- [x] 6.1 RED→GREEN: `pages/auditoria/auditoria.test.ts` (sin `scope` en los `th`: `h()` no lo admite y no se tocó `utils/dom.ts`): render de filas, detalle `clave: valor`, vacío, error con "Reintentar", `400`/`403` con mensajes fijos, paginado, respuestas viejas descartadas, contenido malicioso como texto (sin `innerHTML`).
- [x] 6.2 RED→GREEN (lógica pura en `pages/auditoria/filtros.ts` + `filtros.test.ts`; 31 tests entre 6.1 y 6.2): filtros: id de entidad deshabilitado sin entidad; rango de fechas en hora del consultorio → UTC con `hasta` exclusivo; `RECEPCION` ve sin permiso y no hay request.

## 7. Frontend: componente de export

- [x] 7.1 (16 tests; el RED no se corrió antes del código: se compensó con mutaciones, ver 9.1) RED→GREEN: `components/exportarPaciente.test.ts`: descarga con nombre `paciente-<id>-export.json`, `createObjectURL`/`revokeObjectURL` llamados, botón deshabilitado durante la request, mensajes de `403`/`404`/red, id inválido no pide nada; sin `localStorage` ni `console`.

## 8. Frontend: ruta y menú

- [x] 8.1 RED→GREEN: `NavItem.roles` en `layout.ts` (ítems sin roles visibles para todos); ruta `/auditoria` y ítem "Auditoría" con `['ADMIN','PROFESIONAL']` en `routes.ts`; tests en `layout.test.ts`, `routes.test.ts` y `app.test.ts` (menú por rol, `#/auditoria` sin sesión → login).

## 9. Verificación

- [x] 9.1 (backend 811/811; frontend 469/469 en 29 archivos, +76; lint, typecheck y build limpios; sin `innerHTML`/`localStorage`/`console.`/`any` en el código nuevo; 9 mutaciones del frontend detectadas: sin liberar la URL, nombre sin id, sin guarda de doble envío, contenido mostrado en pantalla, id de entidad siempre habilitado, sin descarte de respuestas viejas, `hasta` inclusivo, menú sin roles, cliente sin guarda de `entidadId`) `./gradlew test`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` en verde; registrar conteos.
- [x] 9.2 (persona, 2026-11-25: export del paciente 2 por API y UI con archivo descargado; `RECEPCION` sin ítem de menú y con el mensaje de sin permiso en `#/auditoria`; ver el handoff para lo no reportado explícitamente) Checklist manual contra MySQL 8.4 (persona): export de un paciente con datos → `200`, archivo descargado y fila `EXPORT` sin "Connection is read-only"; export con `RECEPCION` → `403`; filtros de `GET /api/auditoria` (`desde`/`hasta`, `accion`, `entidad`, `entidadId`, `usuarioId`, pendiente de C-06); UI con `ADMIN` y `RECEPCION`.

## 10. Cierre

- [x] 10.1 Handoff `knowledge-base/entrega/C-15.md` (incluye la corrección del contrato de C-08 y el contrato del componente para C-12); `CHANGES.md` §C-15 `[x]` con evidencia.
- [ ] 10.2 Commit en Conventional Commits y PR con la plantilla, avisando a integrante-1/2 (regla 12) — solo con autorización de la persona.
