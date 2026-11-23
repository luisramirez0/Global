# Tasks

> Strict TDD: cada tarea arranca con un test que falla (RED), luego el mínimo código para pasarlo (GREEN), un segundo caso (TRIANGULATE) y refactor con tests verdes. Antes de tocar archivos existentes, correr `cd frontend && npm test && npm run lint && npm run typecheck` y registrar la línea base (C-01: 9 tests). Vitest + jsdom; `fetch`, reloj y `storage` inyectados; fixtures con los cuerpos reales del contrato de C-03 (handoff `knowledge-base/entrega/C-03.md`). No se levanta el stack (regla 9).
>
> Governance MEDIA, zona de riesgo de auth (manejo del token): Q1–Q3 resueltas por la persona (2026-11-23, ver `design.md`); **no se empieza el grupo 1 sin su aprobación explícita del diseño para el apply.** Un único PR hacia `main` avisando a integrante-1/2 (regla 12). Sin cambios en `backend/` ni en `db/migration`.

## 1. DOM seguro y lint

- [x] 1.1 (línea base 9/9 tras `npm ci`; lint y typecheck limpios) RED: `src/utils/dom.test.ts`: `h('p', {}, '<img src=x onerror=alert(1)>')` deja texto literal y cero elementos; `href` `javascript:`/`data:` y atributos `on*`/`style` como texto lanzan; `on: { click }` registra el listener; `aria-*`, `data-*`, `for`, `required` se aplican. GREEN: `src/utils/dom.ts` (`h`, `clear`).
- [x] 1.2 (además `no-console` y `localStorage` prohibidos en `src/`) RED: `tests/tooling/no-html-sinks.test.ts` (patrón de `no-explicit-any.test.ts`): ESLint sobre un fuente de `src/` con `innerHTML`, `insertAdjacentHTML` y `document.write` → error; sobre un `*.test.ts` con `innerHTML` → sin error. GREEN: reglas `no-restricted-properties`/`no-restricted-syntax` en `eslint.config.js` (D5). Verificar: `npm run lint` limpio sobre el código existente.

## 2. Cliente HTTP

- [x] 2.1 RED: `src/api/errors.test.ts`: mapeo estado → `kind` para 400, 422, 401, 403, 409, 429 (con y sin `Retry-After`), 500, 503, 418; `fieldErrors` desde `errores`; cuerpo no JSON o sin `errores` → lista vacía; `message` fijo sin `detail`. GREEN: `src/api/errors.ts` (`ApiError`, `toApiError`).
- [x] 2.2 RED: `src/api/http.test.ts`: URL = base + path; path absoluto o con esquema lanza sin llamar a `fetch`; `Accept` siempre; `Content-Type` solo con cuerpo; `Authorization` solo con `auth` y token; `credentials: 'omit'`; `204` → `undefined`; decoder que falla → `unexpected`; `fetch` rechaza → `network`; timeout con `vi.useFakeTimers()` → `timeout` y `AbortSignal` abortado; 401 autenticado invoca `onUnauthorized` una vez, 401 no autenticado no. GREEN: `src/api/http.ts` (`createHttpClient`).
- [x] 2.3 RED: `src/api/auth.test.ts` con fixtures de C-03: `register` (método, ruta, cuerpo, `auth: false`, sin `matricula` si viene vacía), `login` (`auth: false`, decodifica respuesta), `me` (`auth: true`); `rol` desconocido o campos faltantes → `unexpected`. GREEN: `src/api/types.ts`, `src/api/decoders.ts`, `src/api/auth.ts`.

## 3. Sesión

- [x] 3.1 RED: `src/state/session.test.ts` (reloj y `storage` inyectados): `start` guarda solo `{token, expiresAt}` bajo `global.session.v1` y `localStorage` queda vacío; `restore` con dato válido, vencido, JSON inválido o forma incorrecta; `getToken()` devuelve `null` dentro de los 30 s finales y cierra con `expired`; el timer cierra con `expired` a los 1770 s; `end(reason)` borra clave, perfil y timer y notifica a suscriptores con el motivo; `setProfile`/`profile()` en memoria. GREEN: `src/state/session.ts`.

## 4. Router, guard y layout

