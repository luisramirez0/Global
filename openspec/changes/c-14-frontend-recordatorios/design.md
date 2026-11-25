# Design

## Context

Motivación en `proposal.md`. Requisitos en `specs/frontend-reminders`, `specs/frontend-agenda` y `specs/frontend-shell`.

**Contrato real de C-09 en `main`** (`backend/src/main/java/ar/global/odonto/recordatorio/RecordatorioController.java`, handoff `knowledge-base/entrega/C-09.md` §Contrato para C-14). Todos con `Authorization: Bearer`, `@PreAuthorize(Permisos.OPERACION)` = `hasAnyRole('ADMIN','PROFESIONAL','RECEPCION')`; sin token o token inválido → `401`.

| Endpoint (base `/api`; el cliente usa rutas relativas `/turnos/...`) | Éxito | Cuerpo (record Java) |
|---|---|---|
| `GET /api/turnos/{id}/recordatorio/whatsapp` | `200` | `EnlaceWhatsAppResponse(Long recordatorioId, String enlace, Instant generadoEn)` |
| `POST /api/turnos/{id}/recordatorio/email` (sin cuerpo) | `201` | `RecordatorioEmailResponse(Long recordatorioId, EstadoRecordatorio estado, Instant enviadoEn)`; `estado` = `ENVIADO` |
| `GET /api/turnos/pendientes-recordatorio?fecha=YYYY-MM-DD` (opcional; sin `fecha` = mañana en la zona del consultorio) | `200` | `List<TurnoPendienteResponse(Long turnoId, Instant inicio, Instant fin, EstadoTurno estado, PersonaResponse paciente, PersonaResponse profesional, boolean tieneTelefono, boolean tieneEmail, UltimoRecordatorioResponse ultimoRecordatorio)>` con `PersonaResponse(Long id, String nombre, String apellido)` y `UltimoRecordatorioResponse(CanalRecordatorio canal, EstadoRecordatorio estado, Instant generadoEn)` (nulo si no hay). **En este listado `ultimoRecordatorio` solo puede ser `null` o tener `estado` `ERROR`**: los turnos con `GENERADO`/`ENVIADO` quedan excluidos |

Enums: `CanalRecordatorio` = `WHATSAPP_LINK` | `EMAIL`; `EstadoRecordatorio` = `GENERADO` | `ENVIADO` | `ERROR`; `EstadoTurno` (C-07). Orden del listado: `inicio, turnoId`. Un turno con recordatorio `GENERADO`/`ENVIADO` deja de aparecer en pendientes.

Errores (`ApiExceptionHandler`, `application/problem+json`, sin datos del paciente):

| Status | Causa | Forma |
|---|---|---|
| `400` | `fecha` mal formada | genérico, sin eco |
| `404` | turno inexistente o de otro consultorio | genérico |
| `409` | turno no `PROGRAMADO`/`CONFIRMADO` (`ConflictoException`) | sin `conflicto` |
| `422` | falta contacto (`ReferenciaInvalidaException`) | `title` "Referencia inválida", `errores: [{campo: "telefono" \| "email", mensaje: "referencia inválida"}]` |
| `502` | falla SMTP (`EnvioEmailFallidoException`) | "No se pudo enviar el email"; queda recordatorio `ERROR` |
| `503` | SMTP no configurado (`EmailNoConfiguradoException`) | "Envío de email no disponible"; queda recordatorio `ERROR` |
| `500` | falla de auditoría o turno desaparecido durante el envío | genérico; **el email pudo haber salido** y **no queda registro**: `RecordatorioEmailService.persistir()` guarda recordatorio + auditoría en una sola transacción que se revierte, así que el turno **sigue apareciendo** en pendientes |

El `GET` de WhatsApp **no es idempotente ni seguro**: cada llamada registra un `Recordatorio` `WHATSAPP_LINK`/`GENERADO` y una fila de auditoría. Es `GET` por contrato de KB (Flujo 3) y CHANGES.md (Javadoc del controlador). Caché: Spring Security conserva sus encabezados por defecto (`Cache-Control: no-cache, no-store, max-age=0, must-revalidate`) y todo pedido lleva `Authorization`; `api/http.ts` no reintenta. No hay prefetch ni service worker.

