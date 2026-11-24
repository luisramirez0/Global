# Proposal

## Why

El backend ya administra sillones, prestaciones, horarios de atención y bloqueos (C-04, PR #7), pero el odontólogo solo puede usarlos llamando a la API a mano: no hay pantallas. Sin ellas la configuración del consultorio queda limitada al seed. C-11 cubre US-002 (configurar consultorio) y US-013 (bloquear agenda) en el frontend y deja la agenda (C-13) apoyada en datos que el usuario puede corregir.

Governance BAJO: no toca auth, auditoría, consentimiento ni datos de salud. Los endpoints de configuración no usan `@Audited` (la regla de C-06 sobre `@Transactional(readOnly = true)` no aplica: no hay cambios de backend). Es el cuarto ítem del orden de recorte (si falta tiempo, se usa el seed).

## What Changes

- **Cliente tipado** (`src/api/agendaConfig.ts`, tipos en `types.ts`, decodificadores en `decoders.ts`): CRUD de `/sillones`, `/prestaciones`, `/horarios-atencion` y `/bloqueos` con el contrato real de C-04, sobre el mismo `HttpClient` de C-10 (token, 401, errores tipados).
- **Pantallas** (`src/pages/config/`): `#/config/sillones`, `#/config/prestaciones`, `#/config/horarios` y `#/config/bloqueos`, con navegación interna entre las cuatro y un ítem "Configuración" en el menú principal. Cada una lista, da de alta, edita y borra (baja lógica con reactivación en sillones y prestaciones).
- **Validación en el cliente** equivalente al backend (nombre obligatorio y largo máximo, duración múltiplo de la grilla, horas `HH:mm` alineadas y ordenadas, `fin > inicio`, motivo ≤ 255 bytes UTF-8), errores por campo de la API y mensajes fijos para 403/404/409/422.
- **Permisos en la UI**: `RECEPCION` ve sillones, prestaciones y horarios sin formularios ni acciones; en bloqueos puede crear y editar pero no ve "Eliminar". El backend sigue autorizando.
- **Zona horaria**: los bloqueos se ingresan y muestran en hora de `America/Argentina/Buenos_Aires` y viajan en UTC, con una conversión independiente de la zona del entorno.
- **Extensiones compartidas de C-10** (aditivas): `PageContext.agenda`, `createSelectField` y `FormControl` en `components/form.ts`, rutas y `NAV_ITEMS`, contexto de test.

## Out of scope

- Cambios de backend o migraciones (incluido exponer la `zona_horaria` del consultorio y un `/api/profesionales`).
- Elegir profesional en horarios y bloqueos (se conserva el que ya tiene el registro).
- Editar datos del consultorio (nombre, CUIT), diseño visual definitivo (diferido) y C-17..C-22.

## Capabilities

### New Capabilities
- `frontend-agenda-config`: cliente y pantallas de configuración de agenda (sillones, prestaciones, horarios, bloqueos), permisos por rol en la UI y conversión de zona horaria.

### Modified Capabilities
- `frontend-shell`: nuevas rutas protegidas de configuración y su ítem de navegación.

## Impact

- Código: `frontend/src/api/`, `frontend/src/pages/config/`, `frontend/src/utils/zonaHoraria.ts`, y extensiones menores en `frontend/src/{app.ts,pages/context.ts,router/routes.ts,components/form.ts,test-support/pages.ts,styles.css}`.
- Sin cambios en `backend/` ni en `db/migration`. Sin dependencias nuevas.
