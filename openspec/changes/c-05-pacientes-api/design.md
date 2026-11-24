# Design

## Context

- C-02 dejó la entidad `Paciente extends TenantEntity` (`consultorio_id` con `@TenantId`: Hibernate lo asigna al guardar y lo agrega a toda consulta, incluido `findById`), `PacienteRepository` con `findByDni`, y la tabla `paciente` en `V2__pacientes_turnos_auditoria.sql`: `dni VARCHAR(20) NOT NULL`, `telefono VARCHAR(30)`, `activo BOOLEAN DEFAULT TRUE`, `UNIQUE (consultorio_id, dni)`, índice `(consultorio_id, apellido, nombre)`, FK `RESTRICT` desde turno, nota y consentimiento. El formato de DNI y la normalización E.164 quedaron explícitamente para C-05 (C-02 design, Q4).
- C-03 dejó: `TenantContext` fijado con el `cid` del token en toda request autenticada, `Permisos.GESTION`/`OPERACION`, `ApiExceptionHandler` con `ProblemDetail` sin PII, y en tests `AuthFlows`, `TestTokens`, `@PersistenceTest` (no transaccional por test) y `TenantFixtures`/`DomainFixtures`.
- Restricción de esta propuesta: **no se modifica ninguna migración cerrada en `main`** (regla 6). El esquema actual alcanza, así que tampoco se agrega una nueva.
- Motivación y alcance: `proposal.md`. Requisitos: `specs/`.

## Goals / Non-Goals

**Goals:**
- ABM de pacientes completo para US-020 con un contrato estable para C-07, C-08, C-09 y C-12.
- Datos limpios en origen: DNI comparable (para la unicidad) y teléfono utilizable en `wa.me` sin transformación posterior.
- Aislamiento por consultorio sin código de filtrado manual y probado en cada endpoint.

**Non-Goals:** ficha/notas/consentimiento (C-08), auditoría (C-06), búsqueda fonética o sin acentos en H2, importación masiva, fusión de pacientes duplicados, borrado físico/anonimización.

## Decisions

### D1 — Recurso y endpoints

| Método y ruta | Permiso | Éxito | Errores |
|---|---|---|---|
| `POST /api/pacientes` | `OPERACION` | `201` + `Location` + `PacienteResponse` | `400`, `409` |
| `GET /api/pacientes` | `OPERACION` | `200` + `Pagina<PacienteResponse>` | `400` |
| `GET /api/pacientes/{id}` | `OPERACION` | `200` + `PacienteResponse` | `404` |
| `PUT /api/pacientes/{id}` | `OPERACION` | `200` + `PacienteResponse` | `400`, `404`, `409` |
| `DELETE /api/pacientes/{id}` | `GESTION` | `204` (idempotente) | `404` |
| `POST /api/pacientes/{id}/reactivar` | `GESTION` | `204` (idempotente) | `404`, `409` |

- `@PreAuthorize` en los métodos del **servicio** (no del controller), para que C-07/C-08 hereden el control si llaman al servicio.
- `DELETE` como baja lógica sigue la semántica HTTP de "el recurso deja de estar disponible" y coincide con la columna D de la matriz RBAC (RECEPCION no da de baja).
- `PUT` reemplaza todos los campos editables; no toca `activo` (eso es baja/reactivación). Se acepta editar un paciente inactivo (corregir datos de un registro histórico es válido).
- Alternativa descartada: `PATCH` parcial. Más casos de validación y de mapeo para un formulario que de todas formas envía todo.

### D2 — DTOs y mapper (regla 1)
- `PacienteRequest` (record, Bean Validation): `nombre` y `apellido` `@NotBlank` ≤ 100; `dni` `@NotBlank` ≤ 20 (el formato lo valida el normalizador, D3); `fechaNacimiento` opcional `@PastOrPresent`; `sexo` opcional ≤ 20 (texto libre, sin CHECK en V2); `telefono` opcional ≤ 30; `email` opcional `@Email` ≤ 254; `direccion` opcional ≤ 255; `obraSocialTexto` opcional ≤ 150. `toString` oculto (regla 5, igual que `RegistroRequest`).
- `PacienteResponse`: `id, nombre, apellido, dni, fechaNacimiento, sexo, telefono, email, direccion, obraSocialTexto, activo`. Sin `consultorioId` (implícito en el token) ni timestamps.
- `PacienteMapper`: clase estática simple, sin MapStruct (no agrega dependencia ni procesador de anotaciones).
- `common.web.Pagina<T>(List<T> contenido, int pagina, int tamanio, long totalElementos, int totalPaginas)`: no se serializa `Page` de Spring Data (estructura inestable, Spring Data 3.3+ lo advierte). Genérico para reutilizar en C-06 (`GET /api/auditoria` paginado).