**Frontend existente (C-10/C-13/C-15)**: `api/http.ts` (`HttpClient.request(method, path, {decode, body})`, timeout 15 s, `ApiError` con `kind`/`status`/`fieldErrors`), `api/errors.ts` (`422` → `kind: 'validation'` con `fieldErrors`; `404` → `kind: 'unexpected'` con `status` 404; `5xx` → `server`), `api/rutas.ts` (`conId`, `conQuery`), `api/decoders.ts` (`obj`, `id`, `listOf`, `esInstanteIso`), `pages/context.ts` (`PageContext`), `router/routes.ts` (`ROUTES`, `NAV_ITEMS`), `components/agenda/dialogo.ts` (`abrirDialogo`), `pages/agenda/accionesTurno.ts` (`abrirAccionesTurno`, `OpcionesAcciones`), `pages/agenda/dominio/` (`transiciones`, `validacion.validarMotivoCancelacion`, `rechazos.clasificarRechazo`, `formato.horaLocal`/`nombrePaciente`), `utils/zonaHoraria.ts` (`ZONA_CONSULTORIO`, `hoyEnZona`, `siguienteDia`), `utils/dom.ts` (`h`), `test-support/pages.ts` (`createTestContext`, mocks tipados con `vi.fn`).

## Goals / Non-Goals

**Goals:**
- Consumir el contrato de C-09 tal cual, sin cambios de backend.
- Una sola implementación de las acciones de recordatorio, usada por la página y por el diálogo de la agenda.
- Nunca disparar el `GET` no idempotente sin un clic explícito.

**Non-Goals:**
- Recordatorios automáticos, programados o masivos ("recordar a todos").
- Ver el historial de recordatorios de un turno (no hay endpoint).
- Cambiar textos aprobados de C-13 (`pages/agenda/mensajes.ts`) o sus transiciones.
- API de WhatsApp, SMS ni nada de C-17..C-22.

## Decisions

### D1 — Cliente `RecordatoriosApi` en `src/api/recordatorios.ts`
`createRecordatoriosApi(http)` con `enlaceWhatsApp(turnoId)`, `enviarEmail(turnoId)` y `pendientes(fecha)`. Rutas con `conId('/turnos', id) + '/recordatorio/whatsapp'` y `conQuery('/turnos/pendientes-recordatorio', {fecha})`. Los tres pedidos se envían con `cache: 'no-store'` (defensa del lado del cliente para el `GET` no idempotente). Para eso `RequestOptions` de `api/http.ts` suma un campo **opcional** `cache?: RequestCache` que solo se copia al `RequestInit` si viene definido: sin él, el `init` queda idéntico al actual (mismas claves), así que el resto de los clientes no cambia. Tipos en `api/types.ts` (`EnlaceWhatsApp`, `RecordatorioEmail`, `TurnoPendiente`, `CanalRecordatorio`, `EstadoRecordatorio`), decoders en `api/decoders.ts`, fixtures en `api/__fixtures__/recordatorios.ts`. Se cablea en `PageContext.recordatorios`, `app.ts` y `RecordatoriosMock` en `test-support/pages.ts`.
*Alternativa*: sumar los métodos a `TurnosApi`. Rechazada: mezcla dos capacidades y obliga a tocar todos los mocks de C-13.

### D2 — El enlace se valida y se abre con un `<a>`, no con `window.open`
`decodeEnlaceWhatsApp` exige `new URL(enlace)` con `protocol === 'https:'` y `hostname === 'wa.me'`; si no, `ApiError('unexpected')`. Tras el `200` se renderiza `<a href=enlace target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>` y recibe el foco; la persona lo activa (Flujo 3, paso 3: "el usuario hace clic").
*Alternativa*: `window.open(enlace)` tras el `await`. Rechazada: los bloqueadores de pop-ups lo frenan (ya no es un gesto del usuario) y no se puede testear con fidelidad en jsdom. El `<a>` además permite reabrir el mismo enlace sin generar otro recordatorio.

