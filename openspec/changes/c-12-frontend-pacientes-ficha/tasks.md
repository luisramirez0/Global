# Tasks

> **TDD estricto.** Cada tarea arranca con un test que falla (RED). Después va el mínimo código (GREEN), un segundo caso (TRIANGULATE) y el refactor con los tests en verde.
>
> - Vitest + jsdom. La API se simula con `vi.fn` y fixtures con el contrato real de C-05 y C-08.
> - No se levanta el stack (regla 9). Sin cambios en `backend/` ni `db/migration`.
> - **Governance ALTO**: review de integrante-1 o integrante-2.
> - D1–D11 aprobadas por Integrante 5 (2026-11-24), con los ajustes A-D1, A-D3, A-D5, A-D7 y A-D9.
>
> **Dos partes** (design §Partición):
> - **C-12a** (§0–4, 6a, 7a): pacientes, router y `ApiError`. Debe poder revisarse y mergearse sola: sin la ruta `/pacientes/:id/ficha`, sin el enlace "Ficha" y sin handoff ni `[x]` en CHANGES.md.
> - **C-12b** (§5, 6b, 7b): ficha clínica. Depende de C-12a, registra la ruta y el enlace, y cierra el change (handoff y `[x]`).

---

# Parte C-12a — Pacientes, router y `ApiError`

## 0. Línea base

- [x] 0.1 En `c-12-frontend-pacientes-ficha` (desde `main` `68efd44`), antes de tocar código: `npm ci`, `npm test` (393/393, 25 archivos), `npm run lint` y `npm run typecheck`, todo limpio.

## 1. `ApiError` con código (D3)

- [x] 1.1 (437/437 en la suite; 2 casos de integración en `http.test.ts`) RED: `api/errors.test.ts`:
  - `codigo` válido en 409 y 422.
  - Forma inválida (`<b>x</b>`, número, minúsculas, 41 caracteres) → `null`.
  - `pacienteId` solo en 409 y entero positivo (`"7"`, `-1` o en 400 → `null`).
  - El `message` sigue siendo el fijo.

  GREEN: `api/errors.ts`.
- [x] 1.2 (caracterización: `messageForError` ya ignoraba `codigo`; sin cambio de código) RED: `messageForError` con un `codigo` desconocido → mensaje genérico del `kind` (A-D3). GREEN si hace falta.

## 2. Router con parámetros (D1, A-D1)

- [x] 2.1 (53/53 en `router.test.ts`; también ids no ASCII, exponentes, `%31`, barra final y patrones mal formados) RED: `router/router.test.ts`, solo **casos nuevos**, con rutas de prueba propias del test (por ejemplo `/x/:id` y `/x/:id/y`); los existentes quedan sin modificar:
  - `:id` válido → `params.id` numérico.
  - Ruta exacta antes que patrón.
  - `abc`, `-1`, `0`, `01`, `1.5` y `9007199254740993` → `#/inicio` sin render.
  - Cambio de `id` → `dispose` y re-render.
  - Guard sin sesión → `#/login`.

  GREEN: `router/router.ts`.
- [x] 2.2 (verde ya al escribirlo: `/pacientes/:id` se registra en 3.3; ahí se vuelve a correr) RED: `app.test.ts`, caso nuevo: `#/pacientes/abc` y `#/pacientes/-1` con sesión → `#/inicio`. El `fetch` simulado no recibe ninguna request además del `me()` del arranque. GREEN.
- [x] 2.3 (0 líneas borradas o modificadas; `routes.test.ts` sin cambios) Verificación: `git diff main -- frontend/src/router/router.test.ts frontend/src/router/routes.test.ts frontend/src/app.test.ts` solo agrega casos, sin borrar ni modificar líneas existentes.

## 3. Infraestructura compartida

