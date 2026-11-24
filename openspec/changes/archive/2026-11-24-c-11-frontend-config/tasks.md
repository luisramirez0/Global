# Tasks

> Strict TDD: cada tarea arranca con un test que falla (RED), luego el mínimo código (GREEN), un segundo caso (TRIANGULATE) y refactor con tests verdes. Vitest + jsdom; API simulada con `vi.fn` y fixtures con el contrato real de C-04. No se levanta el stack (regla 9). Sin cambios en `backend/` ni `db/migration`. Governance BAJO; decisiones D1–D9 aprobadas por Integrante 4 (2026-11-24) con las verificaciones V-D3, V-D4, V-D7 y V-D8.

## 0. Línea base

- [x] 0.1 (210/210, lint y typecheck limpios) `npm test` (210/210), `npm run lint` y `npm run typecheck` en `c-11-frontend-config` antes de tocar código.
- [x] 0.2 (código + IT temporal 3/3 en `gradle:8.14-jdk21`, borrado después; IT permanente pendiente para C-04) V-D7: confirmar en el backend que `PUT` con `activo: true` reactiva sillones y prestaciones.

## 1. Zona horaria y grilla

- [x] 1.1 RED: `src/utils/zonaHoraria.test.ts`: `aInstanteUtc` para 21:00, 22:30 y 23:59 AR → día siguiente en UTC; fin de año; fechas u horas inválidas → `null`; `aFechaHoraLocal` inverso; `hoyEnZona` a las 02:30Z y 03:00Z. GREEN: `src/utils/zonaHoraria.ts`.
- [x] 1.2 V-D4: los mismos casos con `process.env.TZ` = `UTC`, `Asia/Tokyo`, `America/Los_Angeles`, `Europe/Madrid`, `America/Argentina/Buenos_Aires`, verificando que el offset local del proceso cambió.

## 2. Cliente de configuración

- [x] 2.1 RED: `src/api/agendaConfig.test.ts`: método, ruta, query (`incluirInactivos`, `incluirInactivas`, `desde`/`hasta`), cuerpo y `auth` de cada operación; `204` en borrados; id no entero → error de programación sin request. GREEN: `src/api/agendaConfig.ts`.
- [x] 2.2 RED: decodificadores: campos faltantes, `diaSemana` fuera de 1..7, hora no `HH:mm`, instante no ISO, ids nulos permitidos solo donde corresponde → `unexpected`. GREEN: `src/api/decoders.ts`, `src/api/types.ts`, fixtures `src/api/__fixtures__/agendaConfig.ts`.

## 3. Infraestructura compartida

- [x] 3.1 RED: `components/form.test.ts`: `createSelectField` con label, opciones, error accesible; `applyFieldErrors` enfoca un select. GREEN: `FormControl`, `createSelectField`, tipos `time`/`datetime-local` en `form.ts`.
- [x] 3.2 (más `src/router/routes.test.ts`) RED: `PageContext.agenda` en `app.ts` (las requests usan la base y el token); rutas `/config/*` protegidas e ítem "Configuración" (`router`/`layout`/`app` tests). GREEN: `context.ts`, `app.ts`, `routes.ts`, `test-support/pages.ts`.
- [x] 3.3 RED: `pages/config/validacion.test.ts` y `permisos.test.ts` (≥ 2 casos por regla). GREEN: `validacion.ts`, `permisos.ts`, `mensajes.ts`.

## 4. Pantallas

- [x] 4.1 (también `herramientas.ts`) Sillones (`sillones.test.ts`): listado, vacío, error de carga con reintento, alta, edición sin `activo`, baja con confirmación, mostrar inactivos, reactivar, 409 de límite y de último activo, 400 por campo, 404, XSS; V-D3 `RECEPCION` sin `form` ni acciones. GREEN: `crudPage.ts`, `nav.ts`, `sillones.ts`.
- [x] 4.2 Prestaciones (`prestaciones.test.ts`): duración inválida, alta, edición, baja, reactivar, inactivas, V-D3. GREEN: `prestaciones.ts`.
- [x] 4.3 Horarios (`horarios.test.ts`): día y horas, orden, alineación, alta sin `profesionalId`, edición con el suyo, 409 superpuesta, 422 profesional, V-D3. GREEN: `horarios.ts`.
- [x] 4.4 (bug encontrado por el test: errores del filtro bajo `desde`/`hasta` y campos `filtroDesde`/`filtroHasta`; corregido) Bloqueos (`bloqueos.test.ts`): V-D8 filtro por defecto con reloj fijo a 23:30 AR, rango, alta 21:00–23:59 AR en UTC, alcance consultorio/sillón, `profesionalId` conservado, motivo > 255 bytes, `fin <= inicio`, `RECEPCION` con formulario y sin "Eliminar". GREEN: `bloqueos.ts`.

## 5. Verificación y cierre

- [x] 5.1 (393/393 en 25 archivos; build JS 38,2 kB, 13,2 kB gzip) `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`; `grep` de `innerHTML|outerHTML|insertAdjacentHTML|localStorage|console.` en `src/` fuera de tests vacío; `git diff main -- backend` vacío.
- [x] 5.2 (verificación manual OK por la persona con ADMIN y RECEPCION; `[x]` marcado el 2026-11-24) Handoff `knowledge-base/entrega/C-11.md` y `CHANGES.md` §C-11 con evidencia (marcar `[x]` solo tras la verificación técnica).

## Archivo (2026-11-24)

- Mergeado en PR #14 (merge `b918ca4`). Specs sincronizadas: nueva `frontend-agenda-config` (7 requisitos); `frontend-shell` con el requisito agregado "Navegación a la configuración".
- **Pendiente para C-04 (o un PR aparte):** IT permanente de reactivación exitosa (`PUT` con `activo: true` en sillón y prestación → 200 y activo al releer; `PUT` sin `activo` no reactiva) en `SillonControllerIT` y `PrestacionControllerIT`. En C-11 se verificó solo con un IT temporal 3/3 no versionado (ver `knowledge-base/entrega/C-11.md`).
