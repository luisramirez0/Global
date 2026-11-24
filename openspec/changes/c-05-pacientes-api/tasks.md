# Tasks

> Strict TDD: cada tarea arranca con un test que falla (RED), luego el mínimo código para pasarlo (GREEN), un segundo caso (TRIANGULATE) y refactor con tests verdes. Antes de tocar archivos, correr `cd backend && ./gradlew test` y registrar la línea base (C-03: 264/264). Tests de integración contra H2 `MODE=MySQL` con las migraciones reales (regla 8); `MockMvc` con `@SpringBootTest` + `@AutoConfigureMockMvc`, tokens con `AuthFlows`/`TestTokens`. Los normalizadores son tests unitarios puros, sin Spring.
>
> **Sin migraciones**: no se crea ni se edita nada en `db/migration` (V1/V2 de `main` cerradas). Si una tarea parece necesitar un cambio de esquema, se frena y se consulta.
>
> Governance MEDIO: se puede empezar tras la aprobación de la persona sobre `design.md` y sus Open Questions (formato de DNI, teléfono opcional). `ApiExceptionHandler` es zona de revisión de C-03: avisar a integrante-1/2 en el PR (regla 12).
>
> Aprobación del diseño: la persona, 2026-11-23 (supuestos por defecto aceptados: DNI 7–8 dígitos, teléfono opcional sin autocompletar `+54 9`, la baja no afecta turnos).

## 1. Normalizadores (dominio puro)

- [x] 1.1 (línea base 264/264; JDK 24 + truststore Windows-ROOT, desde copia en ruta ASCII, ver handoff) RED: `DniTest`: `30.111.222`, `30 111 222`, `30-111-222` → `30111222`; `1234567` (7) válido; `123456` (6), `123456789` (9), `12AB`, vacío y `null` → `DatoInvalidoException` con campo `dni` y mensaje sin el valor. GREEN: `paciente.abm.Dni`, `paciente.abm.DatoInvalidoException`.
- [x] 1.2 RED: `TelefonoE164Test`: `+54 9 11 2345-6789` y `+54 (9) 11 2345.6789` → `+5491123456789`; `+12025550123` válido; `null`, `""` y `"  "` → `null`; `011 15 2345 6789` (sin `+`), `+0…`, `+1234567` (7 dígitos), 16 dígitos y letras → `DatoInvalidoException` con campo `telefono`. GREEN: `paciente.abm.TelefonoE164`.

## 2. Contratos comunes y errores

- [x] 2.1 (el 400 por defecto repetía el valor también en `instance`; se usa el patrón de la ruta) RED: extender `ApiExceptionHandlerTest` (controlador de prueba, standalone MockMvc como en C-03): `RecursoNoEncontradoException` → `404` `ProblemDetail` genérico; `DatoInvalidoException("dni")` → `400` con `errores[{campo: dni}]`; `DniDuplicadoException(7)` → `409` con `pacienteId: 7`; `@PathVariable Long` con `abc` → `400` sin `abc` en el cuerpo; JSON con fecha inválida → `400` sin el valor. GREEN: `common.web.RecursoNoEncontradoException`, `paciente.abm.DniDuplicadoException` y handlers (métodos nuevos al final de `ApiExceptionHandler`, sobrescribiendo `handleTypeMismatch` si hace eco del valor). Coordinar con Integrante 4/3 si ya existe una excepción 404 común.
- [x] 2.2 RED: `PaginaTest` (unitario): construcción desde un `Page` de Spring Data con contenido mapeado, número, tamaño, total de elementos y de páginas. GREEN: `common.web.Pagina<T>`.

## 3. Repositorio y servicio