### D3 — Normalización y validación de DNI y teléfono
Componentes puros (sin Spring), testeables sin contexto, en `paciente/abm/`:
- `Dni.normalizar(String)`: quita puntos, espacios y guiones; el resultado MUST ser solo dígitos con 7 u 8 cifras; si no, `DatoInvalidoException("dni")` → `400` con el campo, sin el valor. Se guarda normalizado, así `30.111.222` y `30111222` colisionan en la `UNIQUE` (RN-PA-01).
- `TelefonoE164.normalizar(String)`: `null`/vacío → `null`. Quita espacios, guiones, puntos y paréntesis; el resultado MUST cumplir `^\+[1-9]\d{7,14}$` (E.164: hasta 15 dígitos, sin `0` inicial tras el `+`); si no, `400` en `telefono`. **No** se adivina el país ni se convierte `011 15…`: un número sin `+` se rechaza y el frontend (C-12) guía al usuario con un ejemplo `+54 9 11 …`. Alternativa descartada: libphonenumber (validación por país más precisa, pero suma dependencia y metadatos para un caso que la UI resuelve con una ayuda).
- Strings opcionales: `trim`; vacío → `null`. Email en minúsculas.
- La validación de formato corre en el servicio después de Bean Validation, y ambas producen el mismo `400` con lista `errores[{campo, mensaje}]` (se agrega el handler de `DatoInvalidoException` con ese formato).

### D4 — Unicidad de DNI y carrera
1. En el servicio, con el DNI normalizado: `findByDni` (ya existe; el filtro de tenant lo acota al consultorio). Si existe otro paciente (activo o no) → `DniDuplicadoException(pacienteIdExistente)` → `409` con propiedad `pacienteId` y sin el DNI.
2. `saveAndFlush` dentro de la transacción. Si dos altas simultáneas pasan el paso 1, la segunda choca con `uq_paciente_consultorio_dni` → `DataIntegrityViolationException`; el servicio la captura, vuelve a buscar por DNI y, si existe, lanza `DniDuplicadoException`; si no, la relanza (`500`). Mismo patrón que `RegistroService` en C-03.
- Devolver `pacienteId` en el `409` no expone nada de otro consultorio (la unicidad es por consultorio) y permite a C-12 ofrecer "ver paciente existente" o "reactivar".

### D5 — Búsqueda y paginación
- JPQL portable en `PacienteRepository` (sin SQL nativo, regla 8):
  `where (:incluirInactivos = true or p.activo = true) and (:patron is null or lower(concat(p.apellido, ' ', p.nombre)) like :patron escape '!' or lower(concat(p.nombre, ' ', p.apellido)) like :patron escape '!' or (:dniPrefijo is not null and p.dni like :dniPrefijo escape '!'))`.
- Carácter de escape `!` y no `\`: en MySQL la barra invertida es escape dentro de los literales SQL, así que `escape '\'` no es portable (decidido durante el apply).
- `CriterioBusqueda` arma los parámetros: `q` recortado, máximo 100 caracteres, en minúsculas, con `!` `%` `_` escapados con `!`; `patron = %q%`; si `q` sin puntos/espacios es solo dígitos, `dniPrefijo = digitos%`. `q` vacío → sin filtro de texto.
- Orden fijo: `apellido, nombre, id` (desempate estable para paginar). `page` ≥ 0 (default 0), `size` 1..50 (default 20); valores fuera de rango se ajustan al límite (no `400`), para no romper la UI por un parámetro.
- El `LIKE '%…%'` no usa el índice `(consultorio_id, apellido, nombre)` más allá del prefijo de consultorio. Aceptado: un consultorio independiente tiene miles de pacientes, no millones.
- **Acentos**: MySQL 8 (collation por defecto `utf8mb4_0900_ai_ci`) ignora acentos y mayúsculas; H2 no ignora acentos. Los tests no dependen de la insensibilidad a acentos y la diferencia se documenta en el handoff (no se fuerza una collation: sería tocar el esquema).

### D6 — Baja lógica y reactivación
- `DELETE` → `activo = false`; si ya estaba inactivo, `204` sin cambios. Nunca `repository.delete` (además la FK `RESTRICT` lo impediría con turnos/notas/consentimientos).
- `reactivar` → `activo = true`; idempotente. No hay conflicto de DNI posible (el DNI sigue siendo el mismo registro).
- Efecto sobre turnos futuros de un paciente dado de baja: **ninguno en C-05** (C-07 aún no existe). Contrato para C-07: no crear ni reprogramar turnos de un paciente inactivo (`422`).

