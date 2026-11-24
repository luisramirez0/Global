# Proposal

## Why

El backend ya permite registrarse, iniciar sesión y consultar el usuario en curso (C-03, mergeado en PR #3), pero el frontend sigue siendo el esqueleto de C-01: un `<h1>` sin navegación, sin cliente HTTP y sin sesión. Ninguna pantalla de negocio (C-11 config, C-12 pacientes/ficha, C-13 agenda, C-15 auditoría) puede construirse sin un cliente API tipado, una sesión, rutas protegidas y un layout común. C-10 está en el corte vertical mínimo que nunca se recorta (auth + pacientes + turnos + wa.me, R-01) y desbloquea C-11, C-12, C-13 y C-15.

Governance MEDIA: maneja el token en el cliente (zona de riesgo de auth, regla 12) y es la primera UI que muestra datos ingresados por usuarios, sin el escape automático de un framework (regla 3).

## What Changes

- **Cliente HTTP tipado** (`src/api/`): una única función de request sobre `fetch` que agrega `Authorization: Bearer` solo hacia `API_BASE_URL`, serializa JSON, aplica un tiempo de espera y convierte toda respuesta no exitosa en un `ApiError` discriminado (`validation` 400/422 con errores por campo, `unauthorized` 401, `forbidden` 403, `conflict` 409, `rate_limited` 429 con `Retry-After`, `server` 5xx, `network`, `timeout`, `unexpected`). El cuerpo `ProblemDetail` se lee como `unknown` con narrowing (regla 4). Endpoints tipados `register`, `login` y `me` según el contrato real de C-03.
- **Sesión** (`src/state/`): guarda solo el token y su vencimiento (calculado con `expiresIn`) en `sessionStorage` (handoff C-03, DD-04: sin refresh). El perfil (nombre, email, consultorio) vive solo en memoria y se rehidrata con `GET /api/auth/me`. Cierra la sesión al vencer el token, ante cualquier `401` de una request autenticada y al pulsar "Cerrar sesión" (sin llamada al servidor: no hay endpoint de logout).
- **Router por hash con guard** (`#/login`, `#/registro`, `#/inicio`): las rutas protegidas sin sesión válida redirigen a `#/login`; con sesión, `#/login` y `#/registro` redirigen a `#/inicio`. Sin cambios en nginx ni en el Dockerfile.
- **Layout base** (`src/components/`): encabezado con nombre del producto, consultorio y usuario, navegación (vacía hasta C-11..C-15), botón "Cerrar sesión" y región principal; foco y título del documento actualizados en cada cambio de ruta (accesibilidad).
- **Páginas** `login` y `registro` (`src/pages/`): formularios accesibles con validación en el cliente equivalente a la del backend, mensajes por cada error de la API y, tras un registro exitoso, login automático con las mismas credenciales (Flujo 1, paso 3). `inicio` queda como página de bienvenida provisoria hasta que C-13 monte la agenda.
- **DOM seguro** (`src/utils/`): helper para crear nodos que solo asigna texto con `textContent` y rechaza atributos `on*` y URLs `javascript:`; regla de ESLint que prohíbe `innerHTML`, `outerHTML`, `insertAdjacentHTML` y `document.write` en `src/` (regla 3).
- **Tests Vitest** (jsdom, `fetch` y reloj inyectados): cliente (headers, mapeo de cada error, timeout, token no enviado a otros orígenes), sesión (persistencia, vencimiento, datos corruptos), guard y redirecciones, páginas (validación, errores, flujo registro → login), y render de texto malicioso sin crear nodos.

## Capabilities

### New Capabilities
- `frontend-api-client`: request tipada, encabezados, timeout, mapeo de errores `ProblemDetail` y endpoints de auth.
- `frontend-session`: almacenamiento del token, vencimiento, perfil en memoria, cierre de sesión.
- `frontend-shell`: router por hash, guard de rutas protegidas y layout base.
- `frontend-auth-pages`: páginas de login y registro.
- `frontend-safe-dom`: creación segura de nodos y prohibición de APIs que interpretan HTML.

### Modified Capabilities
- `frontend-bootstrap`: "Montaje de la aplicación" pasa de mostrar solo el encabezado a arrancar el router y renderizar la ruta inicial dentro del layout.

## Impact

- **Código**: solo `frontend/` — `src/api/` (`http.ts`, `errors.ts`, `decoders.ts`, `auth.ts`, `types.ts`), `src/state/session.ts`, `src/router/`, `src/components/layout.ts`, `src/pages/{auth,login,registro,inicio}/`, `src/utils/dom.ts`, `src/styles.css`, `src/app.ts`, `src/main.ts`, `eslint.config.js`. `src/router/` y `src/pages/{registro,inicio}/` amplían la "Zona" listada en `CHANGES.md` (dentro de `frontend/src`, sin pisar fichas de otros).
- **Backend y esquema**: sin cambios. Ninguna migración nueva ni modificada (las migraciones de `main` quedan intactas).
- **Dependencias**: ninguna nueva (router, validación y DOM seguro propios; presupuesto cero, regla 11).
- **Configuración**: sin variables nuevas; usa `VITE_API_BASE_URL` (C-01). El origen del frontend (`http://localhost:5173`, tanto en `npm run dev` como en Docker) ya está en `CORS_ALLOWED_ORIGINS`.
- **Consumidores**: C-11..C-15 reutilizan el cliente, la sesión (rol para ocultar acciones), el router (registro de rutas protegidas) y el layout (entradas de navegación).
- **Fuera de alcance**: refresh token y cookie HttpOnly (post-MVP, DD-04), logout del lado servidor, recuperación de contraseña, alta de usuarios adicionales, diseño visual definitivo (design system diferido: estilos mínimos y funcionales), i18n, pantallas de negocio.
- **Riesgo**: zona de riesgo de auth (manejo del token en el cliente). Requiere aprobación del diseño por la persona antes del apply y aviso a integrante-1/2 en el PR (regla 12).
