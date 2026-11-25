# Proposal

## Why

El backend ya administra pacientes (C-05, PR #9) y la historia clínica básica: consentimiento, anamnesis y notas (C-08, PR #13). Sin embargo, la recepción y el odontólogo solo pueden usarlos llamando a la API a mano. C-12 cubre US-020 (ABM de pacientes) y US-021 (ficha básica y anamnesis) en el frontend, y completa el Flujo 5 (abrir la ficha, verificar o registrar el consentimiento, consultar o editar la anamnesis y agregar una nota). Es parte del corte vertical mínimo: no se recorta (CHANGES.md, R-01).

**Governance ALTO** (regla 12): renderiza datos de salud y dispara el registro del consentimiento. El PR requiere review de integrante-1 (principal) o integrante-2 (suplente). El backend audita cada lectura y escritura (RN-DS-02). El frontend debe cumplir tres cosas: no generar lecturas innecesarias, no persistir ni filtrar datos clínicos, y no permitir cargar la ficha sin consentimiento.

## What Changes

- **Clientes tipados**:
  - `src/api/pacientes.ts`: buscar, obtener, crear, editar, dar de baja y reactivar.
  - `src/api/ficha.ts`: consentimientos, texto vigente, ficha y notas.
  - Tipos en `types.ts`; decodificadores en `decoders.ts`, incluido `Pagina<T>`.
  - Todo con el contrato real de C-05 y C-08, sobre el mismo `HttpClient` de C-10.
- **`ApiError`** (aditivo): expone `codigo` (`CONSENTIMIENTO_REQUERIDO`, `FICHA_DESACTUALIZADA`, `PACIENTE_INACTIVO`, `PROFESIONAL_NO_VINCULADO`) y `pacienteId` (el 409 de DNI duplicado). Un código desconocido se muestra con un mensaje genérico fijo.
- **Router con parámetros** (aditivo): segmentos `:id` que solo aceptan enteros positivos. Una ruta con un id inválido (`/pacientes/abc`, `/pacientes/-1`) se trata como desconocida y no hace ninguna request. Las rutas exactas existentes y sus tests no cambian.
- **Pantallas**:
  - `#/pacientes`: lista, búsqueda por nombre o DNI, inactivos, paginación, baja y reactivación.
  - `#/pacientes/nuevo` y `#/pacientes/:id`: alta y edición, y el 409 por DNI duplicado con "Ver paciente existente".
  - `#/pacientes/:id/ficha`: consentimiento con casilla explícita, anamnesis con control de versión y notas inmutables.
  - Ítem "Pacientes" en el menú.
- **Permisos en la UI**: `RECEPCION` busca, crea y edita, pero no ve baja, reactivación ni "Ficha". Si entra directo a la ficha, ve "Sin permiso" y no se hace ninguna request. El backend sigue autorizando.
- **Formularios** (aditivo en `components/form.ts`): `createTextAreaField` y `maxLength`. La validación del cliente replica la del backend, pero el backend es la fuente de verdad.
- **Seguridad DOM y datos**: solo `h()`/`textContent`; tests con contenido malicioso en cada campo clínico, personal y en el texto de consentimiento. Los datos clínicos nunca van a `localStorage`, `sessionStorage`, la consola, la URL, `document.title` ni `flash`.

## Out of scope

- Cambios de backend o migraciones (`git diff main -- backend` vacío). Entre ellos, un endpoint con nombres de profesionales y una columna `version` en `paciente`.
- Vincular notas a turnos (`turnoId`; lo hace C-13), exportación y vista de auditoría (C-15), revocación del consentimiento.
- Cambiar los supuestos PA-07 (RECEPCION sin ficha) y PA-08 (notas inmutables).
- Diseño visual definitivo (diferido) y C-17..C-22.

## Capabilities

### New Capabilities
- `frontend-patients`: cliente y pantallas de pacientes (búsqueda, alta, edición, baja, reactivación), permisos por rol y DNI duplicado.
- `frontend-clinical-record`: pantalla de ficha clínica (consentimiento previo, anamnesis con versión, notas), restricción por rol y manejo seguro de datos de salud en el navegador.

### Modified Capabilities
- `frontend-shell`: rutas con parámetro numérico e ítem de navegación "Pacientes".
- `frontend-api-client`: `ApiError` con `codigo` y `pacienteId`.

## Impact

- Código:
  - `frontend/src/api/`, `frontend/src/pages/pacientes/` y `frontend/src/pages/ficha/`.
  - Extensiones aditivas en `frontend/src/{router/router.ts,router/routes.ts,api/errors.ts,app.ts,pages/context.ts,components/form.ts,test-support/pages.ts,styles.css}`.
- Sin cambios en `backend/` ni en `db/migration`. Sin dependencias nuevas.
- Se implementa en dos partes revisables por separado: **C-12a** (pacientes, router, `ApiError`; sin la ruta ni el enlace de ficha) y **C-12b** (ficha clínica; cierra el change con handoff y `[x]`). Ver design §Partición.
