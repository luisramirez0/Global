# Proposal

## Why

C-09 dejó en `main` la API de recordatorios (enlace `wa.me`, email por SMTP gratuito y listado de pendientes), pero la SPA no la usa: el odontólogo o la recepción no tienen cómo recordar un turno sin salir del sistema. C-14 cierra el Flujo 3 (KB 07) y las historias US-030/US-031 (KB 06) del lado del frontend, dentro del MVP y con presupuesto cero (solo `wa.me` + SMTP, sin API de WhatsApp).

## What Changes

- Cliente tipado `src/api/recordatorios.ts` para los tres endpoints reales de C-09 (`GET /api/turnos/{id}/recordatorio/whatsapp`, `POST /api/turnos/{id}/recordatorio/email`, `GET /api/turnos/pendientes-recordatorio?fecha=`), con decodificadores estrictos y validación del enlace (`https://wa.me/...`).
- Página nueva `#/recordatorios` (`src/pages/recordatorios/`): lista los turnos de mañana (o de la fecha elegida, en la zona del consultorio) sin recordatorio, con acciones "WhatsApp" y "Email" por turno.
- Acciones de recordatorio reutilizables (`src/components/agenda/`): el botón de WhatsApp pide el enlace solo ante un clic explícito y muestra un enlace "Abrir WhatsApp" que abre `wa.me` en pestaña nueva (`target="_blank"`, `rel="noopener noreferrer"`); deshabilitado con aviso si el paciente no tiene teléfono (o email, para el email). El email muestra estado (enviando, enviado) y errores diferenciados (`422`, `409`, `404`, `502`, `503`, `500`, red). Un `500`, timeout o error de red del email deja una marca en memoria de "envío sin confirmar" que mantiene "Email" deshabilitado para ese turno aunque se actualice la lista (el `502` sí permite reenviar).
- Desde la página, "Confirmar" y "Cancelar" (con motivo obligatorio) según la respuesta del paciente, reutilizando `TurnosApi.cambiarEstado` y las reglas de C-13.
- Las mismas acciones de recordatorio en el diálogo de acciones del turno de la agenda (C-13) para turnos `PROGRAMADO`/`CONFIRMADO`.
- Ítem "Recordatorios" en el menú para los tres roles operativos.
- Sin cambios en `backend/` ni en `db/migration`. Nada de C-17..C-22 ni servicios pagos.

## Capabilities

### New Capabilities
- `frontend-reminders`: pantalla y acciones de recordatorio de turnos en la SPA (cliente tipado de C-09, lista de pendientes, enlace `wa.me`, envío de email con estados y errores, confirmación/cancelación según la respuesta, contenido seguro y accesible).

### Modified Capabilities
- `frontend-agenda`: el diálogo de acciones del turno suma las acciones de recordatorio (WhatsApp y email) para turnos recordables.
- `frontend-shell`: el menú suma "Recordatorios" (`#/recordatorios`, protegida) para `ADMIN`, `PROFESIONAL` y `RECEPCION`.

## Impact

- Código: `frontend/src/api/` (`recordatorios.ts`, `types.ts`, `decoders.ts`, `__fixtures__/recordatorios.ts`), `frontend/src/pages/recordatorios/` (nuevo), `frontend/src/components/agenda/accionesRecordatorio.ts` (nuevo), `frontend/src/pages/agenda/accionesTurno.ts` y `agenda.ts` (cableado), `frontend/src/pages/context.ts`, `frontend/src/app.ts`, `frontend/src/router/routes.ts`, `frontend/src/test-support/pages.ts`.
- API consumida: solo la de C-09 tal como está en `main`; ningún endpoint nuevo.
- Dependencias: ninguna nueva.
- Governance BAJO (CHANGES.md). Datos de contacto: la UI nunca recibe teléfono ni email del listado (solo `tieneTelefono`/`tieneEmail`); el único dato de contacto que llega es el teléfono dentro del `enlace`, que no se loguea ni se guarda.
