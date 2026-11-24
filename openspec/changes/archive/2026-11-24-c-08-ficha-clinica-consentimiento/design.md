# Design

## Context

- **Esquema (V2, C-02):** `ficha_clinica` (una por paciente, `uq_ficha_clinica_paciente`, columna `version` con `@Version` en la entidad), `nota_clinica` (`profesional_id` NOT NULL, `turno_id` opcional, FK compuestas por consultorio), `consentimiento_datos` (`version_texto` con FK a `consentimiento_texto`, `registrado_por_usuario_id` con FK compuesta a `usuario`) y `consentimiento_texto` (catálogo global, solo lectura, con `v1` cargado). Las entidades y repositorios existen en `paciente/`; los `toString` de `FichaClinica` y `NotaClinica` no imprimen contenido clínico.
- **Auditoría (C-06):** `@Audited(accion, entidad, entidadId)` para detalle fijo; `AuditService.registrar(accion, entidad, entidadId, DetalleAuditoria)` dentro de la transacción cuando el detalle o la acción dependen del caso o cuando hay que traducir errores de integridad fuera de la transacción. Fail-closed: si el registro falla, la operación falla con `500` y se revierte.
- **Restricción de MySQL 8.4 (regla 5 de C-06):** un método `@Audited` de lectura NO puede llevar `@Transactional(readOnly = true)`: el `INSERT` de auditoría comparte la transacción y MySQL lo rechaza en una conexión read-only, mientras H2 no lo detecta.
- **Permisos (C-03):** `Permisos.GESTION` = `ADMIN`/`PROFESIONAL`, ya documentado como excluyente de `RECEPCION` para la ficha (PA-07).
- **Errores:** `ApiExceptionHandler` devuelve `ProblemDetail` sin eco de valores; `ConflictoException` → `409` con título genérico; `ReferenciaInvalidaException` → `422`.
- **Pacientes (C-05):** baja lógica (`activo`), `PacienteService` con el patrón `TransactionTemplate` para traducir errores de integridad.

## Goals / Non-Goals

**Goals**
- Ficha (anamnesis) y notas solo accesibles con consentimiento registrado (RN-DS-03, US-021 CA-1).
- Cada lectura y escritura clínica con su entrada en `audit_log`, identificable por paciente para C-15 (RN-DS-02, US-021 CA-2).
- Solo `ADMIN`/`PROFESIONAL`; aislamiento por consultorio; sin datos de salud en logs ni errores (regla 5).
- Contrato estable para C-12.

**Non-Goals**
- Odontograma, presupuestos, clínica avanzada (RN-PA-04, C-21).
- Revocación de consentimiento; adenda enlazada o edición de notas; plazo de conservación (PA-04, RN-DS-04).
- Exportación de datos del paciente (C-15). Validación del estado del turno de una nota (C-07).
- Migraciones nuevas.

## Decisions

> D1–D11 aprobadas por la persona el 2026-11-24. Las secciones D12–D16 detallan cómo se implementan.

### D1 — Permisos (supuesto PA-07)
Todos los endpoints de C-08 llevan `@PreAuthorize(Permisos.GESTION)` en el servicio. `RECEPCION` → `403`; sin token → `401`. Si PA-07 se resolviera a favor de `RECEPCION`, basta cambiar la expresión: sus lecturas quedarían auditadas igual.

### D2 — Notas que no se editan ni se borran (supuesto PA-08)
No hay `PUT` ni `DELETE` de notas, y el servicio no expone operaciones de modificación. Una corrección es una nota nueva; el texto puede referirse a la anterior, pero sin enlace en el esquema (no hay columna `adenda_de_id`, y agregarla requeriría `V3`). Supuesto a confirmar con el product owner / legal; se anota en KB 10.

### D3 — Qué cuenta como consentimiento
Alcanza con al menos un `consentimiento_datos` del paciente, de cualquier versión. Publicar un texto nuevo no bloquea las fichas existentes. No hay revocación en el MVP. Se pueden registrar varios consentimientos (queda el historial).

### D4 — Paciente sin consentimiento → 409 `CONSENTIMIENTO_REQUERIDO`
Aplica a `GET`/`PUT` de ficha y a `POST`/`GET` de notas. El `ProblemDetail` lleva título genérico y la propiedad `codigo`, sin datos del paciente. Al lanzar, no hay entrada de auditoría (contrato de C-06).