- [x] 3.1 (15/15 en `form.test.ts`; también `type: 'tel'` y `hint`, la ayuda accesible que usa el teléfono en 4.5) RED: `components/form.test.ts`: `createTextAreaField` (label, `maxLength`, error accesible con `aria-invalid`/`aria-describedby`); `applyFieldErrors` enfoca una textarea; `FieldOptions.maxLength`. GREEN: `components/form.ts`. La textarea se usa en C-12b; queda en C-12a por ser infraestructura compartida y aditiva.
- [x] 3.2 (C-11 sin cambios de comportamiento: 115/115 en `pages/config` y permisos) RED: `pages/permisos.test.ts`: `puedeDarDeBaja` para los 3 roles y sin perfil. GREEN: `pages/permisos.ts`, más el re-export de `rolActual` desde `pages/config/permisos.ts`.
- [x] 3.3 (reordenada: `PageContext.pacientes` y `PacientesMock` pasan a 4.1, donde existe el cliente; las rutas apuntan a esqueletos de página con solo el `h1` y el título fijo, que 4.4 y 4.5 completan con TDD. Mutación hecha: ver nota) En `routes.ts`, **solo** `/pacientes`, `/pacientes/nuevo` y `/pacientes/:id`, más el ítem "Pacientes" (casos nuevos en `routes.test.ts` y `app.test.ts`).
- [x] 3.4 **Ficha no registrada** (C-12a). RED en `app.test.ts`, caso nuevo: con sesión ADMIN, `#/pacientes/5/ficha` → `#/inicio` (ruta desconocida). El `fetch` simulado no recibe ninguna request además del `me()` del arranque: nada a `/api/pacientes/…` ni a `/api/consentimientos/…`. En `routes.test.ts`: ninguna ruta de `ROUTES` coincide con `/pacientes/5/ficha`. C-12b reemplaza este caso (5.9).

> **Nota de mutación (3.3, 2026-11-24).** Con `/pacientes/:id` registrada, se alteró temporalmente `parseParam` en `router.ts` y se restauró desde el commit (`git diff` vacío). Resultados:
> - **M1, sin validación** (`return Number(value)`): fallan los 5 casos con sesión de 2.2 (`abc`, `-1`, `0`, `01`, `1.5`); 19 fallas en total sumando `router.test.ts`.
> - **M2, sin la regex**: fallan `-1`, `0` y `01`. `abc` y `1.5` los sigue frenando `isSafeInteger`.
> - **M3, sin `isSafeInteger`**: al principio solo fallaban 2 casos de `router.test.ts`. Por eso se sumó `#/pacientes/9007199254740993` a 2.2, que ahora también falla.
>
> Los casos sin sesión de 2.2 no detectan mutantes: el guard manda a `#/login` antes de mirar el id. Es esperado.

## 4. Pacientes

- [ ] 4.1 (incluye `PageContext.pacientes` en `app.ts` con el mismo `http` y `PacientesMock` en `test-support/pages.ts`, movidos desde 3.3) RED: `api/pacientes.test.ts`: método, ruta, query (`q` codificado, `incluirInactivos`, `page`, `size`), cuerpo y `auth` de las 6 operaciones; `204` en baja y reactivación; id inválido → sin request. GREEN: `api/pacientes.ts`.
- [ ] 4.2 RED: decodificadores de `Paciente` y `Pagina<T>`: faltantes, `activo` no booleano, `fechaNacimiento` no `YYYY-MM-DD`, `totalPaginas` negativo → `unexpected`. GREEN: `api/decoders.ts`, `api/types.ts`, fixtures en `api/__fixtures__/pacientes.ts`.
- [ ] 4.3 RED: `pages/pacientes/validacion.test.ts`, ≥ 2 casos por regla de D9 (DNI con puntos y espacios, E.164, email, fecha futura con `hoyEnZona`, largos). GREEN: `validacion.ts` y `mensajes.ts`.
- [ ] 4.4 RED: `pages/pacientes/lista.test.ts`:
  - Carga, vacío, error con "Reintentar".
  - Búsqueda al enviar; `q` fuera de la URL.
  - Respuesta vieja descartada.
  - Paginación; casilla de inactivos.
  - Baja en dos pasos (confirmar y cancelar); reactivar; 404 y 403.
  - Botones por rol: `RECEPCION` sin "Dar de baja" ni "Reactivar"; `ADMIN` y `PROFESIONAL` con ambos.
  - **Sin enlace "Ficha"** (C-12a): con `ADMIN`, `PROFESIONAL` y `RECEPCION`, ninguna fila tiene un enlace o botón "Ficha" ni un `href` que termine en `/ficha`. C-12b reemplaza este caso (5.9).

  GREEN: `pages/pacientes/lista.ts`.
