# Design

## Context

C-05 expone `/api/pacientes` (handoff `knowledge-base/entrega/C-05.md`, spec `patient-management`). C-08 expone consentimiento, ficha y notas (handoff `knowledge-base/entrega/C-08.md`, spec `clinical-record`), con auditoría de C-06. C-10 dejó el cliente HTTP, la sesión, el router por hash, el layout, `h()` y el lint anti-XSS. C-11 dejó `crudPage`, `createSelectField` y `createLoggedContext(rol)`. C-12 agrega solo frontend.

Las decisiones D1–D11 fueron aprobadas por la persona (Integrante 5, responsable de C-12) el 2026-11-24, con los ajustes que se marcan **A-…** en cada decisión.

Contrato real verificado en el código (`paciente/abm`, `paciente/ficha`, `security/Permisos`, `common/web/ApiExceptionHandler`):

- **Pacientes**:
  - Buscar, ver, crear y editar: `OPERACION` (los tres roles).
  - `DELETE` y `POST /reactivar`: `GESTION` (`ADMIN`/`PROFESIONAL`).
  - `GET ?q&incluirInactivos&page&size` (tamaño 20, máximo 50) → `Pagina{contenido, pagina, tamanio, totalElementos, totalPaginas}`.
  - DNI duplicado → `409` con `pacienteId`.
- **Ficha**:
  - Todo es `GESTION`, incluido `texto-vigente`; `RECEPCION` recibe `403`.
  - Orden de chequeos: `404` → `409 PACIENTE_INACTIVO` (solo escritura y consentimiento) → `409 CONSENTIMIENTO_REQUERIDO` (ficha y notas, lectura y escritura).
  - `PUT /ficha` es un reemplazo completo con `version` y responde `409 FICHA_DESACTUALIZADA`.
  - `POST /notas` → `422 PROFESIONAL_NO_VINCULADO`.
  - Límites: 4000 caracteres por campo de la ficha y 10000 por nota; página de notas 20 (máximo 100).
  - El código viaja en la propiedad `codigo` del `ProblemDetail`.

## Decisions

### D1 — Rutas con parámetro
- `Route.path` admite segmentos `:nombre` (por ejemplo `/pacientes/:id/ficha`). Un parámetro **solo** coincide con un entero positivo en decimal sin ceros a la izquierda (`^[1-9][0-9]*$`) y ≤ `Number.MAX_SAFE_INTEGER`. `render(context, params)` recibe `params` como `Readonly<Record<string, number>>`. Las rutas sin parámetros siguen llamando a `render(context)`, así que las firmas existentes no cambian.
- Resolución:
  1. Primero, coincidencia exacta.
  2. Después, los patrones en el orden de `ROUTES`. `/pacientes/nuevo` es exacta y gana; además, `nuevo` no coincide con `:id`.
  3. Si no coincide nada, se aplica la regla existente de ruta desconocida: redirige a `#/inicio` con `replaceState` y no renderiza la página pedida.
- **A-D1**:
  - Los tests actuales de rutas exactas (`router.test.ts`, `routes.test.ts`, `app.test.ts`) siguen pasando **sin modificarse**.
  - Rutas como `/pacientes/abc`, `/pacientes/-1`, `/pacientes/0`, `/pacientes/01`, `/pacientes/1.5` y `/pacientes/9007199254740993` caen en "no encontrado" (ruta desconocida) **sin hacer ninguna request** de la página. Lo verifica un test con el `fetch` simulado: no recibe nada además del `me()` del arranque de la app (C-10).
  - "No encontrado" a nivel de router significa ruta desconocida → `#/inicio`, igual que `#/no-existe` (spec `frontend-shell`).
  - Un id **válido** que la API responde con `404` muestra "Paciente no encontrado" dentro de la página.