### D5 — Ficha todavía no cargada → 200 vacío
Con consentimiento y sin fila en `ficha_clinica`, `GET` responde `200` con todos los campos clínicos en `null` y `version: null`. La lectura se audita igual (`READ`).

### D6 — PUT de ficha con control de `version`
- Reemplazo completo: los campos ausentes o `null` quedan en `null`.
- El pedido trae la `version` que leyó el cliente: `null` si la ficha no existía.
  - Ficha inexistente + `version: null` → se crea; auditoría `CREATE`.
  - Ficha existente + `version` igual a la guardada → se actualiza; auditoría `UPDATE`.
  - Cualquier otra combinación (`null` con ficha existente, número con ficha inexistente, número distinto) → `409` `FICHA_DESACTUALIZADA`.
- Carreras: dos actualizaciones simultáneas con la misma `version` → el `@Version` de JPA hace fallar la segunda (`ObjectOptimisticLockingFailureException`) → `409` `FICHA_DESACTUALIZADA`. Dos creaciones simultáneas → la segunda viola `uq_ficha_clinica_paciente`; se traduce a `409` `FICHA_DESACTUALIZADA` fuera de la transacción (patrón `TransactionTemplate` de `PacienteService.crear`). Por eso el PUT usa `AuditService.registrar` explícito y no `@Audited` (regla 6 de C-06); además la acción varía entre `CREATE` y `UPDATE`.
- La respuesta es la ficha guardada con su `version` nueva.

### D7 — Autor de la nota
- El autor sale del profesional activo vinculado al usuario del token (`profesional.usuario_id`). El body no lo trae.
- Si no hay exactamente un profesional activo vinculado (p. ej. un `ADMIN` que no atiende) → `422` `PROFESIONAL_NO_VINCULADO`.
- `fecha` = instante del servidor (`Clock`).
- `turnoId` opcional: si viene, tiene que existir en el consultorio en curso; si no, `422` (referencia inválida). No se valida el estado del turno hasta C-07.

### D8 — Auditoría: `entidadId = pacienteId` siempre
Así C-15 obtiene "quién accedió a la historia clínica del paciente X" con `GET /api/auditoria?entidadId=X`. La `entidad` dice qué se tocó:

| Operación | Acción | Entidad | Detalle | Mecanismo |
|---|---|---|---|---|
| `GET /ficha` | `READ` | `FichaClinica` | vacío | `@Audited(entidadId = "#pacienteId")` |
| `PUT /ficha` (alta) | `CREATE` | `FichaClinica` | `{"fichaId":…,"version":…}` | `AuditService.registrar` |
| `PUT /ficha` (cambio) | `UPDATE` | `FichaClinica` | `{"fichaId":…,"version":…}` | `AuditService.registrar` |
| `GET /notas` | `READ` | `NotaClinica` | vacío | `@Audited(entidadId = "#pacienteId")` |
| `POST /notas` | `CREATE` | `NotaClinica` | `{"notaId":…}` (+ `"turnoId":…` si hay) | `AuditService.registrar` |
| `POST /consentimientos` | `CREATE` | `ConsentimientoDatos` | `{"consentimientoId":…,"versionTexto":"v1"}` | `AuditService.registrar` |

- El detalle solo lleva ids y la versión del texto. La versión sale de la fila del catálogo ya validada (no del texto del pedido), cumpliendo la regla de C-06 de que los códigos no vengan de input libre.
- Los `403`, `404`, `409` y `422` no se auditan.
- `GET /consentimientos` y `GET /consentimientos/texto-vigente` no se auditan: no devuelven datos de salud (ver checkpoint 2).
- **Ningún método `@Audited` lleva `@Transactional(readOnly = true)`** (D14 lo verifica con un test).

### D9 — Paciente dado de baja → escrituras 409 `PACIENTE_INACTIVO`
Lectura de ficha y notas permitida (conservación de la HC, RN-PA-03). `PUT /ficha`, `POST /notas` y `POST /consentimientos` → `409` `PACIENTE_INACTIVO`. Orden de chequeos: rol (`403`) → paciente del consultorio (`404`) → inactivo (`409`, solo escrituras) → consentimiento (`409`) → `version` (`409`).

