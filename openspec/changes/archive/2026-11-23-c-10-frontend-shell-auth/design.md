# Design

## Context

- C-01 deja: Vite + TypeScript `strict` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), ESLint con `no-explicit-any` en error, Vitest con jsdom, `src/{api,pages,components,state,utils}`, `mountApp(document)` que monta un `<h1>` y `API_BASE_URL` resuelto desde `VITE_API_BASE_URL` (default `http://localhost:8080/api`, sin `/` final). En Docker el frontend es estático en nginx sin fallback de SPA, publicado en `5173:80`.
- C-03 deja (handoff `knowledge-base/entrega/C-03.md`):
  - `POST /api/auth/register` con `{consultorioNombre, nombre, apellido, email, password, matricula?}` → `201 {consultorioId, usuarioId}` **sin token**; `409` email duplicado; `400` con `errores: [{campo, mensaje}]`.
  - `POST /api/auth/login` con `{email, password}` → `200 {accessToken, tokenType: "Bearer", expiresIn: 1800, usuario: {id, nombre, rol}, consultorioId}`; `401` genérico; `429` con `Retry-After` (segundos).
  - `GET /api/auth/me` → `200 {usuario: {id, nombre, email, rol}, consultorio: {id, nombre}}`; `401` si el usuario está inactivo.
  - Errores en `ProblemDetail` sin valores del cliente. Bearer en header, **sin refresh** (DD-04): al vencer, la SPA vuelve al login. Recomendación del handoff: token en memoria o `sessionStorage`.
- Validaciones del backend a reflejar en el cliente: email válido y ≤ 254; contraseña ≥ 8 caracteres y ≤ 72 bytes UTF-8; `consultorioNombre` ≤ 150; `nombre`/`apellido` ≤ 100; `matricula` opcional ≤ 50.
- Diseño visual diferido (`design-system/README.md`): estilos mínimos, sin librería de UI.
- Motivación y alcance: `proposal.md`. Requisitos: `specs/`.

## Goals / Non-Goals

**Goals:**
- Un único cliente HTTP por el que pasan todas las llamadas de C-10..C-15, con errores tipados y exhaustivos.
- La sesión falla cerrada: token vencido, inválido o rechazado → sin sesión y de vuelta al login.
- Imposible (o detectado por lint/test) renderizar datos de usuario como HTML.
- Infraestructura reutilizable por las fichas siguientes sin reescribirla: registrar una ruta protegida y una entrada de menú debe ser una línea.

**Non-Goals:** refresh/rotación de token, cookie HttpOnly, logout de servidor, recuperación de contraseña, usuarios adicionales, ocultar navegación por rol (no hay pantallas todavía; la sesión expone `rol` para C-11+), design system, i18n, history API con URLs limpias.

## Decisions

### D1 — Cliente HTTP: función única + `ApiError` discriminado
- `createHttpClient({ baseUrl, fetchFn, getToken, onUnauthorized, timeoutMs = 15000 })` devuelve `request<T>(method, path, opts)`; `fetchFn` inyectable para tests (sin librerías de mock de red).
- `path` debe empezar con `/` y ser relativo: el cliente **rechaza URLs absolutas**, así el token nunca sale hacia otro origen.
- Encabezados: `Accept: application/json` siempre; `Content-Type: application/json` solo con cuerpo; `Authorization: Bearer <token>` solo si la request es autenticada (`auth: true`, default) y hay token. `credentials: 'omit'` (no hay cookies).
- Respuesta 2xx: `204`/cuerpo vacío → `undefined`; JSON → validado por un *decoder* por endpoint (función `(u: unknown) => T` que lanza `ApiError{kind:'unexpected'}` si la forma no coincide). Nada de `as T` sobre JSON crudo (regla 4).
- Respuesta no 2xx → `ApiError` (clase que extiende `Error`) con `kind`:
  | Estado | kind | datos extra |
  |---|---|---|
  | 400, 422 | `validation` | `fieldErrors: {campo, mensaje}[]` (vacío si el cuerpo no trae `errores`) |
  | 401 | `unauthorized` | — |
  | 403 | `forbidden` | — |
  | 409 | `conflict` | — |
  | 429 | `rate_limited` | `retryAfterSeconds: number \| null` (de `Retry-After` en segundos) |
  | 5xx | `server` | — |
  | otro | `unexpected` | `status` |
  | `fetch` rechaza | `network` | — |
  | abort por timeout | `timeout` | — |
- `ApiError.message` es un texto fijo por `kind`, nunca el `detail` del servidor ni datos del cliente (evita mostrar o loguear PII). `status` y `title` del `ProblemDetail` quedan disponibles para depurar.
- **401 global**: si la request era autenticada y responde 401, el cliente invoca `onUnauthorized()` (cierra sesión y navega a login) y además rechaza con el `ApiError`. Un 401 del `login` (no autenticado) **no** dispara el cierre: es "credenciales inválidas".
- Endpoints en `src/api/auth.ts`: `register(req)`, `login(req)`, `me()`, con tipos en `src/api/types.ts` (`Rol = 'ADMIN' | 'PROFESIONAL' | 'RECEPCION'`).
- Alternativa descartada: `Result<T, E>` en lugar de excepciones — más verboso en cada página sin beneficio real con un `kind` exhaustivo y `switch` con `never`.