- [x] 4.1 (redirecciones con `history.replaceState` en lugar de `location.replace`, `navigate` con `pushState`; escucha `hashchange` y `popstate`) RED: `src/router/router.test.ts`: hash vacío, `#/` y desconocido → `#/inicio`; protegida sin sesión → `#/login` con `location.replace` y sin llamar al `render` protegido; `#/login`/`#/registro` con sesión → `#/inicio`; `hashchange` re-renderiza; `document.title` y foco en el `h1` (`tabindex=-1`); `dispose` de la página anterior se invoca al navegar. GREEN: `src/router/router.ts`, `src/router/routes.ts`.
- [x] 4.2 (campos de formulario en `src/components/form.ts`) RED: `src/components/layout.test.ts`: sin sesión solo el nombre del producto; con perfil muestra consultorio, usuario y "Cerrar sesión"; nombre de consultorio malicioso → texto literal sin `img`; "Cerrar sesión" llama `session.end('logout')`, no hace requests y termina en `#/login`; enlace "Saltar al contenido" y `nav[aria-label]`. GREEN: `src/components/layout.ts`, `src/styles.css` mínimo (foco visible, contraste).
- [x] 4.3 (hecha después del grupo 5 porque monta las páginas; suma vencimiento, logout, back y login de punta a punta con `fetch` simulado) RED: `src/app.test.ts` (actualiza los tests de C-01 según el delta de `frontend-bootstrap`): sin sesión monta layout + login; con sesión guardada muestra carga, llama `me()` y renderiza `#/inicio`; `me()` con red caída → mensaje + "Reintentar" sin borrar la sesión; `me()` con 401 → login con aviso de sesión vencida; título malicioso como texto; sin `#app` lanza. GREEN: `src/app.ts` (`mountApp(document, deps?)`), `src/main.ts` cablea `API_BASE_URL`, `fetch`, `sessionStorage` y `Date.now`.

## 5. Páginas

- [x] 5.1 RED: `src/pages/auth/validation.test.ts`: reglas de email (formato, 254), contraseña (8 caracteres; 72 bytes UTF-8 con `ñ` y emoji), `consultorioNombre` 150, `nombre`/`apellido` 100, `matricula` opcional 50; campos con solo espacios = vacíos. GREEN: `src/pages/auth/validation.ts` (funciones puras).
- [x] 5.2 (contexto de páginas y aviso de un solo uso en `src/pages/context.ts`; harness en `src/test-support/pages.ts`) RED: `src/pages/login/login.test.ts`: labels y `autocomplete`; errores de campo con `aria-invalid`/`aria-describedby` y sin request; doble submit → una request; éxito → sesión + `me()` + `#/inicio`; 401 → mensaje fijo y contraseña vacía, sesión intacta; 429 con `Retry-After: 840` → "14 minutos"; red/timeout → mensaje de conexión; aviso de sesión vencida cuando se llega por `expired`/`unauthorized`; consola espiada sin email/contraseña/token. GREEN: `src/pages/login/login.ts`.
- [x] 5.3 RED: `src/pages/registro/registro.test.ts`: validación cliente bloquea el envío; éxito → `register`, `login`, `me` en orden y `#/inicio`; login posterior falla → `#/login` con "Cuenta creada. Iniciá sesión."; 409 → mensaje de email existente sin sesión; 400 con `campo: "matricula"` → error en ese input, campo desconocido → resumen; contraseña vaciada tras error. GREEN: `src/pages/registro/registro.ts`.
- [x] 5.4 RED: `src/pages/inicio/inicio.test.ts`: bienvenida con el nombre del usuario y del consultorio como texto (caso malicioso incluido); `h1` enfocable. GREEN: `src/pages/inicio/inicio.ts` (provisoria hasta C-13).

## 6. Verificación y cierre

- [x] 6.1 (210/210; lint, typecheck y build OK; grep limpio; sin cambios en `backend/`) Verificar: `npm test`, `npm run lint`, `npm run typecheck` y `npm run build` en verde; `grep -rn "innerHTML\|insertAdjacentHTML\|localStorage\|console\." frontend/src --include=*.ts` sin usos fuera de tests; `git diff main --stat` sin cambios en `backend/` (incluidas migraciones).
- [x] 6.2 (handoff escrito; `CHANGES.md` queda "en curso" con evidencia y se marca `[x]` tras la verificación manual y el merge) Handoff `knowledge-base/entrega/C-10.md`: qué se hizo, cómo se verificó, contrato para C-11..C-15 (cómo registrar una ruta protegida y una entrada de navegación, cómo usar `api`, `session.profile().usuario.rol`, `ApiError.kind`, helper `h`), riesgos aceptados (token en `sessionStorage`, sin revocación), respuestas a Q1–Q3; marcar `[x]` en `CHANGES.md` con evidencia.

## Workflow follow-up

- [x] (parcial, 2026-11-23: registro y login OK contra la API real en Docker; vencimiento y 429 sin completar a mano, cubiertos por tests; ver handoff) Verificación manual de la persona contra la API real (`npm run dev` con el backend levantado por ella): registro, login, recarga con sesión, cierre de sesión, token vencido (con `JWT_EXPIRATION_MIN=1`), 429 tras 5 fallos, `409` por email duplicado.
- [x] (PR #5, merge `7814294`) PR único solo con autorización explícita, plantilla `.github/pull_request_template.md`, Conventional Commits y aviso a integrante-1/2 (zona de riesgo: manejo del token).
- [x] Archivar el change cuando el PR esté mergeado (2026-11-23).