- [ ] 4.5 RED: `pages/pacientes/formulario.test.ts`:
  - Alta y edición con normalización.
  - Errores locales.
  - **Errores del servidor que la validación local deja pasar** (A-D9).
  - Campo desconocido → aviso general.
  - 409 con y sin `pacienteId` (enlace "Ver paciente existente").
  - 404 → "Paciente no encontrado".
  - Paciente inactivo con "Reactivar" según el rol.
  - `flash` solo con texto fijo.

  GREEN: `pages/pacientes/formulario.ts`.

## 6a. Escape de contenido — pacientes

- [ ] 6a.1 Tests con `<img src=x onerror=alert(1)>`, `<script>alert(1)</script>` y `"><svg onload=…>`:
  - En nombre, apellido, DNI, teléfono, email, dirección y obra social, en la lista, el formulario de edición y el aviso de DNI duplicado.
  - En los mensajes de error del servidor: `title`, `detail` y `errores[].mensaje` con esos textos.
    - El `title` y el `detail` no se muestran.
    - El `mensaje` por campo, si se muestra, aparece como texto literal.

  Se verifica el texto literal y que no hay `img`, `script` ni `svg` en el documento.

## 7a. Verificación de C-12a

- [ ] 7a.1 `npm test`, `npm run lint`, `npm run typecheck` y `npm run build` limpios; anotar conteos y tamaño del bundle.
- [ ] 7a.2 `grep` en `frontend/src` fuera de los tests: `innerHTML|outerHTML|insertAdjacentHTML|localStorage|console\.|: any|as any` sin resultados; `sessionStorage` solo en `state/session.ts`.
- [ ] 7a.3 `git diff main -- backend` vacío; tests de rutas exactas existentes sin cambios (2.3); `grep -rn "/ficha" frontend/src --include=*.ts --exclude=*.test.ts` sin resultados (solo lo mencionan los tests de 3.4 y 4.4).
- [ ] 7a.3b **Sin esqueletos**: ninguna página de pacientes queda como el esqueleto de 3.3, con solo el `h1`.
  - Por fuente: ningún "Esqueleto de la tarea 3.3" en `src/pages/pacientes/`.
  - Por test: en `app.test.ts`, con sesión y la API simulada, cada ruta muestra más que el `h1`:
    - `#/pacientes`: formulario de búsqueda y tabla o estado vacío.
    - `#/pacientes/nuevo`: `<form>` con los campos de D9.
    - `#/pacientes/7`: formulario con los datos o "Paciente no encontrado".
- [ ] 7a.4 Guía de verificación manual de pacientes para la persona (contra la API real, ADMIN y RECEPCION):
  - ABM y búsqueda con acentos.
  - DNI duplicado.
  - Baja y reactivación por rol.
  - `#/pacientes/1/ficha` → `#/inicio`.
- [ ] 7a.5 **Sin handoff ni `[x]` en CHANGES.md** (van con C-12b). Commit, push y PR solo con autorización de la persona (regla 10), avisando a integrante-1/2 (regla 12). La descripción del PR aclara que C-12 sigue abierto.

---

# Parte C-12b — Ficha clínica

## 5. Ficha clínica

- [ ] 5.0 Línea base de C-12b: `npm test`, lint y typecheck en verde sobre C-12a.
- [ ] 5.1 RED: `api/ficha.test.ts`, las 7 operaciones (ruta, cuerpo, query de notas) y sus decodificadores (`embarazo` booleano o `null`, ficha vacía, `Pagina<Nota>`, `Instant` ISO). GREEN: `api/ficha.ts`, decodificadores, tipos y fixtures `api/__fixtures__/ficha.ts`. `PageContext.ficha` en `app.ts` y `FichaMock` en `test-support/pages.ts`.
- [ ] 5.2 RED: `pages/ficha/validacion.test.ts`: largos 4000 y 10000; nota en blanco; casilla de consentimiento obligatoria. GREEN. RED en `pages/permisos.test.ts`: `puedeVerFicha` para los 3 roles y sin perfil. GREEN.
- [ ] 5.3 RED: `pages/ficha/ficha.test.ts`, **consentimiento** (D4):
  - Sin consentimiento: texto literal y casilla; sin anamnesis ni notas en el DOM; sin `GET /ficha` ni `GET /notas`.
  - Registrar sin casilla → sin request.
  - Registro exitoso con la versión del servidor → carga ficha y notas.
  - Consentimiento existente → no pide el texto.
  - `400` → recarga el texto.
  - `409 CONSENTIMIENTO_REQUERIDO` posterior → vuelve a bloquear y descarta los datos.

  GREEN: `pages/ficha/consentimiento.ts` y `pages/ficha/ficha.ts`.
