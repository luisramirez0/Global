# Proposal

## Why

Con C-07 cerrado, el consultorio agenda turnos pero no tiene cómo recordárselos al paciente, que es la causa principal de ausentismo que el MVP quiere atacar (KB 01). C-09 está en el camino crítico (C-01 → C-02 → C-03 → C-04 → C-07 → **C-09** → C-14 → C-16) y desbloquea C-14 (pantalla de recordatorios). La tabla `recordatorio` y la entidad existen desde C-02 sin ninguna lógica. El presupuesto es cero: WhatsApp solo por enlaces `wa.me` (RN-CO-01) y email por SMTP gratuito (RN-CO-02).

## What Changes

- `GET /api/turnos/{id}/recordatorio/whatsapp` → `200 {recordatorioId, enlace, generadoEn}` con `enlace = https://wa.me/<dígitos E.164 sin +>?text=<mensaje codificado en UTF-8>`; registra un `Recordatorio` `GENERADO` (canal `WHATSAPP_LINK`). Es un `GET` con efecto lateral, mantenido por contrato de KB/CHANGES y documentado (US-030, Flujo 3).
- `POST /api/turnos/{id}/recordatorio/email` → envía por SMTP y registra `ENVIADO` (`201 {recordatorioId, estado, enviadoEn}`) o, si el SMTP falla, registra `ERROR` con un código fijo en `detalle_error` (`SMTP_FALLO:<Clase>`) y responde `502` genérico; si el SMTP no está configurado registra `ERROR` `SMTP_NO_CONFIGURADO` sin conectar y responde `503` genérico (US-031). Los handlers `502`/`503` viven en `common/web/ApiExceptionHandler` (zona compartida: review de integrante-1/2). El envío SMTP corre **fuera** de toda transacción.
- `GET /api/turnos/pendientes-recordatorio?fecha=YYYY-MM-DD` (por defecto, mañana en la zona del consultorio) → turnos `PROGRAMADO`/`CONFIRMADO` de ese día local sin recordatorio `GENERADO` ni `ENVIADO`, con indicadores `tieneTelefono`/`tieneEmail` y el último recordatorio si lo hubo (Flujo 3, paso 1).
- Reglas: solo turnos `PROGRAMADO`/`CONFIRMADO` (otro estado → `409`); paciente sin teléfono/email → `422` con el campo, sin eco de datos (RN-CO-03). Mensaje fijo con fecha, hora (zona del consultorio), consultorio y profesional; sin nombre del paciente, prestación ni datos clínicos (RN-CO-04).
- Auditoría `CREATE` `Recordatorio` con `{canal, estado}` vía `AuditService.registrar` en cada recordatorio persistido; ningún dato personal en el detalle ni en los logs.
- RBAC `Permisos.OPERACION` (ADMIN, PROFESIONAL, RECEPCION) y aislamiento por consultorio (turno ajeno → `404`).
- Configuración: dependencia `spring-boot-starter-mail`, nueva variable `SMTP_FROM`, puerto SMTP por defecto `587`; `.env.example` actualizado sin secretos.
- El email es el segundo ítem del orden de recorte del proyecto: queda en un grupo de tareas propio y separable, después de WhatsApp y pendientes.

## Capabilities

### New Capabilities
- `appointment-reminders`: generación de recordatorios de turnos por enlace `wa.me` y por email SMTP, listado de turnos pendientes de recordatorio, registro del recordatorio y su estado, mensaje sin datos clínicos, permisos, auditoría y aislamiento por consultorio.

### Modified Capabilities
- `runtime-configuration`: el requisito "Configuración por variables de entorno" suma `SMTP_FROM` y fija `587` como puerto SMTP por defecto.

`access-control` ya clasifica recordatorios como operación (`OPERACION`); `audit-log` ya admite la acción `CREATE` y define el detalle restringido; `tenant-isolation`, `appointment-scheduling` y `persistence-schema` no cambian.

## Impact

- **Código**: nuevo contenido en `recordatorio/` (dominio puro `MensajeRecordatorio` y `EnlaceWhatsApp`, servicio(s), `RecordatorioController`, DTOs, puerto `EnvioEmail` + adaptador SMTP). Métodos nuevos en `RecordatorioRepository` (JPQL portable). `TurnoController` no se toca.
- **Esquema**: **ninguna migración nueva**. V2 ya tiene `recordatorio` con FK compuesta a `turno`, `CHECK` de canal y estado y `detalle_error VARCHAR(500)`; `AccionAuditoria.CREATE` ya existe en el `CHECK` de `audit_log`.
- **Dependencias**: `spring-boot-starter-mail` (gratuita, gestionada por el BOM de Spring Boot).
- **Configuración**: `application.yml` (`SMTP_FROM`, puerto por defecto `587`), `.env.example`; `docker-compose.yml` ya pasa `.env` al backend con `env_file` (se verifica, sin cambios si no hace falta).
- **Consumidores**: C-14 (frontend de recordatorios), C-15 (filas `Recordatorio` en `audit_log`).
- **Zona de revisión (regla 12)**: maneja PII (teléfono, email) y secretos SMTP y consume la auditoría → se avisa a integrante-1/2 en el PR.
- **Fuera de alcance**: envío automático o programado (scheduler), confirmación del paciente por respuesta, WhatsApp Business API o SMS (regla 11), plantillas configurables, reintentos automáticos de email, HTML en el email, frontend (C-14), C-17..C-22.