### D7 — Errores
En `ApiExceptionHandler` (zona de revisión, regla 12):
- `common.web.RecursoNoEncontradoException` → `404` "Recurso no encontrado", sin id ni tipo de entidad en el detalle. Inexistente y "de otro consultorio" son indistinguibles (control IDOR real, C-02 design D2).
- `DniDuplicadoException` → `409` con `pacienteId`.
- `DatoInvalidoException(campo)` → `400` con `errores[{campo, mensaje}]`, como Bean Validation.
- Un id no numérico (`/api/pacientes/abc`) y un JSON mal formado (fecha inválida) devuelven `400` sin eco del valor. El handler por defecto de `TypeMismatchException` repetía el valor en `detail` **y** en `instance` (la URI); se sobrescribe para responder `errores[{campo}]` con `instance` en `about:blank`, igual que el resto de los errores de `ApiExceptionHandler` desde C-04.
- `RecursoNoEncontradoException` es genérica para que C-04/C-07/C-08 la reutilicen; si C-04 llega antes con una equivalente, se usa esa (coordinar con Integrante 4).

### D8 — Paquetes
- `paciente/` (sin cambios de entidad): `Paciente`, `PacienteRepository` (+ `buscar(...)`).
- `paciente/abm/`: `PacienteController` (`/api/pacientes`), `PacienteService`, `PacienteRequest`, `PacienteResponse`, `PacienteMapper`, `Dni`, `TelefonoE164`, `CriterioBusqueda`, `DniDuplicadoException`, `DatoInvalidoException`.
- `common/web/`: `Pagina`, `RecursoNoEncontradoException`, handlers nuevos en `ApiExceptionHandler`.
- C-08 usará `paciente/ficha/` y, para validar que el paciente existe en el tenant, `PacienteService.obtener(id)`.

### D9 — Logs y datos personales (regla 5)
Ningún log en `paciente/abm/` incluye nombre, DNI, teléfono, email ni dirección; a lo sumo el id del paciente. `Paciente.toString` sigue siendo el de `AbstractEntity` (`Paciente#id`). Los tests de controller capturan la salida (`OutputCaptureExtension`) y verifican que el DNI y el teléfono enviados no aparecen.

## Risks / Trade-offs

- **Sin auditoría de datos de contacto** hasta C-06. Aceptado: RN-DS-02 exige auditoría para la ficha clínica, no para datos de contacto. Si C-06 define `@Audited`, anotar los métodos del servicio es un cambio de una línea.
- **Sin control de concurrencia optimista** (`paciente` no tiene `version` y no se agrega migración): dos ediciones simultáneas → gana la última. Aceptado para un consultorio con 1–2 usuarios.
- **E.164 estricto** puede molestar al cargar números locales. Mitigación en C-12 (ayuda y ejemplo); alternativa futura: normalizar `+54` por defecto según la zona del consultorio.
- **DNI 7–8 dígitos** excluye pasaportes o documentos extranjeros. Supuesto a confirmar (ver Open Questions).
- **Búsqueda con acentos distinta entre H2 y MySQL** (D5). Documentado; la verificación manual contra MySQL la cubre.
- **Conflictos de merge en `ApiExceptionHandler`** con C-04/C-06 en paralelo. Mitigación: cambios acotados (métodos nuevos al final), PR chico.

## Migration Plan

Sin migraciones ni variables de entorno nuevas. V1/V2 de `main` no se tocan. Despliegue: merge y reinicio. Rollback: revertir el PR (no hay cambios de esquema ni datos que migrar).

## Open Questions

- **Formato de documento**: ¿solo DNI argentino de 7–8 dígitos, o también pasaporte/documento extranjero (alfanumérico)? Supuesto: solo DNI. Ampliarlo después no requiere migración (`VARCHAR(20)`).
- **Teléfono**: ¿obligatorio? Supuesto: opcional (RN-CO-03 contempla pacientes sin teléfono; sin él no hay recordatorio `wa.me`). ¿Se quiere autocompletar `+54 9` para celulares locales en vez de rechazar?
- **Baja con turnos futuros**: ¿la baja debería cancelarlos o impedirse? Supuesto: no afecta en C-05; C-07 decide.
- **`RecursoNoEncontradoException` común**: confirmar con Integrante 4 (C-04) y 3 (C-06) para no duplicarla.
