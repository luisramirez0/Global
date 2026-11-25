# Proposal

## Why

El motor de turnos ya existe en el backend (C-07, PR #17): alta sin solapamiento, sobreturno auditado, máquina de estados y reprogramación, todo bajo `/api/turnos`. Pero no hay pantalla: el odontólogo y la recepción no pueden ver su jornada ni operar turnos sin llamar a la API a mano. C-13 cubre US-010 (agenda diaria/semanal por sillón con estado por color), US-011 (crear turno con feedback de conflictos y sobreturno explícito) y US-012 (confirmar, cancelar con motivo, reprogramar, asistió/ausente) en el frontend. Está en el camino crítico (C-07 → C-13 → C-14) y nunca se recorta entero.

Governance MEDIO: opera turnos (datos de agenda con nombre del paciente) pero no muestra datos clínicos ni toca auth, auditoría ni consentimiento. La auditoría la hace el backend (C-07 registra con `AuditService.registrar` cada alta, cambio de estado y reprogramación; ningún método `@Audited` usa `@Transactional(readOnly = true)`, verificado por `TurnoTransaccionesArchTest`). C-13 es solo frontend: sin cambios en `backend/` ni en `db/migration`.

## What Changes

- **Cliente tipado de turnos** (`src/api/turnos.ts`): listar por rango, obtener, crear, cambiar estado y reprogramar, con el contrato real de C-07 y decodificadores estrictos.
- **Cliente mínimo de pacientes** (`src/api/pacientes.ts`): `buscar(q, página)` y `obtener(id)` sobre `/api/pacientes`, diseñado para que C-12 lo extienda (alta/edición/baja) sin duplicarlo.
- **`ApiError` con detalle de conflicto** (aditivo): campos opcionales `conflicto` (409 de solapamiento, con `motivo` `SILLON`/`PROFESIONAL`) y `bloqueoId` (422 fuera de agenda), decodificados de forma segura. Los mensajes siguen siendo fijos.
- **Página `#/agenda`** (`src/pages/agenda/`, `src/components/agenda/`): vista diaria (columnas por sillón) y semanal (columnas por día) con filtro de sillón, navegación de fechas, franja visible según horarios de atención que se expande para incluir todo turno del rango, bloqueos sombreados, cancelados ocultos con interruptor, color + etiqueta por estado, marca de sobreturno y lista accesible equivalente.
- **Diálogo de turno** (`<dialog>` nativo accesible): alta con búsqueda de paciente, prestación, sillón, fecha y hora; manejo de 400/404/409/422 con mensajes fijos clasificados por estado HTTP y datos tipados (nunca por `title`), sin recarga automática ante errores (botón manual "Recargar agenda"); ofrecimiento de sobreturno con confirmación explícita solo cuando el backend lo admite (choque de profesional o fuera de agenda) y nunca a `RECEPCION` mientras siga abierta DP-2.
- **Aviso previo con varios profesionales** (DP-1, opción A aprobada el 2026-11-24): si los horarios cargados tienen más de un `profesionalId` distinto, aviso persistente en `role="status"` y "Nuevo turno" deshabilitado con la explicación; *fallback* con mensaje fijo ante `422` `profesionalId` que conserva todos los datos del diálogo.
- **Navegación por teclado**: *roving tabindex* en la grilla (flechas, Inicio/Fin, Enter), Tab secuencial en la lista accesible, acciones del diálogo alcanzables con Tab y motivo de deshabilitado anunciado.
- **Precarga del siguiente turno** (aprobada el 2026-11-24): "Nuevo turno" con un turno enfocado en la vista actual precarga su fecha, su sillón y su hora de fin, siempre editable y sin envío automático, con un aviso no bloqueante (ocupada, fuera de horario, bloqueada o fuera de grilla) calculado con los datos ya cargados; nunca una precarga obsoleta (`precargaNuevoTurno`, `avisoHoraSugerida`).
- **Foco determinista tras un cambio** (aprobado el 2026-11-24): si el turno sigue en la vista, el foco vuelve a él en su nueva posición; si salió, va al vecino más cercano de su posición original (siguiente, anterior, columna adyacente, grilla), sin navegar a otra fecha, y `role="status"` anuncia adónde fue (`focoTrasCambio`).
- **Acciones de estado**: solo las transiciones válidas para el estado actual; cancelar exige motivo (≤ 255 bytes UTF-8); asistió/ausente deshabilitados para turnos futuros; reprogramar por formulario (fecha, hora, sillón).
- **Shell**: `#/agenda` pasa a ser la ruta de inicio (`HOME_PATH`) y entra al menú; redirección explícita `#/inicio` → `#/agenda` en el router (`redirects`, con `replaceState` y sujeta al guard); la página provisoria de inicio se retira.
- **Extensiones compartidas** (aditivas): `PageContext.turnos` y `PageContext.pacientes`, grilla provisional compartida (`GRILLA_MINUTOS`) en un módulo común, `utf8Length` en un util compartido, estilos de estado en `styles.css`, mocks en `test-support/pages.ts`.

## Out of scope

- Cambios de backend o migraciones (incluidos un `/api/profesionales` y exponer la zona del consultorio en `/me`).
- Crear pacientes desde el diálogo de turno (lo cubre C-12 en su pantalla), enlace a la ficha clínica desde la agenda (PA-07: `RECEPCION` recibiría 403), selector de profesional, edición de `notas` de un turno existente, drag & drop.
- Recordatorios `wa.me`/email (C-14), diseño visual definitivo (diferido) y C-17..C-22 (lista de espera, reserva online, seña, recall).

## Dependencias y decisiones abiertas

- **DP-1 — Varios profesionales activos (resuelta: opción A, aprobada por la persona el 2026-11-24)**: el MVP tiene un único profesional por consultorio (`RegistroService`; sin API de profesionales; KB 01/03/04/06, DD-01) y el backend responde `422` `profesionalId` si no hay exactamente uno activo. Opción A: aviso previo por horarios en `role="status"` + "Nuevo turno" deshabilitado con explicación + *fallback* al enviar con mensaje fijo y datos conservados, sin cambio de backend. B (`GET /api/profesionales` + selector) queda como backlog post-MVP; C (solo mensaje al enviar) fue rechazada. Ver design.
- **DP-2 — Sobreturno por `RECEPCION` (pregunta abierta para el product owner)**: el backend lo permite a los tres roles; hasta confirmarlo, la UI no se lo ofrece a `RECEPCION` (resguardo de UI, no control de seguridad).

- **C-12 (`frontend-pacientes-ficha`, Integrante 5, pendiente)**: todavía no existe cliente de pacientes. C-13 crea el módulo mínimo de lectura; C-12 le agrega `crear`/`editar`/`baja` en el mismo archivo y reutiliza la misma clave `PageContext.pacientes`. Coordinar con Integrante 5 antes de mergear para no duplicar el cliente.
- **Desfase de +3 h en `horario_atencion` (hallazgo de C-07)**: en MySQL las horas se guardan corridas según la zona de la JVM y la app las relee consistentes. Si la JVM cambia de zona, la franja visible de la agenda y la validación de horario del backend se correrían 3 h. No se corrige en C-13 (zona C-02/C-04); se deja registrado en el handoff.

## Capabilities

### New Capabilities
- `frontend-agenda`: cliente de turnos, página de agenda (vistas, filtro, franja, estado, posición por duración), alta con conflictos y sobreturno, precarga del siguiente turno con aviso no bloqueante, foco determinista tras cambios, acciones de estado, reprogramación, zona horaria, contenido seguro y accesibilidad.

### Modified Capabilities
- `frontend-api-client`: errores tipados con detalle de conflicto (`conflicto`, `bloqueoId`) y cliente tipado de lectura de pacientes, compartido con C-12.
- `frontend-shell`: `#/agenda` como ruta de inicio y en el menú; redirección explícita de `#/inicio` a `#/agenda`.

## Impact

- Código: `frontend/src/api/{turnos,pacientes,types,decoders,errors}.ts` y fixtures, `frontend/src/pages/agenda/`, `frontend/src/components/agenda/`, módulo compartido de grilla y `utf8Length`, y extensiones menores en `frontend/src/{app.ts,pages/context.ts,router/router.ts,router/routes.ts,test-support/pages.ts,styles.css}` (`router.ts` gana `redirects` opcional, aditivo). Se borra `frontend/src/pages/inicio/`.
- Sin cambios en `backend/` ni en `db/migration`. Sin dependencias nuevas.