### D2 — Sesión: token en `sessionStorage`, perfil en memoria
- Se persiste **solo** `{ token, expiresAt }` (epoch ms = `now + expiresIn*1000`) bajo una clave versionada (`global.session.v1`) en `sessionStorage`: sobrevive a recargar la pestaña (si no, cada F5 obliga a reloguear) y se borra al cerrar la pestaña. **Nunca** `localStorage` (persistiría en disco entre sesiones del navegador, en una PC compartida de recepción).
- El perfil (`usuario {id, nombre, email, rol}`, `consultorio {id, nombre}`) se guarda solo en memoria y se obtiene con `me()` al iniciar sesión y al recargar. Así no quedan nombre ni email en almacenamiento del navegador (Ley 25.326, regla 5).
- `SessionStore` con reloj inyectable (`now: () => number`) y `storage: Storage` inyectable; API: `start(loginResponse)`, `restore()`, `setProfile(me)`, `getToken()` (devuelve `null` si venció), `isAuthenticated()`, `profile()`, `end(reason)`, `subscribe(listener)`.
- `restore()` con datos ausentes, JSON inválido, forma incorrecta o vencidos → borra la clave y queda sin sesión.
- Vencimiento: un `setTimeout` programado a `expiresAt` llama `end('expired')`; además `getToken()` revalida contra el reloj (por si la pestaña estuvo suspendida). Margen de 30 s antes de `exp` para no enviar un token que vence en vuelo.
- `end(reason)` (`'logout' | 'expired' | 'unauthorized'`) borra la clave, el perfil y el timer, y notifica; el shell muestra un aviso en el login para `expired`/`unauthorized` ("Tu sesión venció, volvé a ingresar").
- Riesgo aceptado: un XSS podría leer `sessionStorage`. Mitigación: D5 (sin APIs que interpretan HTML + lint), token de 30 min sin PII. Cookie HttpOnly queda post-MVP (DD-04).
- Alternativa: token solo en memoria — más seguro frente a XSS persistente pero obliga a reloguear en cada recarga. Descartada por la persona (Q1, 2026-11-23: `sessionStorage`); si se revisa post-MVP, alcanza con inyectar un `storage` en memoria.

### D3 — Router por hash con guard
- Rutas como tabla: `{ path: '/login', public: true, render }`, `{ path: '/registro', public: true, render }`, `{ path: '/inicio', render }` (protegida por default). `''` y `'/'` → `/inicio`; ruta desconocida → `/inicio` (o login si no hay sesión).
- Hash (`#/login`) porque el nginx de C-01 no tiene fallback de SPA: rutas por History API darían 404 al recargar y requerirían tocar el Dockerfile/nginx.
- Guard al resolver cada ruta: protegida sin `isAuthenticated()` → `replace` a `#/login`; pública con sesión → `replace` a `#/inicio`. Usa `location.replace` para no ensuciar el historial con redirecciones.
- Destino tras login: siempre `#/inicio` (sin `returnTo`: evita redirecciones abiertas y no hay otras pantallas todavía).
- Al cambiar de ruta: se reemplaza el contenido de `<main>`, se actualiza `document.title` (`"<Página> · Global"`) y se mueve el foco al `<h1>` de la página (`tabindex="-1"`), para lectores de pantalla.
- `createRouter({ window, routes, session })` inyectable; las páginas reciben un contexto `{ api, session, navigate }` y devuelven un `HTMLElement` (más una función `dispose` opcional; en el apply se implementó como bandera que hace ignorar las respuestas que llegan después de salir de la página, sin abortar la request: más simple y suficiente para login/registro).

### D4 — Layout y arranque
- `mountApp(document, deps?)` (mantiene la firma de C-01 con dependencias opcionales para tests): crea el layout, restaura la sesión, si hay token llama `me()` (un 401 cierra la sesión vía D1), arranca el router y escucha `hashchange`.
- Layout: `<header>` con el nombre del producto (texto), y con sesión: nombre del consultorio, nombre del usuario y botón "Cerrar sesión"; `<nav aria-label="Principal">` con entradas registrables (`Inicio` por ahora); `<main id="contenido">`. Sin sesión, solo el nombre del producto. Enlace "Saltar al contenido".
- Mientras `me()` está pendiente se muestra un estado de carga; si falla por red, un mensaje con "Reintentar" (no cierra la sesión: el token puede seguir siendo válido).
- Estilos: un `src/styles.css` mínimo (legibilidad, foco visible, contraste); el diseño definitivo es del design system diferido.

