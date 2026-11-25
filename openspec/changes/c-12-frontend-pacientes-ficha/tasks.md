# Tasks

> **TDD estricto.** Cada tarea arranca con un test que falla (RED). Después va el mínimo código (GREEN), un segundo caso (TRIANGULATE) y el refactor con los tests en verde.
>
> - Vitest + jsdom. La API se simula con `vi.fn` y fixtures con el contrato real de C-05 y C-08.
> - No se levanta el stack (regla 9). Sin cambios en `backend/` ni `db/migration`.
> - **Governance ALTO**: review de integrante-1 o integrante-2.
> - D1–D11 aprobadas por Integrante 5, responsable de C-12 (confirmado el 2026-11-24), con los ajustes A-D1, A-D3, A-D5, A-D7, A-D9 y A-D11.
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

- [x] 4.1 (40 tests en `api/pacientes.test.ts`; `conId`/`conQuery` extraídos de `agendaConfig.ts` a `api/rutas.ts` sin cambio de comportamiento; `errorOf` de `test-support` ahora lee selects/textareas y el id `…-error` cuando hay `hint`) (incluye `PageContext.pacientes` en `app.ts` con el mismo `http` y `PacientesMock` en `test-support/pages.ts`, movidos desde 3.3) RED: `api/pacientes.test.ts`: método, ruta, query (`q` codificado, `incluirInactivos`, `page`, `size`), cuerpo y `auth` de las 6 operaciones; `204` en baja y reactivación; id inválido → sin request. GREEN: `api/pacientes.ts`.
- [x] 4.2 (cubiertos en `api/pacientes.test.ts`: 12 casos de paciente y 7 de página) RED: decodificadores de `Paciente` y `Pagina<T>`: faltantes, `activo` no booleano, `fechaNacimiento` no `YYYY-MM-DD`, `totalPaginas` negativo → `unexpected`. GREEN: `api/decoders.ts`, `api/types.ts`, fixtures en `api/__fixtures__/pacientes.ts`.
- [x] 4.3 (51 tests; separadores del teléfono alineados con `TelefonoE164`: `[\s.()-]`. RED no ejecutado por separado: el módulo no existía) RED: `pages/pacientes/validacion.test.ts`, ≥ 2 casos por regla de D9 (DNI con puntos y espacios, E.164, email, fecha futura con `hoyEnZona`, largos). GREEN: `validacion.ts` y `mensajes.ts`.
- [x] 4.4 (23 tests; mutación hecha, ver nota) RED: `pages/pacientes/lista.test.ts`:
  - Carga, vacío, error con "Reintentar".
  - Búsqueda al enviar; `q` fuera de la URL.
  - Respuesta vieja descartada.
  - Paginación; casilla de inactivos.
  - Baja en dos pasos (confirmar y cancelar); reactivar; 404 y 403.
  - Botones por rol: `RECEPCION` sin "Dar de baja" ni "Reactivar"; `ADMIN` y `PROFESIONAL` con ambos.
  - **Sin enlace "Ficha"** (C-12a): con `ADMIN`, `PROFESIONAL` y `RECEPCION`, ninguna fila tiene un enlace o botón "Ficha" ni un `href` que termine en `/ficha`. C-12b reemplaza este caso (5.9).

  GREEN: `pages/pacientes/lista.ts`.
- [x] 4.5 (27 tests; A-D11: DNI duplicado = 409 con `pacienteId`, con o sin `codigo`; sin `pacienteId`, genérico) RED: `pages/pacientes/formulario.test.ts`:
  - Alta y edición con normalización.
  - Errores locales.
  - **Errores del servidor que la validación local deja pasar** (A-D9).
  - Campo desconocido → aviso general.
  - 409 con y sin `pacienteId` (enlace "Ver paciente existente").
  - 404 → "Paciente no encontrado".
  - Paciente inactivo con "Reactivar" según el rol.
  - `flash` solo con texto fijo.

  GREEN: `pages/pacientes/formulario.ts`.