### D10 — Endpoints de soporte para C-12
- `GET /api/pacientes/{id}/consentimientos`: lista de consentimientos del paciente (`id`, `versionTexto`, `aceptadoEn`, `registradoPorUsuarioId`), del más reciente al más antiguo. Sin paginar: son pocos por paciente.
- `GET /api/consentimientos/texto-vigente`: `{version, contenido, vigenteDesde}` del texto con mayor `vigente_desde` que no sea futuro. Catálogo global, sin datos de paciente.
- `POST /api/pacientes/{id}/consentimientos` con body `{versionTexto}`: la versión tiene que existir en el catálogo **y estar en vigencia** (`vigente_desde` no futuro); si no, `400` sin eco. Se acepta cualquier versión en vigencia, no solo la más reciente (checkpoint 1). `aceptadoEn` = instante del servidor; `registradoPor` = usuario del token.
- Estados del catálogo (revisado a pedido de la persona, 2026-11-24): `consentimiento_texto` solo tiene `version`, `contenido` y `vigente_desde`; no hay columna de estado, baja ni fin de vigencia. El único estado no válido es una versión cargada con vigencia futura, que se rechaza como si no existiera. Si más adelante se necesita dar de baja un texto, hace falta una migración (fuera de alcance).

### D11 — Límites, paginación y logs
- Cada campo de texto de la ficha hasta 4000 caracteres; el texto de la nota hasta 10000 y no vacío. Excedido o vacío → `400` sin repetir el valor. Ambos entran en `TEXT` (65535 bytes) aun con 4 bytes por carácter.
- `GET /notas`: `Pagina<NotaResponse>`, `page` 0, `size` 20 (máx. 100; `<1` → 20), orden `fecha desc, id desc`.
- Logs solo con ids, acción y tipo de excepción. Tests capturan la salida y verifican que no aparecen textos clínicos ni datos personales.

### D12 — Paquetes y piezas
En `ar.global.odonto.paciente.ficha`:

| Pieza | Responsabilidad |
|---|---|
| `ReglasFicha` (sin Spring) | Decide crear / actualizar / conflicto según ficha existente y `version` (D6). |
| `PacienteClinico` (componente) | Resuelve el paciente del consultorio (`404`), aplica inactivo (D9) y consentimiento (D3/D4). |
| `FichaService` / `FichaController` / `FichaRequest` / `FichaResponse` / `FichaMapper` | `GET`/`PUT /ficha`. |
| `NotaService` / `NotaController` / `NotaRequest` / `NotaResponse` / `NotaMapper` | `POST`/`GET /notas`. |
| `ConsentimientoService` / `ConsentimientoController` / `ConsentimientoRequest` / `ConsentimientoResponse` / `TextoConsentimientoResponse` | Consentimientos y texto vigente. |
| `ConsentimientoRequeridoException`, `PacienteInactivoException`, `FichaDesactualizadaException` | Extienden `ConflictoException` con `codigo`. |
| `ProfesionalNoVinculadoException` | `422` con `codigo`. |

Además, en el paquete: `ProfesionalVinculadoRepository` (`Repository<Profesional, Long>` de solo lectura con `findByUsuarioIdAndActivoTrue`). Vive en `paciente/ficha/` para **no modificar `agenda/ProfesionalRepository`** (zona de C-04, pedido de la persona); `TurnoRepository` y `UsuarioRepository` solo se usan, no se modifican.

Cambios fuera del paquete:
- `ConflictoException` gana un `codigo` opcional; `ApiExceptionHandler` lo agrega como propiedad `codigo` del `ProblemDetail` y traduce `ObjectOptimisticLockingFailureException` a `409` genérico.
- Repositorios de `paciente/` (zona de C-05/C-08): `ConsentimientoDatosRepository.existsByPacienteId` y `findByPacienteIdOrderByAceptadoEnDescIdDesc`; `NotaClinicaRepository.findByPacienteId(Long, Pageable)`; `ConsentimientoTextoRepository` con la versión en vigencia (JPQL portable). Todos quedan acotados por el filtro de tenant.

### D13 — Transacciones
- Lecturas auditadas (`FichaService.obtener`, `NotaService.listar`): sin `@Transactional`; el aspecto abre una transacción de lectura-escritura.
- Lecturas no auditadas (`ConsentimientoService.listar`, `textoVigente`): `@Transactional(readOnly = true)` permitido, porque no escriben auditoría.
- Escrituras: `FichaService.guardar` con `TransactionTemplate` (traducción de la carrera de alta afuera, D6); `NotaService.crear` y `ConsentimientoService.registrar` con `@Transactional` y `AuditService.registrar` adentro.