### D3 — Pedido de WhatsApp solo por clic y sin duplicados
El botón lleva un flag `ocupado`; mientras dura el pedido está `disabled` + `aria-busy`. Ningún render, recarga ni apertura de diálogo llama a `enlaceWhatsApp` (test explícito: el mock tiene 0 llamadas tras montar). Pulsar "WhatsApp" otra vez después de tener el enlace sí genera otro recordatorio (es lo que dice C-09); el texto de ayuda lo aclara: "Cada enlace generado queda registrado." Un timeout del pedido de WhatsApp es ambiguo (el backend pudo haber registrado el enlace): se clasifica `whatsappIncierto` y el mensaje avisa que un nuevo clic puede crear otro registro; el botón vuelve a estar habilitado (un `GENERADO` duplicado no tiene efecto sobre el paciente).

### D4 — Clasificación de errores de recordatorio (pura)
`pages/recordatorios/dominio/rechazos.ts`: `clasificarErrorRecordatorio(error, canal)` → `sinTelefono` (`422` + campo `telefono`) | `sinEmail` (`422` + campo `email`) | `noRecordable` (`409`) | `noExiste` (`status` 404) | `smtpFallo` (`502`) | `smtpNoDisponible` (`503`) | `emailIncierto` (canal `EMAIL` con `500`, `timeout`, `network` o una respuesta ilegible/no decodificable: `ApiError('unexpected')` sin status (los decoders no lo completan) o con status `2xx`; el email pudo haber salido; en WhatsApp ese caso queda `desconocido`) | `whatsappIncierto` (canal `WHATSAPP_LINK` con `timeout`) | `prohibido` (`403`) | `conexion` (`network` en WhatsApp) | `desconocido`. Un `network` en el email se trata como incierto por precaución: el cliente no puede distinguir si el pedido llegó al servidor. Se decide por `kind`/`status`/`fieldErrors[].campo`, nunca por `title`/`detail`. Mensajes fijos en `pages/recordatorios/mensajes.ts` (textos del spec). `sinTelefono`/`sinEmail` deshabilitan el botón (mismo estado que `tieneTelefono: false`). `noRecordable` y `noExiste` ofrecen "Actualizar" (sin recarga automática, como C-13 D11). `smtpFallo` (`502`) **no** bloquea: el backend registró `ERROR`, no salió ningún email y el botón vuelve a habilitarse. `emailIncierto` **sí** bloquea (D11).
*Alternativa*: reutilizar `clasificarRechazo` de la agenda. Rechazada: sus casos son de turnos (solapamiento, bloqueo) y no distingue `502`/`503`.

### D5 — Componente compartido `components/agenda/accionesRecordatorio.ts`
`crearAccionesRecordatorio({turnoId, etiqueta, tieneTelefono, tieneEmail, api, sinConfirmar, alResultado})` devuelve un `HTMLElement` con los botones "WhatsApp" y "Email", la zona del enlace, los avisos (`aria-describedby`) y una región `role="status"` propia. `tieneTelefono`/`tieneEmail` son `boolean | null`: `null` = desconocido (diálogo de la agenda) → botón habilitado y el `422` lo resuelve. `alResultado` informa a la página (`whatsappGenerado` | `emailEnviado` | `emailSinConfirmar`) para actualizar el texto del ítem. Al montar consulta `sinConfirmar.enviado(turnoId)` (deshabilitado con "Recordatorio enviado por email.") y `sinConfirmar.tiene(turnoId)`: si está marcado, "Email" nace deshabilitado con el aviso de envío sin confirmar (D11). Vive en `components/agenda/` porque CHANGES.md fija ahí la zona de "acciones" y C-13 la declaró reutilizable.

### D6 — Diálogo de la agenda: sin pedir el paciente
`OpcionesAcciones` suma `recordatorios: Pick<RecordatoriosApi, 'enlaceWhatsApp' | 'enviarEmail'>`; `abrirAccionesTurno` agrega una sección "Recordatorio" con `crearAccionesRecordatorio({tieneTelefono: null, tieneEmail: null})` solo si `estado` es `PROGRAMADO`/`CONFIRMADO`. No se cierra el diálogo ni se llama a `alExito`/`alRecargar` (no hay cambio de turno). El foco tras generar el enlace queda en el `<a>` dentro del diálogo (el foco atrapado de `abrirDialogo` lo incluye: `a[href]` está en `ENFOCABLES`).
*Alternativa*: `pacientes.obtener(paciente.id)` al abrir para conocer teléfono/email. Rechazada: trae PII completa (DNI, dirección) solo para un booleano y suma un request por apertura. El `Turno` de C-07 no trae `tieneTelefono` (ver Riesgos).