- Cambiar de `/pacientes/1` a `/pacientes/2` (o, desde C-12b, de `/pacientes/1/ficha` a `/pacientes/2/ficha`) vuelve a renderizar: el path completo es distinto y se llama al `dispose` anterior.
- En la URL solo viajan ids. Nunca nombre, DNI ni texto clínico, tampoco en la búsqueda: el término `q` vive solo en memoria de la página.
- Rutas: `/pacientes` (lista), `/pacientes/nuevo`, `/pacientes/:id` (detalle y edición) y `/pacientes/:id/ficha`. Todas protegidas. `NAV_ITEMS` gana "Pacientes" → `#/pacientes`. La ruta de ficha se registra recién en C-12b (§Partición).

### D2 — Permisos en la UI
- `puedeDarDeBaja(rol)` (C-12a) y `puedeVerFicha(rol)` (C-12b) = `ADMIN | PROFESIONAL`. Sin perfil → sin permisos. Se reutiliza `rolActual(ctx)`, que pasa de `pages/config/permisos.ts` a `pages/permisos.ts` con un re-export para no tocar C-11.
- `RECEPCION`:
  - En la lista no se crean los botones "Dar de baja" ni "Reactivar" ni el enlace "Ficha" (este último no existe para ningún rol en C-12a).
  - En `#/pacientes/:id/ficha` (C-12b) se renderiza solo un `h1` y un aviso "Sin permiso para ver la historia clínica". No se llama a **ninguna** API: ni paciente, ni consentimientos, ni ficha.
- El backend sigue autorizando: un `403` se muestra con un mensaje fijo.

### D3 — `ApiError` con código
- `ApiError` gana `codigo: string | null` y `pacienteId: number | null`, ambos de solo lectura.
  - `codigo` se toma de `body.codigo` solo si es string y cumple `^[A-Z][A-Z_]{0,39}$`; si no, `null`.
  - `pacienteId` se toma solo en `409` y si es entero positivo.
  - No cambia `kind`, el `message` fijo ni `fieldErrors`: el `422 PROFESIONAL_NO_VINCULADO` sigue siendo `validation`.
- Las pantallas mapean el código a un mensaje fijo propio (`pages/ficha/mensajes.ts`).
- **A-D3**: un `codigo` desconocido, o uno conocido en un contexto inesperado, muestra el mensaje genérico fijo del `kind` (`messageForError`). Nunca se muestran el `codigo` crudo, el `title` ni el `detail`.

### D4 — Consentimiento previo y bloqueo visual
- Al abrir la ficha:
  1. `GET /api/pacientes/{id}` para el encabezado (nombre, DNI y estado activo).
  2. `GET /consentimientos`.
  3. Si la lista está vacía, `GET /api/consentimientos/texto-vigente`.
- Sin consentimiento:
  - Se muestra el texto (`textContent`, `white-space: pre-line`) con su versión.
  - Debajo, una **casilla obligatoria** "El paciente leyó y aceptó el texto de consentimiento (versión X)" y el botón "Registrar consentimiento". El botón queda deshabilitado hasta marcar la casilla, y además se valida al enviar.
  - El `POST` envía `{versionTexto}` con la `version` **recibida del servidor**; nunca un valor tipeado.
- **Bloqueo**: mientras no haya consentimiento, las secciones de anamnesis y notas **no existen en el DOM**; no alcanza con deshabilitarlas. Tampoco se piden `GET /ficha` ni `GET /notas`, para no generar `409` ni lecturas auditadas inútiles.
- Con consentimiento, ya existente o recién registrado:
  - Se muestra "Consentimiento registrado el <fecha> (versión X)" con el más reciente.
  - Después se cargan ficha y notas.
- Si cualquier llamada responde `409 CONSENTIMIENTO_REQUERIDO` (por ejemplo, una carrera), la página vuelve al estado bloqueado y descarta los datos clínicos ya mostrados.
- Un `400` al registrar (versión no vigente) muestra "El texto de consentimiento cambió; recargá" y vuelve a pedir el texto vigente.

### D5 — Anamnesis y versión
- Campos:
  - Textareas (máximo 4000 cada uno): `alergias`, `medicacionActual`, `antecedentesMedicos`, `enfermedadesRelevantes`, `motivoConsulta` y `observaciones`.
  - Select de tres estados para `embarazo`: "Sin dato" (`null`), "Sí" (`true`) y "No" (`false`).