### D14 — Estrategia de tests (TDD, regla 8)
- Dominio puro sin Spring: `ReglasFichaTest` (todas las combinaciones de D6).
- Persistencia con `@PersistenceTest` + `TenantFixtures` (H2 `MODE=MySQL`, migraciones reales): consultas nuevas de repositorio y su aislamiento A/B.
- Servicios y HTTP con `@SpringBootTest` + `@AutoConfigureMockMvc`, `TestTokens`/`AuthFlows`: cada endpoint con sus casos felices, `409`/`422`/`400`, RBAC (`RECEPCION` `403`, sin token `401`), aislamiento A/B (`404`) y **la fila esperada en `audit_log`** (regla 1 de C-06).
- Test de reflexión sobre `paciente.ficha`: ningún método con `@Audited` tiene `@Transactional(readOnly = true)`, ni en el método ni en la clase.
- Fail-closed sin mocks: token de un `usuarioId` inexistente en el tenant → la FK de `audit_log` rechaza el `INSERT` → `500` sin el contenido clínico, y la ficha o nota no queda guardada.
- Sin Testcontainers ni SQL nativo.

### D15 — Contrato para C-12
- `FichaResponse`: `{pacienteId, alergias, medicacionActual, antecedentesMedicos, enfermedadesRelevantes, embarazo, motivoConsulta, observaciones, version, actualizadaEn}`.
- `FichaRequest`: los mismos campos clínicos + `version` (`Long`, `null` para la primera carga).
- `NotaRequest`: `{texto, turnoId?}`. `NotaResponse`: `{id, fecha, profesionalId, turnoId, texto}`.
- Errores con `codigo`: `CONSENTIMIENTO_REQUERIDO`, `PACIENTE_INACTIVO`, `FICHA_DESACTUALIZADA` (`409`), `PROFESIONAL_NO_VINCULADO` (`422`).
- Flujo esperado en la UI (Flujo 5): `GET /consentimientos` → si está vacío, mostrar `texto-vigente` y `POST /consentimientos` → `GET /ficha` → `PUT /ficha` con la `version` recibida.

### D16 — Sin migración
`git diff main -- backend/src/main/resources/db/migration` debe quedar vacío. Si alguna tarea parece necesitar esquema, se frena y se consulta.

## Risks / Trade-offs

- **Lectura auditada en MySQL read-only:** H2 no reproduce el error. Mitigación: sin `readOnly` en métodos auditados, test de reflexión (D14) y verificación manual contra MySQL 8.4 de `GET /ficha` y `GET /notas` (pendiente heredado de C-06).
- **Fail-closed:** si `audit_log` no acepta inserts, no se puede leer ni escribir la ficha. Aceptado por RN-DS-02 (igual que C-06).
- **Notas sin adenda enlazada (D2):** si legal pide enlazar correcciones o editar dentro de un plazo, hace falta `V3`. Queda en KB 10 como supuesto de PA-08.
- **Consentimiento de cualquier versión (D3):** si legal exigiera volver a consentir ante un texto nuevo, cambia la regla (no el esquema).
- **Contenido clínico en H2 vs MySQL:** `TEXT` en ambos; los límites de D11 quedan por debajo de 65535 bytes aun con emojis.
- **Profesional vinculado (D7):** si el seed o el alta de usuarios no vincula `profesional.usuario_id`, el `PROFESIONAL` no podría crear notas. Se verifica con el seed de desarrollo en la tarea de verificación manual.

## Migration Plan

Sin cambios de esquema ni datos. Despliegue normal del backend; rollback = volver a la versión anterior (las tablas ya existían vacías).

## Open decisions / checkpoints for human approval

D1–D11 aprobadas el 2026-11-24; checkpoints aprobados el mismo día:

1. **Versión del consentimiento al registrar (D10):** se acepta cualquier versión en vigencia del catálogo, no solo la más reciente. Las de vigencia futura se rechazan (`400`).
2. **`GET /consentimientos` sin auditar (D8):** devuelve fechas e ids, no datos de salud.