> **Nota de mutación (4.3, 2026-11-24): compensa el RED que faltó.** Se aplicaron 34 mutantes sobre `validacion.ts`, uno por vez, con `validacion.test.ts` y `formulario.test.ts`, restaurando desde git después de cada uno (`git diff` vacío al final). Cubren:
> - Largo y forma del DNI, y sus separadores.
> - Fecha futura (`>` → `>=`, sin chequeo), calendario y fecha inválida.
> - E.164: 7 y 16 dígitos, `0` inicial, `+` opcional, sin validar.
> - Normalización del teléfono: paréntesis, puntos, guiones y vacío → `null`.
> - Largos máximos (nombre ±1, apellido, email, sexo, dirección, obra social) y recortes.
> - Obligatoriedad, opcionales vacíos → `null`, y "no frena con errores".
>
> **Murieron los 34, ningún sobreviviente**, así que no hizo falta agregar tests. Varios mutantes los detecta un solo test (por ejemplo, DNI de 6 o 9 dígitos, E.164 de 7 o 16 dígitos, `email` sin recortar).

> **Nota de mutación (4.4, 2026-11-24).** Se invirtió temporalmente `puedeDarDeBaja` (`return !(…)`) y se restauró desde el commit (`git diff` vacío). Fallan 12 tests:
> - Los de RECEPCION: `RECEPCION: "Editar" en cada fila, sin "Dar de baja" ni "Reactivar"` (lista) y `RECEPCION no` (permisos).
> - Los de ADMIN y PROFESIONAL.
> - Los 5 de baja y reactivación.

## 6a. Escape de contenido — pacientes

- [x] 6a.1 (`pages/pacientes/xss.test.ts`: 18 casos, 3 payloads × 6 escenarios; más 4 casos en `app.test.ts` con cuerpos de error maliciosos por el cliente HTTP real, 400/409 con y sin `pacienteId`/500. Se verifica además que ningún elemento quede con atributos `on*`) Tests con `<img src=x onerror=alert(1)>`, `<script>alert(1)</script>` y `"><svg onload=…>`:
  - En nombre, apellido, DNI, teléfono, email, dirección y obra social, en la lista, el formulario de edición y el aviso de DNI duplicado.
  - En los mensajes de error del servidor: `title`, `detail` y `errores[].mensaje` con esos textos.
    - El `title` y el `detail` no se muestran.
    - El `mensaje` por campo, si se muestra, aparece como texto literal.

  Se verifica el texto literal y que no hay `img`, `script` ni `svg` en el documento.

## 7a. Verificación de C-12a

- [x] 7a.1 (681/681 en 32 archivos; lint y typecheck limpios; build: JS 51,01 kB / 16,92 kB gzip, CSS 2,01 kB; `dist/` ignorado por git) `npm test`, `npm run lint`, `npm run typecheck` y `npm run build` limpios; anotar conteos y tamaño del bundle.
- [x] 7a.2 (sin resultados. `sessionStorage` aparece solo en el código de sesión de C-10: `state/session.ts`, la inyección en `app.ts` y un comentario en `main.ts`; nunca en `pages/`) `grep` en `frontend/src` fuera de los tests: `innerHTML|outerHTML|insertAdjacentHTML|localStorage|console\.|: any|as any` sin resultados; `sessionStorage` solo en `state/session.ts`.
- [x] 7a.3 (backend vacío; 0 líneas borradas en `router.test.ts`, `routes.test.ts` y `app.test.ts`; `/ficha` sin resultados fuera de los tests) `git diff main -- backend` vacío; tests de rutas exactas existentes sin cambios (2.3); `grep -rn "/ficha" frontend/src --include=*.ts --exclude=*.test.ts` sin resultados (solo lo mencionan los tests de 3.4 y 4.4).
- [x] 7a.3b (5 casos nuevos en `app.test.ts` + grep sin resultados) **Sin esqueletos**: ninguna página de pacientes queda como el esqueleto de 3.3, con solo el `h1`.
  - Por fuente: ningún "Esqueleto de la tarea 3.3" en `src/pages/pacientes/`.
  - Por test: en `app.test.ts`, con sesión y la API simulada, cada ruta muestra más que el `h1`:
    - `#/pacientes`: formulario de búsqueda y tabla o estado vacío.
    - `#/pacientes/nuevo`: `<form>` con los campos de D9.
    - `#/pacientes/7`: formulario con los datos o "Paciente no encontrado".