- La `version` recibida se guarda en memoria y se reenvía en el `PUT`: `null` si la ficha no estaba cargada. Un campo en blanco se envía como `null` (reemplazo completo). Si el `PUT` sale bien, se reemplazan el formulario y la `version` con la respuesta.
- **A-D5** (`409 FICHA_DESACTUALIZADA`):
  - Aviso fijo: "Otra persona modificó la ficha. Tus cambios no se guardaron."
  - **Lo escrito se conserva** en el formulario y no se toca la `version`.
  - Se ofrece "Cargar la versión actual". Recién con esa acción se hace `GET /ficha`, que reemplaza el formulario y la `version`; antes, una confirmación avisa que se pierde lo escrito.
  - No hay reintento automático ni se fusionan cambios.

### D6 — Paciente dado de baja
- Ficha, consentimientos y notas se ven **en solo lectura**, con el aviso "Paciente dado de baja: la historia clínica es de solo lectura".
  - No se crean el formulario de anamnesis, el de nota ni el registro de consentimiento.
  - Sin consentimiento previo, se ve "Sin consentimiento registrado" y nada más.
- `409 PACIENTE_INACTIVO` en una escritura (baja concurrente) cambia la página a ese modo.

### D7 — Notas
- Lista paginada (20) del más reciente al más antiguo. "Ver más" pide la página siguiente y la agrega al final. Cada página nueva genera su propia lectura auditada; es esperado.
- Formulario "Nueva nota": textarea obligatoria (máximo 10000), sin `turnoId` (lo hará C-13). Al crearla, se antepone a la lista.
- No hay editar ni borrar (PA-08). La UI aclara: "Las notas no se pueden editar; para corregir, agregá una nota nueva."
- `422 PROFESIONAL_NO_VINCULADO` → "Tu usuario no está vinculado a un profesional activo; no se puede firmar la nota." Se conserva lo escrito.
- Autor: **"Profesional #<profesionalId>"**. **A-D7**: queda como **deuda** hasta que exista un endpoint con nombres de profesionales (también lo pide C-11). Se anota en el handoff.