- [ ] 5.4 RED: **anamnesis** (D5, A-D5):
  - Primera carga con `version: null` y blancos → `null`.
  - Guardado con la `version` leída; tres estados de `embarazo`.
  - `409 FICHA_DESACTUALIZADA` conserva lo escrito y la `version`.
  - "Cargar la versión actual" con confirmación (aceptar y cancelar).
  - Errores por campo del servidor.

  GREEN: `pages/ficha/anamnesis.ts`.
- [ ] 5.5 RED: **notas** (D7):
  - Lista y "Ver más".
  - Nueva nota sin `turnoId`, que aparece primera.
  - `422 PROFESIONAL_NO_VINCULADO` conserva el texto.
  - Sin botones de editar ni borrar.
  - "Profesional #id".

  GREEN: `pages/ficha/notas.ts`.
- [ ] 5.6 RED: **paciente inactivo** (D6): solo lectura con y sin consentimiento; `409 PACIENTE_INACTIVO` → solo lectura. GREEN.
- [ ] 5.7 RED: **rol** (D2): `RECEPCION` y sin perfil → aviso y **cero llamadas** a los mocks de pacientes y ficha; `PROFESIONAL` y `ADMIN` → piden paciente y consentimientos; `403` → mensaje fijo. GREEN.
- [ ] 5.8 RED: **higiene** (D8):
  - `dispose` y respuesta tardía.
  - Título fijo.
  - `localStorage` vacío y `sessionStorage` solo con `global.session.v1`.
  - `console.*` espiado sin llamadas.
  - Test de fuente: `src/pages/{pacientes,ficha}` sin `sessionStorage`.

  GREEN.
- [ ] 5.9 **Registrar la ficha y su enlace**:
  - Ruta `/pacientes/:id/ficha` en `routes.ts`.
  - Enlace "Ficha" en la lista, solo `GESTION`.
  - Se **reemplazan** los casos de C-12a 3.4 (la ruta ahora se resuelve: con `ADMIN` se piden paciente y consentimientos; con `RECEPCION`, ninguna request) y 4.4 (el enlace aparece para `ADMIN`/`PROFESIONAL` y no para `RECEPCION`).
  - Son tests propios de C-12, no los preexistentes protegidos por A-D1.

## 6b. Escape de contenido — historia clínica

- [ ] 6b.1 Tests con `<img src=x onerror=alert(1)>`, `<script>alert(1)</script>` y `"><svg onload=…>`:
  - En el texto de consentimiento y su versión.
  - En cada campo de la anamnesis (lectura y solo lectura de paciente inactivo).
  - En el texto de las notas.
  - En el encabezado del paciente dentro de la ficha.

  Se verifica el texto literal y que no hay `img`, `script` ni `svg` en el documento.

## 7b. Verificación y cierre de C-12

- [ ] 7b.1 `npm test`, `npm run lint`, `npm run typecheck` y `npm run build` limpios; anotar conteos y tamaño del bundle.
- [ ] 7b.2 `grep` en `frontend/src` fuera de los tests: `innerHTML|outerHTML|insertAdjacentHTML|localStorage|console\.|: any|as any` sin resultados; `sessionStorage` solo en `state/session.ts`.
- [ ] 7b.3 `git diff main -- backend` vacío; tests de rutas exactas existentes sin cambios (2.3).
- [ ] 7b.4 Guía de verificación manual de la ficha para la persona (contra la API real, ADMIN y RECEPCION):
  - Consentimiento y primera carga de la ficha.
  - 409 con dos pestañas.
  - Nota con el profesional del seed.
  - Paciente dado de baja en solo lectura.
  - Revisar las filas en `audit_log`.
  - RECEPCION sin ficha y sin requests.
- [ ] 7b.5 Handoff `knowledge-base/entrega/C-12.md` (cubre C-12a y C-12b). Deuda: autor por id, sin `version` en paciente, respuestas tardías no abortadas.
- [ ] 7b.6 Tras la verificación manual de la persona: `[x]` en `CHANGES.md` §C-12 con evidencia. Commit, push y PR solo con autorización (regla 10), avisando a integrante-1/2 (regla 12). Archivo del change y sincronización de specs después del merge de C-12b.