- [x] 7a.4 Guía de verificación manual de pacientes para la persona. Pendiente de que la persona la ejecute contra la API real, con ADMIN y RECEPCION. Requiere backend y MySQL levantados por la persona y `npm run dev`.

  **Alta**
  1. Con ADMIN, abrir "Pacientes" en el menú y luego "Nuevo paciente".
  2. Cargar Ana Pérez, DNI `30.111.222`, teléfono `+54 9 11 2345 6789`. Debe:
     - ir a `#/pacientes/<id>` con el aviso "Paciente creado.";
     - mostrar el DNI como `30111222` y el teléfono como `+5491123456789`.
  3. Validación local, sin request en Network: DNI `123`, teléfono `1123456789`, fecha de nacimiento de mañana. Cada campo muestra su error.
  4. **DNI duplicado**: otra alta con `30111222`. Debe mostrar el aviso en DNI y "Ver paciente existente", que lleva a Ana.

  **Búsqueda**
  5. Buscar `perez`, `PÉREZ`, `ana pér` y `30.111`: todos encuentran a Ana. La URL sigue siendo `#/pacientes`, sin el término.

  **Baja y reactivación**
  6. Dar de baja a Ana: "Cancelar" no hace nada; "Confirmar" la quita de la lista.
  7. Con "Incluir dados de baja", Ana aparece como "Dado de baja" y con "Reactivar".
  8. Reactivar desde la lista. Repetir la baja y reactivar desde `#/pacientes/<id>`.

  **URLs inválidas**
  9. `#/pacientes/abc`, `#/pacientes/-1`, `#/pacientes/1/ficha`: las tres van a `#/inicio`, sin requests a `/api/pacientes` en Network.

  **RECEPCION**
  10. Crear un usuario RECEPCION como en el handoff de C-11 (registro y `UPDATE usuario SET rol`) y volver a iniciar sesión.
  11. Ve "Pacientes", busca, crea y edita. No ve "Dar de baja" ni "Reactivar" en la lista, ni "Reactivar" en el detalle de un dado de baja.

  **Datos en el navegador y XSS**
  12. En DevTools, Application: `localStorage` vacío y `sessionStorage` solo con `global.session.v1`. Console sin mensajes de la app.
  13. Crear un paciente llamado `<img src=x onerror=alert(1)>`: se ve como texto en la lista y en el detalle, y no aparece ningún `alert`.
> **Prueba manual de C-12a (7a.4): resultado pendiente.** El mensaje de la persona (2026-11-24) llegó con el texto de plantilla sin completar, así que no consta si pasó. Ella aprobó la 7a y pidió seguir con C-12b; el resultado se registra cuando lo informe.

- [ ] 7a.5 **Sin handoff ni `[x]` en CHANGES.md** (van con C-12b). Commit, push y PR solo con autorización de la persona (regla 10), avisando a integrante-1/2 (regla 12). La descripción del PR aclara que C-12 sigue abierto.

---

# Parte C-12b — Ficha clínica

## 5. Ficha clínica

- [x] 5.0 (681/681 en 32 archivos, lint y typecheck limpios, sobre `bef5bb4`) Línea base de C-12b: `npm test`, lint y typecheck en verde sobre C-12a.
- [x] 5.1 (36 tests; RED por módulo inexistente, ejecutado) RED: `api/ficha.test.ts`, las 7 operaciones (ruta, cuerpo, query de notas) y sus decodificadores (`embarazo` booleano o `null`, ficha vacía, `Pagina<Nota>`, `Instant` ISO). GREEN: `api/ficha.ts`, decodificadores, tipos y fixtures `api/__fixtures__/ficha.ts`. `PageContext.ficha` en `app.ts` y `FichaMock` en `test-support/pages.ts`.
- [x] 5.2 (22 tests de validación + 4 de `puedeVerFicha`; RED ejecutado. En blanco → `null` sin recortar, como `FichaMapper.texto`) RED: `pages/ficha/validacion.test.ts`: largos 4000 y 10000; nota en blanco; casilla de consentimiento obligatoria. GREEN. RED en `pages/permisos.test.ts`: `puedeVerFicha` para los 3 roles y sin perfil. GREEN.
- [x] 5.3 (23 tests en `pages/ficha/consentimiento.test.ts`. RED real contra un esqueleto mínimo de `ficha.ts`: 16/16 fallaban por comportamiento, no por el import. Fechas independientes de la zona de la máquina: 6 casos con `process.env.TZ` en 5 zonas y un consentimiento nocturno, más corridas con `TZ` Tokio, Los Ángeles y UTC. Mutación hecha, ver nota. Anamnesis y notas entran como vistas de solo lectura; 5.4 y 5.5 agregan los formularios) RED: `pages/ficha/ficha.test.ts`, **consentimiento** (D4):
  - Sin consentimiento: texto literal y casilla; sin anamnesis ni notas en el DOM; sin `GET /ficha` ni `GET /notas`.
  - Registrar sin casilla → sin request.
  - Registro exitoso con la versión del servidor → carga ficha y notas.
  - Consentimiento existente → no pide el texto.
  - `400` → recarga el texto.
  - `409 CONSENTIMIENTO_REQUERIDO` posterior → vuelve a bloquear y descarta los datos.

  GREEN: `pages/ficha/consentimiento.ts` y `pages/ficha/ficha.ts`.
