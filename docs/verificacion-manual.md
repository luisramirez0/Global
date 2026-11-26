# Verificaciones manuales pendientes (para cerrar en el ensayo de la demo)

Junta lo que los handoffs de C-09 a C-15 dejaron sin verificar a mano contra el stack real (MySQL 8.4 + navegador).
Todo está cubierto por tests automáticos (H2 / jsdom); acá se confirma en el entorno real. Lo que ya cubre el smoke
(`scripts/smoke-e2e.sh`) dice "smoke": alcanza con que el smoke termine sin fallas.

Completar la columna "Resultado" con OK / FALLA + nota, la fecha y quién lo hizo. Si algo falla, anotarlo en
[bugs-conocidos.md](bugs-conocidos.md).

| # | Origen | Qué verificar | Cómo | Resultado / fecha / quién |
|---|---|---|---|---|
| V1 | C-09 (nunca verificado: Docker caído el 25/11) | WhatsApp: `200` con enlace, una fila `recordatorio` `WHATSAPP_LINK`/`GENERADO` y una `CREATE`/`Recordatorio` en `audit_log` | smoke + SQL: `SELECT canal, estado FROM recordatorio ORDER BY id DESC LIMIT 3;` | |
| V2 | C-09 | Email sin SMTP → `503` con `detalle_error = SMTP_NO_CONFIGURADO`; con SMTP inexistente → `502` y `SMTP_FALLO:<Clase>` | smoke (`503` con `SMTP_*` vacío) + SQL sobre `recordatorio` | |
| V3 | C-09 / C-06 | En los logs del backend **no** aparece `Connection is read-only` ni `AuditoriaFallidaException` | `docker compose logs backend \| grep -iE "read-only\|AuditoriaFallida"` → vacío | |
| V4 | C-09 | Pendientes: el turno con `GENERADO` deja de aparecer | smoke | |
| V5 | C-09 / C-15 | Logs sin teléfono, email, nombre, enlace ni texto clínico; solo ids | Revisar `docker compose logs backend` después del smoke y de la demo | |
| V6 | C-14 §6 | `#/recordatorios` con los turnos de mañana; "WhatsApp" abre `wa.me` en pestaña nueva; sin teléfono, deshabilitado; "Email" sin SMTP → "no disponible"; "Actualizar" saca el recordado; confirmar y cancelar desde la página; con los 3 roles | Navegador, datos de `demo-seed` | |
| V7 | C-13 §6 (task 8.5, `CHANGES.md` §C-13 sigue en `[ ]`) | Los 26 pasos del checklist de `knowledge-base/entrega/C-13.md` §6. Mínimo para la demo: 1, 3, 6, 7, 8, 10, 11, 13, 14, 16, 19, 20 y 23 | Navegador | |
| V8 | C-12b pasos 10-12 (A-D5b) | Pegar un texto de más de 4000 caracteres en la anamnesis: aviso "Máximo N caracteres (hay M)." y no se puede guardar (jsdom no reproduce el corte) | Navegador | |
| V9 | C-12b paso 9 | `409 FICHA_DESACTUALIZADA` con dos pestañas | Navegador | |
| V10 | C-12b pasos 17-19 / C-12a paso 17 | Paciente dado de baja: ficha en solo lectura; RECEPCION sin "Reactivar" | Navegador | |
| V11 | C-12b paso 24 / C-15 | Filas en `audit_log` de la ficha (`READ`/`CREATE`/`UPDATE`) y del export (`EXPORT` con detalle de conteos) | smoke (cantidad) + `SELECT accion, entidad, entidad_id, detalle FROM audit_log ORDER BY id DESC LIMIT 20;` | |
| V12 | C-15 / C-06 | Cada filtro de `GET /api/auditoria` contra MySQL (`desde`/`hasta`, `accion`, `entidad`, `entidadId`, `usuarioId`) | smoke (`entidad`+`accion`+`entidadId`) + `#/auditoria` con fechas y usuario | |
| V13 | C-15 | `403` del export con RECEPCION y `404` con un id inexistente | smoke con `SMOKE_DB=1` (`403`) y smoke (`404` entre consultorios) | |
| V14 | C-10 | Vencimiento de sesión (`JWT_EXPIRATION_MIN=1`) y `429` después de 5 fallos, **ahora con los segundos de `Retry-After` visibles** (C16-1) | Navegador; volver a dejar `JWT_EXPIRATION_MIN=30` | |
| V15 | C-16 | Frontend con `X-Content-Type-Options: nosniff`, MySQL solo en `127.0.0.1` | smoke; `docker compose ps` (columna PORTS) | |

## Cierre

- Responsable: ____________  Fecha: ____________
- Resultado: ☐ OK  ☐ OK con observaciones  ☐ FALLA (anotar #).
