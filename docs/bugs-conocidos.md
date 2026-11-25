# Bugs conocidos, deuda y límites de la entrega (C-16)

Consolidado al 2026-11-25 desde los handoffs `knowledge-base/entrega/C-01.md` a `C-15.md` y la revisión de C-16. C-16
**no** los corrige: solo hace hardening e integración, sin features nuevas. "Responsable propuesto" es la ficha o zona
donde iría el arreglo; ninguno tiene una persona asignada todavía.

Impacto en la demo: 🔴 se puede ver en la demo (con un plan para evitarlo) · 🟡 no se ve con el guion · ⚪ solo afecta después del MVP.

## Corregido en C-16

| Id | Qué | Cómo |
|---|---|---|
| C16-1 | La SPA no podía leer `Retry-After` del `429`: el navegador oculta ese header en una respuesta de otro origen (:5173 → :8080). | CORS expone `Retry-After` (`CorsConfig`, `CorsPolicyIT`). |
| C16-2 | `spring.profiles.default: dev`: un arranque sin perfil activaba el seed y las credenciales de desarrollo. | Se quitó; compose fija `dev` (`ProfileDefaultsTest`). |
| C16-3 | MySQL publicado en todas las interfaces. | `127.0.0.1:3306`. |
| C16-4 | Frontend sin headers de seguridad. | `frontend/nginx/security-headers.conf`. |
| C16-5 | Sin instrucciones de ejecución ni datos de demo. | `README.md`, `scripts/demo-seed.{sh,ps1}`, `scripts/smoke-e2e.{sh,ps1}`, `docs/demo.md`. |

## Integración

| Id | Impacto | Qué pasa | Responsable propuesto |
|---|---|---|---|
| B-01 | 🔴 | **El export no está en la ficha del paciente**: solo se exporta desde `#/auditoria` (campo "número de paciente"). C-15 dejó el componente `createExportarPaciente` listo para montarlo y C-12 no lo montó. Se decidió dejarlo fuera de C-16. **Demo**: exportar desde `#/auditoria` con el id del paciente. | C-12 + C-15 (Integrantes 5 y 3), zona de riesgo (export). |
| B-02 | 🔴 | **Desfase de +3 h de `horario_atencion` en MySQL** (hallazgo de C-07): 09:00 local queda guardado como `12:00:00`. La app lo lee bien mientras la JVM no cambie de zona. Con el backend en Docker (UTC) y los datos cargados por el mismo backend, no se nota. **Demo**: no mezclar datos creados con `bootRun` (JVM en hora local) y con Docker sobre la misma base; partir de `down -v`. | C-02/C-04 (mapeo de `LocalTime`, ficha nueva). |
| B-03 | 🟡 | **No hay ABM de usuarios**: cada `POST /auth/register` crea un consultorio nuevo, así que RECEPCION y PROFESIONAL solo se consiguen registrando otra cuenta y cambiando el rol por SQL. Quedan en otro consultorio. **Demo**: `DEMO_RECEPCION=1` crea `recepcion@consultorio.local` en su propio consultorio, útil para mostrar el menú por rol y el `403`. | Post-MVP (ficha nueva, zona de riesgo de auth). |
| B-04 | 🟡 | **El seed de desarrollo (`DevDataSeeder`) no crea el profesional**: con el admin `admin@dev.local` el alta de turnos y de notas responde `422`. Por eso la demo usa un consultorio registrado por la API. | C-02 (seed). |
| B-05 | 🟡 | El diálogo de la agenda no conoce `tieneTelefono`/`tieneEmail`: "WhatsApp" nace habilitado y se deshabilita tras el `422`. En `#/recordatorios` sí se conocen. | C-07/C-09 (backend, ficha nueva). |
| B-06 | 🟡 | Un `500` del email revierte el recordatorio aunque el email haya salido. La marca "envío sin confirmar" vive solo en memoria. | C-09. |
| B-07 | 🟡 | Los `409` de turno (transición inválida, versión) llegan sin `codigo`; la UI muestra un mensaje genérico. | C-07 (código tipado). |
| B-08 | 🟡 | Sin `/api/profesionales`: con más de un profesional no se pueden crear turnos desde la UI (DP-1, opción A). El autor de las notas se muestra como "Profesional #id". | Post-MVP. |
| B-09 | 🟡 | `/me` no expone la zona horaria del consultorio: el front asume `America/Argentina/Buenos_Aires`. | C-03/C-04 + front. |
| B-10 | ⚪ | Al recargar con el token vencido se cae en el login sin el aviso "Tu sesión venció". | C-10 (mejora opcional). |