> **Nota de mutación (5.3, 2026-11-25).** Sobre `ficha.ts`, sin commitear, restaurado desde una copia en memoria:
> - **M1, sin el chequeo inicial** (carga ficha y notas aunque no haya consentimiento): fallan 9 tests. Entre ellos, `muestra el texto vigente…; anamnesis y notas no existen en el DOM`, `sin texto vigente (404) avisa y no ofrece la casilla` y `un 400…no carga datos clínicos`, que verifican con `sinDatosClinicos` que no existen las secciones ni los campos.
> - **M2, sin el re-bloqueo ante `409 CONSENTIMIENTO_REQUERIDO`**: fallan los 2 tests de la carrera (`obtenerFicha` y `listarNotas`), que verifican lo mismo.
> - **M3, sin la validación de la casilla al enviar**: falla `enviar sin la casilla no hace la request y marca el error`. Es el único camino posible, porque el botón está deshabilitado sin la casilla.
> - **M4, versión fija `'v1'` en vez de la del servidor**: fallan 2 tests. Uno es `la versión enviada es la del texto recibido, aunque sea otra que v1`. El otro, `tras el 400, el nuevo registro manda la versión nueva del texto (v2)`, se agregó para que lo detecten dos tests.
>
> Los cuatro mutantes mueren. `ficha.ts` se restauró desde el commit (`git diff` vacío).
>
> **Orden acordado (2026-11-25):** `/pacientes/:id/ficha` se registra recién en 5.9, después de que pase la 5.7 (RECEPCION sin requests). Hasta entonces siguen vigentes los tests de C-12a 3.4 (`app.test.ts`, `routes.test.ts`) y 4.4 (`lista.test.ts`).

- [x] 5.4 (25 tests en `pages/ficha/anamnesis.test.ts`, con los ajustes de abajo; RED real 20/20 contra la vista de solo lectura de 5.3. Un 409 sin código no es `FICHA_DESACTUALIZADA`: mensaje genérico, sin "Cargar la versión actual". Un `409 CONSENTIMIENTO_REQUERIDO` al guardar vuelve al bloqueo) RED: **anamnesis** (D5, A-D5):
  - Primera carga con `version: null` y blancos → `null`.
  - Guardado con la `version` leída; tres estados de `embarazo`.
  - `409 FICHA_DESACTUALIZADA` conserva lo escrito y la `version`.
  - "Cargar la versión actual" con confirmación (aceptar y cancelar).
  - Errores por campo del servidor.

  GREEN: `pages/ficha/anamnesis.ts`.
> **Ajustes de la 5.4 pedidos por la persona (2026-11-25).**
> - **Dispose**: 2 tests nuevos.
>   - Tras un 409 con texto sin guardar, al salir no queda en la página ningún campo ni dato: lo escrito, la ficha, el paciente o las notas.
>   - Una recarga pendiente que llega después de salir no vuelve a pintar datos.
>
>   Los dos pasaron sin cambiar código: la limpieza ya funcionaba y quedan como protección.
> - **A-D5b, texto pegado de más de 4000**: con `maxlength`, el navegador cortaba en silencio. Ahora no hay atributo, se avisa en el momento con la cuenta y no se puede guardar.
>   - Tests: 3 en la anamnesis y 5 en `form.test.ts`. El test de `maxLength` de la 5.4 pasó a verificar la ausencia del atributo.
>   - Mutación: E1 (vuelve el `maxlength`) y E2 (sin aviso al tipear) mueren, cada uno con 2 tests.