- [x] 3.1 (escape `!` en lugar de `\`, portable a MySQL; patrones en `paciente.abm.CriterioBusqueda` + `CriterioBusquedaTest`) RED: extender `PacienteRepositoryTest` (`@PersistenceTest`): `buscar` por apellido parcial sin distinguir mayúsculas, por `nombre apellido` y `apellido nombre`, por prefijo de DNI; `%` y `_` en `q` se tratan como literales; inactivos excluidos salvo `incluirInactivos`; orden `apellido, nombre, id`; con tenant A nunca devuelve pacientes de B aunque `q` sea el DNI de un paciente de B. Sin depender de acentos (diferencia H2/MySQL, design D5). GREEN: consulta JPQL portable `PacienteRepository.buscar(...)` (sin SQL nativo).
- [x] 3.2 RED: `PacienteServiceTest` (`@PersistenceTest` + servicio, dentro de `TenantContext.runAs`): alta normaliza DNI/teléfono/email y recorta textos (vacío → `null`), queda activo y con el consultorio del tenant; DNI duplicado (otro formato, y de un paciente inactivo) → `DniDuplicadoException` con el id existente y sin crear filas; mismo DNI en otro consultorio → OK; edición reemplaza campos, no cambia `activo`, acepta el propio DNI y rechaza el de otro paciente; `obtener` de un id de otro consultorio o inexistente → `RecursoNoEncontradoException`; baja → `activo=false`, idempotente, la fila sigue existiendo; reactivar → `activo=true`, idempotente. GREEN: `paciente.abm.PacienteService`, `PacienteRequest`, `PacienteResponse`, `PacienteMapper`.
- [x] 3.3 (`PacienteServiceConcurrencyTest`, 5 rondas con `CyclicBarrier`; el log de la rama de la UNIQUE aparece en las 5: la traducción está ejercitada) RED: dos hilos dan de alta el mismo DNI en el consultorio A a la vez → uno OK y otro `DniDuplicadoException`; queda una sola fila. GREEN: captura de `DataIntegrityViolationException` + re-búsqueda por DNI (design D4).
- [x] 3.4 `@PreAuthorize` en los métodos del servicio: `OPERACION` en alta/obtener/buscar/editar, `GESTION` en baja/reactivar (los tests de rol van en 4.2).

## 4. API REST

- [x] 4.1 RED: `PacienteControllerIT`: `POST` → `201` + `Location` + cuerpo normalizado; `400` por apellido ausente, DNI `12AB`, teléfono sin `+` y email inválido (nombra el campo, sin el valor); `409` con `pacienteId`; `GET` lista paginada con `q` (apellido, `ana pér`, `30.111`), `incluirInactivos`, `size=500` acotado a 50; `GET /{id}` `200`; `PUT` `200` y `409`; `DELETE` `204` dos veces y el `GET` posterior muestra `activo=false`; `POST /{id}/reactivar` `204`; sin token → `401`. Con `OutputCaptureExtension`: ni las respuestas de error ni los logs contienen el DNI, el teléfono ni el nombre enviados. GREEN: `paciente.abm.PacienteController` (`/api/pacientes`, solo DTOs).
- [x] 4.2 RED: `PacienteRbacIT`: `RECEPCION` → `201`/`200`/`200` en alta/consulta/edición y `403` en `DELETE` y `reactivar` (el paciente no cambia); `ADMIN` y `PROFESIONAL` → éxito en todo. GREEN: ajustar anotaciones si hace falta.
- [x] 4.3 RED→GREEN: `PacienteTenantIsolationIT`: registrar A y B por la API (`AuthFlows`), crear P1 en A y P3 en B; con el token de A: listado (también con `q` = DNI de P3) solo trae pacientes de A; `GET`, `PUT`, `DELETE` y `reactivar` sobre el id de P3 → `404` con el mismo cuerpo que un id inexistente; con el token de B, P3 sigue intacto.

## 5. Verificación y cierre

- [x] 5.1 (342/342; JaCoCo `paciente.abm` 97 % instrucciones / 94 % ramas; logs solo con ids; diff de migraciones vacío) Verificar: `./gradlew test` completo en verde (línea base 264 + nuevos), reporte JaCoCo; `grep` en `src/main/java/ar/global/odonto/paciente` sin logs con datos personales (regla 5); `git diff main -- backend/src/main/resources/db/migration` vacío.
- [x] 5.2 Handoff `knowledge-base/entrega/C-05.md`: qué se hizo, cómo se verificó, contrato para C-07 (rechazar pacientes inactivos), C-08 (`PacienteService.obtener` para validar existencia en el tenant y rutas bajo `/api/pacientes/{id}`), C-09 (`telefono` ya E.164 o `null`) y C-12 (endpoints, `Pagina`, `409` con `pacienteId`, ejemplo de teléfono); diferencia de acentos H2/MySQL; Open Questions resueltas o pendientes. Marcar `[x]` en `CHANGES.md` con evidencia.

## Workflow follow-up

- [x] (2026-11-23, `docker compose up` a pedido de la persona; MySQL 8.4: búsqueda sin acentos OK, `perez`→`Pérez`) Verificación manual contra MySQL 8 a cargo de la persona (`docker compose up` no se ejecuta sin pedido, regla 9): alta, búsqueda con y sin acentos, `409`, baja y reactivación.
- [ ] PR único hacia `main` solo con autorización explícita, plantilla `.github/pull_request_template.md`, Conventional Commits; mencionar a integrante-1/2 por el cambio en `ApiExceptionHandler`.
- [ ] Archivar el change cuando el PR esté mergeado.