## Seguridad (deuda)

| Id | Impacto | Qué pasa | Responsable propuesto |
|---|---|---|---|
| D-01 | ⚪ | **Guard de `audit_log` por permisos de MySQL** (`GRANT SELECT, INSERT`, sin `UPDATE`/`DELETE`, separando el usuario de Flyway del de la aplicación). Hoy lo protege `AuditLogStatementInspector`, que no cubre JDBC directo. **Decisión de la persona (2026-11-25): queda como deuda; no se implementa en C-16.** | Ficha nueva (zona de riesgo de auditoría, review de integrante-1/2). |
| D-02 | ⚪ | **Sin Content-Security-Policy**: necesita `connect-src` con el origen de la API (que se fija al construir) y probarla en el navegador; sin esa prueba podría romper la demo. | Post-MVP (nginx). |
| D-03 | ⚪ | `X-Forwarded-For` y proxy: la IP de auditoría y del rate limit es la del socket. Detrás de un proxy hay que activar `server.forward-headers-strategy` (solo con proxy de confianza). En la demo local no hay proxy. | Despliegue (PA-06/PA-09). |
| D-04 | ⚪ | Sin revocación ni logout del lado servidor (token de 30 min); rate limit de login en memoria y por IP+email. | Riesgo aceptado en C-03. |
| D-05 | ⚪ | El healthcheck de MySQL pasa la contraseña de root por línea de comandos (`mysqladmin -p...`, visible en `docker inspect` dentro de la máquina). No se tocó para no arriesgar el arranque de la demo. | Compose (post-entrega). |
| D-06 | ⚪ | `.env.example` lista `SMTP_PORT` dos veces (no rompe nada; la segunda gana). Lo edita la persona. | Mantenimiento. |
| D-07 | ⚪ | Sin HTTPS (demo local). | Despliegue. |

## Calidad y tests

| Id | Impacto | Qué pasa | Responsable propuesto |
|---|---|---|---|
| Q-01 | ⚪ | `ProblemInstanceIT.foreignSillonIdIs404WithBlankInstanceAndNoIdInTheBody` puede fallar si el id del sillón contiene un "4" (el cuerpo trae el status 404). En la suite completa pasa. | C-04. |
| Q-02 | ⚪ | Falta un IT versionado del caso exitoso de reactivación de sillón y prestación por `PUT activo:true` (verificado con un IT temporal en C-11). | C-04. |
| Q-03 | ⚪ | Specs con referencias viejas a `#/inicio` (`frontend-auth-pages`, `frontend-session`, `frontend-shell`); siguen siendo correctas por la redirección a `#/agenda`. La D11 del design archivado de C-13 menciona un `404` que no ocurre (es `422`). | Cambio de specs aparte. |
| Q-04 | ⚪ | `zonaRechazo.ts` duplica lógica de `altaTurno.ts` (C-13, no unificado a propósito). | Refactor post-MVP. |
| Q-05 | ⚪ | El `docker run` con JDK 21 es el único camino para correr el backend en máquinas que solo tienen JDK 25/26 (Gradle 8.14). | Actualizar Gradle (post-entrega). |

## Decisiones de producto abiertas (no son bugs)

PA-03 (grilla de 15 min, duplicada en `GrillaAgenda.MINUTOS` y `GRILLA_MINUTOS`), PA-04 (plazo de conservación de la HC; hoy no hay purga), PA-07
(RECEPCION sin ficha), PA-08 (notas inmutables), DP-2 (sobreturno para RECEPCION: la UI no lo ofrece, el backend lo permite),
motivo de cancelación obligatorio en la UI y opcional en la API, recuperación de contraseña (pedida en C-10, fuera del roadmap)
y PDF del export (US-040, fuera del MVP).