### D5 — DOM seguro y su verificación
- `src/utils/dom.ts`: `h(tag, props?, ...children)` donde `children` son `Node | string` (los strings se convierten con `document.createTextNode`), `props` admite `className`, `id`, atributos `aria-*`/`data-*`, `type`, `name`, `for`, `autocomplete`, `required`, `href` y `on: { click, submit, ... }` como listeners. Rechaza (lanza) atributos `on*` como string, `style` como string y `href` con esquema distinto de `#`, `http:`, `https:`, `mailto:` (bloquea `javascript:` y `data:`). Helper `clear(el)` con `replaceChildren()`.
- ESLint en `src/**/*.ts` (excepto `*.test.ts`): `no-restricted-properties`/`no-restricted-syntax` para `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `DOMParser`, `createContextualFragment` y `eval`/`new Function`. Los tests sí pueden usar `innerHTML` para armar fixtures.
- Test de tooling (como `no-explicit-any.test.ts` de C-01) que ejecuta ESLint sobre un archivo con `innerHTML` y espera error.
- Cada página tiene un test que inyecta `<img src=x onerror=alert(1)>` en los datos que muestra (nombre de usuario/consultorio, mensajes) y verifica texto literal y cero elementos `img`.

### D6 — Páginas de login y registro
- Formularios con `<label for>`, `autocomplete` (`email`, `current-password`, `new-password`, `organization`, `given-name`, `family-name`), `novalidate` (la validación la hace el cliente para mensajes uniformes), errores por campo enlazados con `aria-describedby` + `aria-invalid`, y un resumen de error con `role="alert"`.
- Validación en el cliente (`src/pages/auth/validation.ts`, funciones puras compartidas por login y registro) con las mismas reglas que el backend; los 400 del servidor se mapean por `campo` al input correspondiente (campo desconocido → resumen general).
- Envío: botón deshabilitado y `aria-busy` mientras hay request; se ignora un segundo submit.
- Mensajes por error (textos fijos, sin eco de datos):
  - login `unauthorized` → "Email o contraseña incorrectos."; `rate_limited` → "Demasiados intentos. Probá de nuevo en N minutos." (redondeo hacia arriba; sin `Retry-After`, sin número).
  - registro `conflict` → "Ya existe una cuenta con ese email." (aceptado por Flujo 1 / C-03); `validation` → errores por campo.
  - ambos `network`/`timeout` → "No se pudo conectar con el servidor."; `server`/`unexpected` → "Ocurrió un error. Intentá de nuevo."
- Tras un fallo se vacía el campo contraseña; nunca se escriben credenciales ni cuerpos de request en `console`.
- Registro exitoso → `login` automático con las mismas credenciales → `start` + `me()` → `#/inicio`. Si ese login falla (p. ej. 429), se navega a `#/login` con el aviso "Cuenta creada. Iniciá sesión." Confirmado por la persona (Q2, 2026-11-23).

### D7 — Tests
- Vitest + jsdom; `fetch` simulado con una función que devuelve `new Response(...)` con los cuerpos del contrato de C-03 (fixtures en `src/api/__fixtures__/`); reloj y `setTimeout` con `vi.useFakeTimers()`; `sessionStorage` real de jsdom limpiado en `afterEach`.
- Sin tests E2E contra el backend en este change (regla 9: no levantar el stack). La verificación integrada contra la API real la hace la persona a mano (tarea final).

## Risks / Trade-offs

- **Token legible por un XSS** (`sessionStorage`) → D5 (lint + helper + tests de texto malicioso), token de 30 min sin PII, sin `localStorage`. Post-MVP: cookie HttpOnly.
- **Sin revocación**: "Cerrar sesión" solo borra el token del navegador; un token copiado sigue valiendo hasta 30 min (riesgo aceptado en C-03).
- **Reloj del cliente desfasado** → `expiresAt` se calcula con `expiresIn` relativo (no con `exp` del JWT) y el backend sigue siendo la autoridad: un 401 cierra la sesión igual.
- **Sesión que vence a mitad de un formulario** → se pierde lo tipeado en esa pantalla. Aceptado en el MVP (sin refresh); C-12/C-13 pueden avisar antes del vencimiento usando `expiresAt`.
- **Validación duplicada cliente/servidor** puede divergir → el servidor manda; los 400 se muestran por campo aunque el cliente no los haya detectado.
- **El 409 del registro revela que el email existe** → aceptado por el Flujo 1 (C-03).
- **Router propio** sin librería → poco código, cubierto por tests; si crece mucho en C-11..C-15 se reevalúa.

## Migration Plan

Sin migraciones de base ni cambios de backend. Despliegue = rebuild de la imagen del frontend. Rollback = revertir el PR; el backend no depende de este change.

## Open Questions

Resueltas por la persona el 2026-11-23:

- **Q1** → token en `sessionStorage` (solo `{token, expiresAt}`; sobrevive a F5, se borra al cerrar la pestaña). Ver D2.
- **Q2** → login automático tras el registro (Flujo 1, paso 3), con caída a `#/login` y aviso si ese login falla. Ver D6.
- **Q3** → la validación responde `400` en el contrato de la API para C-04 en adelante (como ya hace C-03). El cliente sigue aceptando `422` como `validation` por robustez. Se registra en el handoff de C-10 para que lo tomen C-04..C-09.

Sin preguntas abiertas.
