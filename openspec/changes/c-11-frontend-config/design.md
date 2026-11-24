# Design

## Context

C-04 expone los cuatro recursos de configuración de agenda (handoff `knowledge-base/entrega/C-04.md`, spec `agenda-configuration`). C-10 dejó el cliente HTTP, la sesión, el router por hash, el layout, `h()` y los helpers de formulario (handoff `knowledge-base/entrega/C-10.md`). C-11 agrega solo frontend. Decisiones D1–D9 aprobadas por la persona (Integrante 4) el 2026-11-24, con cuatro verificaciones pedidas (marcadas **V-D3**, **V-D4**, **V-D7**, **V-D8**).

## Decisions

### D1 — Ubicación del código
- Cliente en `src/api/agendaConfig.ts` (`createAgendaConfigApi(http)`), tipos en `src/api/types.ts` y decodificadores en `src/api/decoders.ts` (reutilizan `obj`/`id`/`str`). El nombre evita chocar con `src/api/config.ts` (URL base).
- Páginas en `src/pages/config/`: una por recurso más `crudPage.ts` (estructura común: listado, formulario, confirmación de borrado, estado), `nav.ts`, `permisos.ts`, `validacion.ts` y `mensajes.ts`.
- `PageContext` gana `agenda: AgendaConfigApi`; `app.ts` lo crea con el mismo `http`.
- `components/form.ts`: `FormControl` (interfaz mínima que usa `applyFieldErrors`) y `createSelectField`; `FieldOptions.type` admite `time` y `datetime-local` e `inputmode` opcional. Cambios aditivos: login y registro no cambian.

### D2 — Rutas
`/config/sillones`, `/config/prestaciones`, `/config/horarios`, `/config/bloqueos`, protegidas. Un ítem "Configuración" en `NAV_ITEMS` → `#/config/sillones`. Cada página muestra una navegación secundaria etiquetada ("Configuración") con `aria-current="page"` en la sección actual.

### D3 — Permisos en la UI
- `puedeGestionar(rol)` = `ADMIN | PROFESIONAL`; `puedeBorrarBloqueo(rol)` = `ADMIN | PROFESIONAL`; `puedeEditarBloqueo(rol)` = los tres roles. Sin perfil → sin permisos (solo lectura).
- **V-D3**: para `RECEPCION`, en sillones, prestaciones y horarios **no se crea el `<form>`** (ni sus campos) ni los botones de fila; se muestra un aviso de solo lectura. En bloqueos se renderiza el formulario y "Editar", pero no "Eliminar".
- El backend sigue autorizando: un 403 se muestra con un mensaje fijo.

### D4 — Zona horaria
- Constante única `ZONA_CONSULTORIO = 'America/Argentina/Buenos_Aires'` en `src/utils/zonaHoraria.ts` (valor por defecto de `consultorio.zona_horaria`; `/me` no la expone).
- Conversión con `Intl.DateTimeFormat({ timeZone, hourCycle: 'h23' })`: `aInstanteUtc(fecha, hora)` calcula el offset de la zona para ese instante (dos pasadas, por si la zona tuviera horario de verano) y `aFechaHoraLocal(iso)` descompone un instante en fecha y hora de la zona. Nunca se usan `getHours()`/`setHours()` ni el parseo de fechas locales de `Date`.
- **V-D4**: los tests corren las mismas conversiones con `process.env.TZ` = `UTC`, `Asia/Tokyo`, `America/Los_Angeles`, `Europe/Madrid` y la de Argentina (verificando que el offset local del proceso efectivamente cambió) y cubren 21:00–23:59 AR, que en UTC cae al día siguiente (y el cambio de año).

### D5 — Profesional
No hay `/api/profesionales`. Horarios: el alta omite `profesionalId` (el backend lo resuelve con un único profesional activo); la edición reenvía el del registro. Un 422 se muestra como "No se pudo asignar el profesional…". Bloqueos: el alcance se elige entre "Todo el consultorio" y cada sillón; un `profesionalId` existente se muestra y se reenvía sin cambios al editar.

### D6 — Validación
Mismas reglas que el backend: sillón `nombre` 1..100, prestación `nombre` 1..150 (tras `trim`, largo en unidades UTF-16 como `@Size`), `duracionMinutos` entero > 0, múltiplo de `GRILLA_MINUTOS` (= 15, provisional PA-03, única constante del frontend) y ≤ 2³¹−1; horario `diaSemana` 1..7, `HH:mm` alineadas a la grilla, `horaDesde < horaHasta`; bloqueo `inicio`/`fin` obligatorios, `fin > inicio`, `motivo` ≤ 255 bytes UTF-8 (vacío → no se envía). Errores del servidor por campo con `serverFieldErrors` + `applyFieldErrors`; los que no tienen campo visible van al resumen.

Mensajes fijos por contexto, nunca el `detail` ni datos del usuario: 409 en alta/reactivación de sillón → límite de 2 activos; 409 en baja/desactivación → debe quedar uno activo; 409 en horarios → franja superpuesta; 404 → "ya no existe" y recarga; 422 → referencia inválida.

### D7 — Bajas y reactivación
Confirmación en la misma fila en dos pasos ("Eliminar"/"Dar de baja" → "Confirmar" + "Cancelar", foco en "Confirmar"); sin `window.confirm`. Sillones y prestaciones: casilla "Mostrar inactivos" (`incluirInactivos` / `incluirInactivas`) y botón "Reactivar" = `PUT` con los datos actuales y `activo: true`. La edición normal omite `activo` (el backend lo deja igual).

**V-D7** (2026-11-24): verificado por lectura de código que el `PUT` persiste `activo: true` — `SillonService.actualizar` resuelve `destino = request.activo()` y `cambiarActivo` lo asigna tras validar el límite; `PrestacionMapper.apply` asigna `activo` si no es nulo; ambos con `saveAndFlush` en `@Transactional`. El backend no tiene un IT del caso exitoso (solo `reactivatingBeyondTheLimitIs409AndItStaysInactive`); se corrió un IT temporal (sin commitear) en `gradle:8.14-jdk21`: 3/3 (ver handoff).

### D8 — Listado de bloqueos
Filtro "Desde" (fecha, por defecto **hoy en Argentina**) y "Hasta" (opcional, inclusivo). `desde` = 00:00 AR de esa fecha en UTC; `hasta` = 00:00 AR del día siguiente (el backend lo trata como exclusivo por intersección).
**V-D8**: "hoy" se calcula con `hoyEnZona(Date.now())` en la zona del consultorio; a las 23:30 AR (02:30 UTC del día siguiente) sigue siendo el día AR.

### D9 — Edición
Un formulario por sección. "Editar" lo carga, cambia el título a "Editar …", el botón a "Guardar cambios" y agrega "Cancelar edición". `PUT` es reemplazo completo. Tras cada operación exitosa se recarga el listado y se anuncia un mensaje en una región `role="status"`.

## Risks / Trade-offs

- Zona fija: un consultorio con otra `zona_horaria` vería horas corridas. Mitigación: constante única; exponer la zona en `/me` queda como pendiente de backend.
- Sin elegir profesional: con más de un profesional activo, el alta de horarios responde 422 (mensaje claro). Aceptable para odontólogo independiente (MVP).
- La grilla (15) se duplica entre backend y frontend; si PA-03 la cambia hay que editar ambas constantes.
- Respuestas tardías tras `dispose` se ignoran (mismo criterio que C-10).