### D7 — Página `#/recordatorios`
`pages/recordatorios/recordatorios.ts` (`renderRecordatorios(ctx): Page`). Fecha inicial = `siguienteDia(hoyEnZona(Date.now(), ZONA_CONSULTORIO))`, enviada siempre explícita (la UI muestra la misma fecha que pide; coincide con el default del backend). `<input type="date">` + "Actualizar"; fecha inválida → error en el campo sin request. Respuestas tardías descartadas por número de secuencia (patrón C-13). Lista `<ul>` con un `<li>` por turno: hora (`horaLocal`), `nombrePaciente`, profesional, `ETIQUETA_ESTADO`, aviso de último `ERROR`, acciones de recordatorio (D5) y "Confirmar"/"Cancelar". Al pulsar "Actualizar" (o cambiar de fecha) los ítems se vuelven a crear y cada uno vuelve a consultar `sinConfirmar`, por lo que un turno con envío sin confirmar reaparece con "Email" deshabilitado. La lista **no** se recarga sola tras un recordatorio: el ítem queda con "Recordatorio por WhatsApp generado." / "Recordatorio enviado por email." hasta "Actualizar", para que la persona pueda confirmar o cancelar en la misma sesión (el backend ya no lo devolvería como pendiente).

### D8 — Confirmar/cancelar desde la página
Usa `ctx.turnos.cambiarEstado` (C-13) directo, sin `abrirAccionesTurno` (que necesita el `Turno` completo y los sillones). "Confirmar" solo con `PROGRAMADO`; "Cancelar" abre `abrirDialogo` con un `textarea` validado por `validarMotivoCancelacion` (255 bytes UTF-8, C-13 D4). Errores con `clasificarRechazo(error, {accion: 'estado'})` + `mensajeRechazo` de la agenda (textos aprobados, reutilizados sin cambio). Éxito: estado local actualizado, anuncio con `MSG_TURNO_CONFIRMADO`/`MSG_TURNO_CANCELADO`; un turno cancelado oculta sus acciones de recordatorio. Respuestas posteriores (confirmar días después) siguen en el diálogo de la agenda de C-13.

### D9 — Navegación y roles
`ROUTES` suma `{ path: '/recordatorios', render: renderRecordatorios }`; `NAV_ITEMS` suma `{ path: '/recordatorios', label: 'Recordatorios' }` tras "Agenda", sin `roles` (los tres operativos). No hay ocultamiento por rol en la página: el backend permite `OPERACION`.

### D10 — Seguridad del frontend
Solo `h()`/`textContent` (regla 3), sin `any` (`unknown` + narrowing en decoders, regla 4). El `enlace` (contiene el teléfono) vive solo en el `href` del `<a>`: no se loguea, no va a `console`, `localStorage`, `sessionStorage` ni al hash. Un test espía `console.*` y revisa el almacenamiento (patrón del test `xss` de C-13).

### D11 — Registro en memoria de envíos de email sin confirmar
`pages/recordatorios/dominio/enviosSinConfirmar.ts`: `crearRegistroEnviosSinConfirmar()` → `{ marcar(turnoId), tiene(turnoId) }` sobre un `Set<number>` en memoria. Se crea una sola vez en `app.ts` y se expone como `PageContext.enviosSinConfirmar`, compartido por la página y el diálogo de la agenda. Ante `emailIncierto` el componente marca el `turnoId`, deshabilita "Email" con el aviso (`aria-describedby`) y llama `alResultado('emailSinConfirmar')`. La marca sobrevive a "Actualizar", al cambio de fecha y a reabrir el diálogo; se pierde solo al recargar el navegador. El mismo registro guarda además los envíos exitosos: `marcarEnviado(turnoId)` / `enviado(turnoId)` (segundo `Set<number>`). Tras un `201` "Email" queda deshabilitado con "Recordatorio enviado por email." por el resto de la sesión, también en el diálogo de la agenda, para evitar duplicados; son tres resultados distintos: éxito (`enviado`), incierto (`sinConfirmar`) y `502` (sin marca, reintento permitido). Guarda únicamente ids numéricos y **nunca** usa `localStorage`/`sessionStorage` (regla 5, D10). "WhatsApp" sigue disponible como alternativa. El registro suma `iniciarEnvio`/`terminarEnvio`/`enCurso(turnoId)`: el envío en vuelo se marca antes del `await` y se limpia siempre al resolverse (éxito, 502 o incierto), de modo que un ítem reconstruido durante el pedido (Actualizar, otra fecha, otra pantalla, diálogo reabierto) nace con "Email" deshabilitado, `aria-busy` y "Enviando email…" y no reenvía. Al resolverse, los ítems ya reconstruidos no se actualizan en vivo: reflejan el estado final en la próxima renderización (limitación aceptada). `limpiar()` vacía el registro al terminar la sesión (cierre manual, 401 o vencimiento, en `app.ts`). Un id inválido lo rechaza `conId` con un `Error` de programación antes de enviar: no es `ApiError` y nunca se marca como incierto.
*Alternativa*: confiar en el listado del backend. Rechazada: tras un `500` el backend revierte el registro y el turno vuelve como pendiente con "Email" habilitado, lo que invita a un email duplicado.
*Alternativa*: persistir en `sessionStorage`. Rechazada por la restricción explícita de la persona responsable y para no dejar rastros por turno en el navegador.