### D8 — Higiene de datos clínicos en el navegador
- Los datos clínicos y personales viven solo en variables de la página. `dispose` limpia las referencias, vacía el contenedor e ignora las respuestas que llegan tarde (mismo criterio que C-10/C-11: se ignoran, no se abortan).
- Nunca se escriben en `localStorage`, `sessionStorage`, `console`, la URL, `document.title` (el título es fijo: "Pacientes", "Paciente", "Ficha clínica") ni `flash`. `flash` solo lleva textos fijos, como "Paciente creado".
- Sin caché entre visitas: cada apertura de la ficha vuelve a leer, y esa lectura se audita según RN-DS-02. No se re-pide nada en un re-render interno.
- Mensajes de error fijos por contexto; nunca `title` ni `detail` del servidor.
- Lint existente (C-10): prohíbe `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `DOMParser`, `localStorage` y `console` en `src/` no test. Se suma un test que recorre `src/pages/{pacientes,ficha}` y falla si aparece `sessionStorage`, porque el lint lo permite en `state/session.ts`.

### D9 — Formularios y validación
- `components/form.ts` (aditivo):
  - `createTextAreaField` (`FormControl` con label, error accesible `aria-describedby`/`aria-invalid` y `maxLength`).
  - `FieldOptions.maxLength`.
  - **Agregados en la tarea 3.1** (no estaban en el plan original; los necesita el teléfono de D9):
    - `FieldOptions.type: 'tel'`.
    - `FieldOptions.hint`: ayuda visible como texto, en un `<p id="<id>-hint">`, siempre presente en `aria-describedby`. Al marcar un error queda `"<id>-hint <id>-error"`; al limpiarlo, solo la ayuda. Sin `hint`, el campo se comporta exactamente como en C-10.
    - Tests propios en `components/form.test.ts`:
      - `type 'tel'`: tipo, `autocomplete` e `inputmode` opcional.
      - `hint`: texto y `aria-describedby`; combinación con el error; ayuda maliciosa como texto literal.
      - Sin `hint`: ni párrafo de ayuda ni `aria-describedby`.
  - Login, registro y C-11 no cambian.
- Validación local (`pages/pacientes/validacion.ts` y `pages/ficha/validacion.ts`):
  - Nombre y apellido obligatorios (máximo 100).
  - DNI de 7–8 dígitos tras quitar puntos, espacios y guiones.
  - Teléfono opcional en E.164 (`+` y 8–15 dígitos tras quitar espacios y guiones), con la ayuda "Ej.: +54 9 11 2345 6789".
  - Email con formato básico (máximo 254).
  - Fecha de nacimiento no futura (hoy en zona AR con `hoyEnZona`).
  - Largos: sexo 20, dirección 255, obra social 150, campos de ficha 4000, nota 1–10000. La nota en blanco se rechaza.
- **A-D9**: **el backend es la fuente de verdad.** La validación local solo evita viajes obvios. Si pasa y el servidor responde `400`/`422` con `errores[{campo}]`, los errores se muestran en sus campos (`serverFieldErrors` + `applyFieldErrors`). Un campo que el formulario no conoce va al aviso general con mensaje fijo. Hay tests para casos donde la validación local deja pasar y el servidor rechaza (por ejemplo, un DNI que el servidor considera inválido o un email que rechaza).

### D10 — Lista y búsqueda
- Formulario de búsqueda (`q`) con botón "Buscar" (sin búsqueda al tipear), casilla "Incluir dados de baja" y paginación "Anterior/Siguiente" con "Página N de M". Se descartan las respuestas viejas.
- Tabla: apellido y nombre, DNI, teléfono y estado. Acciones por fila: "Editar", "Ficha" (solo `GESTION`; se agrega en C-12b), "Dar de baja" con confirmación en dos pasos en la fila, o "Reactivar" (solo `GESTION`).
- `404` en baja o reactivación → "El paciente ya no existe" y recarga. `403` → mensaje fijo.

### D11 — DNI duplicado
- `409` con `pacienteId` en alta o edición:
  - Aviso fijo "Ya existe un paciente con ese DNI" en el campo DNI.
  - Enlace "Ver paciente existente" → `#/pacientes/<pacienteId>`.
  - En esa pantalla, si el paciente está inactivo y el rol es `GESTION`, se ofrece "Reactivar".
- Sin `pacienteId`, solo el aviso.

## Risks / Trade-offs

- **Edición concurrente de pacientes (riesgo aceptado)**: `paciente` no tiene `version` (C-05). Si dos personas editan a la vez, **gana la última** sin aviso. Resolverlo requiere una migración y otra ficha de backend.
- **Autor de nota por id (deuda, A-D7)**: "Profesional #id" hasta que exista un endpoint con nombres.
- **Lecturas auditadas**: cada apertura de ficha genera `READ` de `FichaClinica` y de `NotaClinica`, y cada "Ver más" uno más. Es correcto según RN-DS-02; se evita duplicar dentro de una misma visita.
- **XSS**: un XSS podría leer lo que está en pantalla o el token (riesgo aceptado en C-10). Mitigación: solo `h()`/`textContent`, lint y tests con contenido malicioso en todos los campos.
- **Respuestas tardías**: se ignoran después de `dispose`, no se abortan (igual que C-10/C-11).
- **Validación duplicada**: las reglas del cliente pueden desfasarse del backend. Mitigación: A-D9.
- **Ruta con id inválido → `#/inicio`**: es coherente con la spec existente. No muestra un "no encontrado" explícito a nivel de router; el "Paciente no encontrado" se muestra dentro de la página ante un `404` de la API.

## Partición

El trabajo se hace en dos partes, en este orden. Cada una se revisa por separado; si el reviewer lo pide, cada una va en su propio PR.