> **Nota de mutación (5.4, 2026-11-25).** Sobre `anamnesis.ts`, sin commitear, restaurado desde una copia en memoria. Mueren los 5:
> - **M1, ante el 409 llama a `recargar()`**: fallan 4 tests. `recargar()` no llega a pedir nada porque `ocupado` sigue en `true`; en la práctica este mutante quita la UI del conflicto.
> - **M1b, ante el 409 pide la ficha y pisa el formulario**: fallan 5 tests, entre ellos `lo escrito se conserva y no se vuelve a pedir la ficha`.
> - **M2, no actualiza la `version` tras guardar**: fallan 2 tests (`guarda con la version leída y después usa la version nueva…` y la recarga confirmada).
> - **M3, "Cargar la versión actual" recarga sin confirmación**: fallan 2 tests (la confirmación previa y "Cancelar").
> - **M4, el 409 pone la `version` en `null`**: falla `no se pisa la version: un nuevo guardado vuelve a mandar la 3`.

- [x] 5.5 (20 tests en `pages/ficha/notas.test.ts`; RED real 17/20 contra la vista de 5.3. Los 3 que ya pasaban son el listado y "sin Ver más" con una página. También: deduplicación al pedir más tras crear una nota, "Ver más" deshabilitado mientras pide, 409 `CONSENTIMIENTO_REQUERIDO` al crear o pedir más → bloqueo, y texto de más de 10000 con aviso según A-D5b) RED: **notas** (D7):
  - Lista y "Ver más".
  - Nueva nota sin `turnoId`, que aparece primera.
  - `422 PROFESIONAL_NO_VINCULADO` conserva el texto.
  - Sin botones de editar ni borrar.
  - "Profesional #id".

  GREEN: `pages/ficha/notas.ts`.
> **Nota de mutación (5.5, 2026-11-25).** Sobre `notas.ts`, sin commitear, restaurado desde una copia en memoria. **Mueren los 10**:
> - N1: "Ver más" pide la misma página.
> - N2: la nota nueva va al final.
> - N3: el 422 borra lo escrito.
> - N4: el 422 muestra el mensaje genérico.
> - N5: no descarta duplicadas.
> - N6: "Ver más" siempre visible (2 tests).
> - N7: se envía el texto recortado.
> - N8: no se vacía el campo tras crear.
> - N9: sin protección de doble envío.
> - N10: tras un error, "Ver más" queda deshabilitado.
>
> Salvo N6, cada uno lo detecta un solo test.

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
  - **Pegado de texto largo (A-D5b), obligatorio a mano**: jsdom no reproduce el corte que hace el navegador al pegar con `maxlength`. Los tests solo verifican que el atributo no esté y que aparezca el aviso.
    - En Chrome, pegar en "Alergias" un texto de más de 4000 caracteres y en "Nueva nota" uno de más de 10000.
    - Verificar que el texto queda **completo** (no cortado), que aparece "Máximo N caracteres (hay M)." y que no se puede guardar hasta recortarlo.
  - Consentimiento y primera carga de la ficha.
  - 409 con dos pestañas.
  - Nota con el profesional del seed.
  - Paciente dado de baja en solo lectura.
  - Revisar las filas en `audit_log`.
  - RECEPCION sin ficha y sin requests.
- [ ] 7b.5 Handoff `knowledge-base/entrega/C-12.md` (cubre C-12a y C-12b). Deuda: autor por id, sin `version` en paciente, respuestas tardías no abortadas.
- [ ] 7b.6 Tras la verificación manual de la persona: `[x]` en `CHANGES.md` §C-12 con evidencia. Commit, push y PR solo con autorización (regla 10), avisando a integrante-1/2 (regla 12). Archivo del change y sincronización de specs después del merge de C-12b.