## Estructura

```
frontend/src/
├── api/recordatorios.ts (+ .test.ts), types.ts, decoders.ts, __fixtures__/recordatorios.ts
├── components/agenda/accionesRecordatorio.ts (+ .test.ts)
├── pages/recordatorios/
│   ├── recordatorios.ts (+ .test.ts)
│   ├── mensajes.ts
│   └── dominio/rechazos.ts, enviosSinConfirmar.ts (+ .test.ts)
├── pages/agenda/accionesTurno.ts, agenda.ts   (cableado, D6)
├── api/http.ts (+ http.test.ts)                (opción `cache`, D1)
├── pages/context.ts, app.ts, router/routes.ts, test-support/pages.ts
```

## Testing

Vitest + jsdom, API con `vi.fn` tipados y fixtures con el contrato real de C-09 (incluidos los `ProblemDetail` de `422`/`502`/`503`). Dominio puro sin DOM (D4). Fecha con `vi.setSystemTime` y `process.env.TZ` distinto del consultorio. No se levanta el stack (regla 9); `npm test`, `npm run lint`, `npm run typecheck`.

## Risks / Trade-offs

- [El `Turno` de C-07 no trae `tieneTelefono`/`tieneEmail`] → en el diálogo de la agenda el botón empieza habilitado y el `422` lo deshabilita con el aviso (D6). Agregar esos booleanos a `TurnoResponse` sería un cambio de backend **fuera de alcance**; queda anotado como mejora.
- [Pendientes excluye los turnos ya recordados] → la página conserva el ítem en memoria hasta "Actualizar" (D7); tras recargar, la confirmación posterior se hace desde la agenda. Un endpoint de "recordados" sería backend fuera de alcance.
- [`GET` no idempotente] → solo por clic (D3); reabrir usa el `<a>` existente; test con 0 llamadas al montar.
- [`500`/timeout/red del email con envío posiblemente hecho y sin registro en el backend] → marca en memoria por turno, "Email" deshabilitado aunque se actualice la lista y mensaje que desaconseja reenviar sin verificar (D4, D11). La marca se pierde al recargar el navegador: limitación aceptada; la solución de fondo (registrar `ENVIADO` aunque falle la auditoría, o un estado "incierto") es backend **fuera de alcance** y queda en el handoff.
- [Timeout de WhatsApp con enlace posiblemente generado] → mensaje que avisa del posible registro duplicado; reintento permitido (D3).
- [Dos clics para abrir WhatsApp: "WhatsApp" y luego "Abrir WhatsApp"] → desvío respecto de la ficha ("abre el enlace `wa.me` en pestaña nueva"), aceptado por la persona responsable por el bloqueo de pop-ups (D2); queda documentado en el handoff.
- [La zona del consultorio es la constante `ZONA_CONSULTORIO`] → misma suposición que C-13; si llega multi-zona, se cambia en `utils/zonaHoraria.ts`.
- [`accionesTurno.ts` es de C-13] → cambio aditivo (nueva opción y sección), sin tocar transiciones ni mensajes; los tests de C-13 deben seguir verdes.

## Migration Plan

Solo frontend, sin migraciones ni flags. Rollback = revertir el PR.