- **C-12a — pacientes, router y `ApiError`** (tasks §0–4, 6a, 7a):
  - `ApiError` con `codigo`/`pacienteId`, router con parámetros, `form.ts` (textarea incluida, por ser compartida).
  - Cliente y pantallas de pacientes, e ítem "Pacientes" del menú.
  - Tests de XSS de pacientes (datos personales y mensajes de error del servidor).
  - **La ruta `/pacientes/:id/ficha` no se registra.** Entrar por URL se trata como ruta desconocida (`#/inicio`, ninguna request además del `me()` del arranque). Lo verifica un test (tasks 3.4).
  - **El enlace "Ficha" no aparece** para ningún rol. Lo verifica otro test (tasks 4.4).
  - `PageContext.ficha` y `puedeVerFicha` tampoco existen todavía.
  - Se puede mergear sola, sin dejar nada a medio hacer visible.
  - **Sin handoff ni `[x]` en CHANGES.md**: C-12 sigue abierto.
- **C-12b — ficha clínica** (tasks §5, 6b, 7b):
  - Cliente y pantalla de ficha, `PageContext.ficha` y `puedeVerFicha`.
  - Registro de `/pacientes/:id/ficha` y enlace "Ficha" solo para `GESTION`.
  - Tests de XSS de consentimiento, anamnesis y notas.
  - Reemplaza los dos tests de C-12a que fijan la ausencia de la ruta y del enlace. Son tests propios de C-12; los tests preexistentes protegidos por A-D1 no se tocan.
  - Depende de C-12a.
  - **Cierra C-12**: handoff `knowledge-base/entrega/C-12.md`, `[x]` en CHANGES.md tras la verificación manual, archivo del change y sincronización de specs.
- **Specs**: los deltas de `specs/` describen el estado final de C-12, después de C-12b, y se sincronizan una sola vez, al archivar después de C-12b. **Lo que todavía no se cumple en C-12a es esperado; el reviewer no debe marcarlo como faltante.**

  | Spec | Requisito o escenario | En C-12a |
  |---|---|---|
  | `frontend-clinical-record` | Todos los requisitos y escenarios | No se cumple: la ficha es C-12b |
  | `frontend-shell` | Rutas por hash › *Ruta con parámetro válido* (`#/pacientes/12/ficha`) | No se cumple: la ruta no está registrada y va a `#/inicio` (tasks 3.4). El parámetro válido se prueba con `#/pacientes/12` y con rutas de prueba (tasks 2.1) |
  | `frontend-shell` | Rutas por hash › *Cambio de parámetro* (`/pacientes/1/ficha` → `/2/ficha`) | No se cumple con la ficha; el mismo comportamiento se prueba con `/pacientes/1` → `/pacientes/2` (tasks 2.1) |
  | `frontend-shell` | Navegación a pacientes (texto del requisito: `#/pacientes/:id/ficha` protegida) | Parcial: las otras tres rutas sí; la de ficha no existe |
  | `frontend-shell` | Navegación a pacientes › *Ficha sin sesión* | Se cumple igual: la ruta desconocida va a `#/inicio` y el guard la manda a `#/login`, sin requests |
  | `frontend-patients` | Permisos de pacientes en la UI › *Profesional en la lista* ("Ficha" en ambos) | Parcial: "Dar de baja" y "Reactivar" sí; "Ficha" no aparece para ningún rol (tasks 4.4) |

  El resto de `frontend-shell`, `frontend-patients` y `frontend-api-client` se cumple completo en C-12a.
- Ambas partes son governance ALTO (C-12b por datos de salud; C-12a por los cambios en el cliente HTTP compartido) y requieren review de integrante-1 o integrante-2.
- **Rama**: todo sigue en `c-12-frontend-pacientes-ficha`. Si el reviewer pide partir el PR, la persona separa las ramas y los nombres se acuerdan en ese momento.

## Checkpoints para el reviewer (regla 12)

C-12a:
- `api/errors.ts`: `codigo` y `pacienteId` validados, sin eco de `detail`.
- `router/router.ts`: id inválido → ninguna request.
- `routes.ts`: sin `/pacientes/:id/ficha`; lista sin enlace "Ficha".
- Datos personales como texto literal; mensajes de error del servidor sin `title` ni `detail`.

C-12b:
- `pages/ficha/`:
  - Sin consentimiento, sin anamnesis ni notas en el DOM y sin `GET /ficha`.
  - `RECEPCION` sin requests.
  - El 409 conserva lo escrito.
  - `dispose` limpia.
- Ningún dato clínico en almacenamiento, consola, URL ni título.
