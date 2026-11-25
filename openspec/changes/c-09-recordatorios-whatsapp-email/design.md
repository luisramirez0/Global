# Design

## Context

- Motivación y alcance: `proposal.md`. Requisitos: `specs/appointment-reminders/spec.md` y el delta de `specs/runtime-configuration/spec.md`.
- C-02 dejó `recordatorio/Recordatorio` (`TenantEntity`, `turno` LAZY, `canal`, `estado`, `generadoEn`, `enviadoEn`, `detalleError` ≤ 500), `CanalRecordatorio {WHATSAPP_LINK, EMAIL}`, `EstadoRecordatorio {GENERADO, ENVIADO, ERROR}` y `RecordatorioRepository` vacío. V2 (`V2__pacientes_turnos_auditoria.sql`) ya tiene la tabla con FK compuesta `(consultorio_id, turno_id) → turno` y los `CHECK` de canal/estado. Ya existe `RecordatorioRepositoryTest` (tests de esquema de C-02): los tests nuevos van en clases nuevas para no mezclarlos.
- C-07: `agenda/Turno` con `inicio`/`fin` `Instant` UTC, `EstadoTurno`, `paciente` y `profesional` LAZY; `TurnoController` en `/api/turnos` con `GET /{id}`. C-05: `Paciente.telefono` E.164 o `null` (validado por `paciente/abm/TelefonoE164`), `email` nullable. C-04: `Consultorio.nombre`, `zonaHoraria` (default `America/Argentina/Buenos_Aires`).
- C-06 (handoff): `AuditService.registrar(accion, entidad, entidadId, DetalleAuditoria)` es `@Transactional(MANDATORY)`; detalle con valores `long|boolean|Enum|codigo` (`^[A-Za-z0-9_.:-]{1,40}$`); **regla 5: un método auditado no puede ser `readOnly`** (MySQL rechaza el `INSERT`, H2 no lo detecta). `AccionAuditoria.CREATE` ya existe y está en `ck_audit_log_accion`.
- C-15 (handoff): patrón `TransactionTemplate` propio, explícitamente `REQUIRED` y no `readOnly`, para auditar fuera de un `@Transactional` de método.
- `common/web/ApiExceptionHandler`: `ValidacionException` → 400, `ConflictoException` → 409, `ReferenciaInvalidaException(campo)` → 422 con `errores[{campo}]`, `RecursoNoEncontradoException` → 404; nunca eco de valores. Tenant por `@TenantId` en `TenantEntity`: un turno ajeno no se encuentra → 404.
- Infraestructura: bean `Clock` (`config.ClockConfig`) y `testsupport.TestClockConfig.MutableClock`; `AuthFlows`, `TestTokens`, `TenantFixtures`, `DomainFixtures`, `@PersistenceTest`, `ApiCalls`; captura de logs con `OutputCaptureExtension` (patrón de `FichaLogsIT`).
- `spring-boot-starter-mail` **no** está en `backend/build.gradle`; `application.yml` ya mapea `spring.mail.*` a `SMTP_HOST/PORT/USER/PASSWORD` con defaults vacíos y no tiene remitente. No hay actuator (el starter de mail no suma un health indicator que pueda tumbar `/api/health`). `docker-compose.yml` pasa `.env` al backend con `env_file`.
- Restricciones: reglas 1, 2, 5, 6, 7, 8, 11 y 12 de `CLAUDE.md`; línea base `./gradlew test` 811/811.

## Goals / Non-Goals

**Goals:**
- Plantilla del mensaje y armado del enlace como funciones puras sin Spring, deterministas con zona horaria explícita.
- Ninguna transacción abierta durante el envío SMTP; el recordatorio (`ENVIADO` o `ERROR`) y su auditoría se confirman juntos.
- Ningún dato personal (teléfono, email, nombre) en respuestas de error, detalle de auditoría, `detalle_error` ni logs.
- El grupo de email se puede recortar sin tocar WhatsApp ni pendientes.

**Non-Goals:** envío programado/automático; reintentos; plantillas configurables; email HTML; deduplicar pedidos repetidos; validar el teléfono contra WhatsApp; paginado de pendientes; cambios en `TurnoController`.

## Decisions

> D1–D9 aprobadas por la persona antes de este propose. D10–D13 son decisiones de implementación derivadas, sin cambio de contrato.

### D1 — Controlador propio bajo `/api/turnos`
- Nuevo `recordatorio/RecordatorioController` con las tres rutas bajo `/api/turnos/...` y `@PreAuthorize(Permisos.OPERACION)` (ADMIN, PROFESIONAL, RECEPCION). `TurnoController` no se modifica.
- Alternativa descartada: sumar los endpoints a `TurnoController` → mezcla zonas (C-07 vs C-09) y agranda un controlador ya cerrado.

### D2 — Turnos recordables y validación de contacto
- Solo `PROGRAMADO` o `CONFIRMADO`. Otro estado → `ConflictoException` → `409` genérico (RN-CO-03 "ni a turnos cancelados"; `ASISTIO`/`AUSENTE` ya pasaron).
- Orden: turno (404 si no existe o es ajeno) → estado (409) → contacto (422). Teléfono `null`/vacío → `422` `errores[{campo: "telefono"}]`; email `null`/en blanco → `422` `errores[{campo: "email"}]`. Se reutiliza `ReferenciaInvalidaException(campo)` si su título es genérico; si no, una subclase con el mismo handler. Ningún valor del paciente en la respuesta.
- Un teléfono guardado que no cumpla E.164 (no debería ocurrir: C-05 lo valida) se trata igual que ausente → `422 telefono`.

### D3 — Plantilla del mensaje (RN-CO-04)
- `MensajeRecordatorio` (puro): `Recordatorio: tiene un turno el {dd/MM/yyyy} a las {HH:mm} en {consultorio} con {profesional}.`
- Recibe `Instant inicio`, `ZoneId` del consultorio, nombre del consultorio y nombre + apellido del profesional; formatea con `DateTimeFormatter` fijo (`dd/MM/yyyy`, `HH:mm`) en esa zona. No recibe paciente, prestación ni notas: por construcción no puede filtrarlos.
- Mismo texto para WhatsApp y para el cuerpo del email (texto plano). Asunto del email fijo: `Recordatorio de turno`.

### D4 — Enlace `wa.me` y efecto lateral del GET
- `GET /api/turnos/{id}/recordatorio/whatsapp` → `200 {recordatorioId, enlace, generadoEn}`.
- `EnlaceWhatsApp` (puro): exige E.164 de 8 a 15 dígitos reutilizando `TelefonoE164.esValido` (`^\+[1-9]\d{7,14}$`, mismo criterio que C-05; sin duplicar el regex), quita el `+` y arma `https://wa.me/<dígitos>?text=<codificado>`. Codificación: `URLEncoder.encode(texto, UTF_8)` y luego `+` → `%20` (seguro: un `+` literal ya sale como `%2B`); `\n` sale `%0A`, `&` `%26`, `#` `%23`, acentos en bytes UTF-8.
- Registra `Recordatorio` `WHATSAPP_LINK` `GENERADO` con `generadoEn = Instant.now(clock)` y audita (D6) en un único `@Transactional` de lectura-escritura (no `readOnly`).
- **GET con efecto lateral, no idempotente**: se mantiene por contrato de KB (Flujo 3) y CHANGES.md; cada pedido registra un recordatorio nuevo (el sistema no sabe si se envió, RN-CO-01). Documentado en el spec y en el handoff para C-14 (el front debe pedir el enlace solo al hacer clic, no al renderizar ni en prefetch). Alternativa descartada: `POST` → rompe el contrato ya publicado en KB/CHANGES.

### D5 — Email en tres pasos, SMTP fuera de transacción
- `POST /api/turnos/{id}/recordatorio/email`. El servicio de email **no** es `@Transactional` a nivel de método:
  - **(a) Lectura**: `TransactionTemplate` de solo lectura (sin auditoría → `readOnly` válido): carga turno, valida D2, arma el mensaje y captura en un record inmutable `turnoId`, destinatario y texto. Sale de la transacción.
  - **(b) Envío**: `EnvioEmail.enviar(destinatario, asunto, texto)` sin transacción activa. `generadoEn` = reloj antes de enviar; `enviadoEn` = reloj después del envío aceptado.
  - **(c) Escritura**: `TransactionTemplate` `PROPAGATION_REQUIRED`, `readOnly=false` (patrón C-15): `findById(turnoId)`; si el turno desapareció entre (a) y (c) → `IllegalStateException`, log `ERROR` con `turnoId` y nombre simple de la causa (sin PII), sin recordatorio ni auditoría, `500` genérico (implementado así en lugar de `getReferenceById`, que solo fallaba al flush por la FK y sin log); persiste `ENVIADO` o `ERROR`, y `AuditService.registrar` (D6). Fail-closed: si la auditoría falla, se revierte el recordatorio y responde `500` (C-06), aunque el email ya haya salido (trade-off abajo).
- Éxito → `201 {recordatorioId, estado: ENVIADO, enviadoEn}`.
- Falla al enviar/comunicarse con el servidor SMTP → persiste `ERROR` con `detalle_error = "SMTP_FALLO:" + excepción.getClass().getSimpleName()` truncado a 500 (nunca `getMessage()`, direcciones ni PII), y lanza `EnvioEmailFallidoException` → `502` `ProblemDetail` genérico. **`502` se reserva solo para fallas al intentar enviar/comunicarse con el SMTP.**
- SMTP sin configurar (sin `SMTP_HOST` o sin `SMTP_FROM`) → persiste `ERROR` con `detalle_error = "SMTP_NO_CONFIGURADO"` sin intentar conectar, y lanza `EmailNoConfiguradoException` → `503` `ProblemDetail` genérico (configuración local faltante, no falla del servidor remoto).
- Ambos handlers (`502` y `503`) son nuevos en `common/web/ApiExceptionHandler`, sin propiedades extra ni causa técnica ni detalle interno. **Zona compartida fuera de `recordatorio/`: marcada para review de integrante-1/2 (ver Riesgos).**
- Puerto propio `recordatorio/email/EnvioEmail` + adaptador `SmtpEnvioEmail` sobre `JavaMailSender` (`SimpleMailMessage`, `from = SMTP_FROM`). Traduce cualquier `MailException`/`RuntimeException` a una excepción de puerto que conserva solo el nombre simple de la clase original. Los tests de integración reemplazan `EnvioEmail` por un fake `@Primary` programable (nunca se mockea la base, regla 8); el adaptador se prueba aparte con un `JavaMailSender` mockeado.
- Alternativa descartada: `@Transactional` sobre todo el método → retiene una conexión durante el SMTP (segundos o timeouts) y mezcla la auditoría con un I/O externo.

### D6 — Auditoría programática
- `AuditService.registrar(AccionAuditoria.CREATE, "Recordatorio", recordatorioId, DetalleAuditoria{canal, estado})` como último paso dentro de la transacción de escritura (WhatsApp: el `@Transactional` del método; email: paso (c)). No se usa `@Audited` (el detalle depende del resultado).
- `AccionAuditoria.CREATE` ya existe (verificado en el enum y en `ck_audit_log_accion`) → **sin migración**.
- Pendientes no se auditan → `@Transactional(readOnly = true)` válido ahí.
- `RecordatorioTransaccionesArchTest` (reflexión sobre `recordatorio`): ningún método combina `@Audited` con `readOnly = true`; `readOnly` solo en lecturas puras no auditadas; el servicio de email no tiene `@Transactional` de método.

### D7 — Pendientes de recordatorio
- `GET /api/turnos/pendientes-recordatorio?fecha=YYYY-MM-DD` (`@RequestParam(required=false) LocalDate`). Sin `fecha` → `Instant.now(clock).atZone(zonaConsultorio).toLocalDate().plusDays(1)` (no `LocalDate.now(clock.withZone(...))`: el `MutableClock` de test ignora `withZone`). `fecha` mal formada → `400` campo `fecha` sin eco (el handler de conversión ya responde genérico; se verifica).
- Rango UTC `[fecha 00:00 local, fecha+1 00:00 local)` convertido con `ZoneId` del consultorio (`atStartOfDay(zone)`, correcto aun con cambios de horario).
- Ítem: `{turnoId, inicio, fin, estado, paciente{id, nombre, apellido}, profesional{id, nombre, apellido}, tieneTelefono, tieneEmail, ultimoRecordatorio?{canal, estado, generadoEn}}`. Nunca teléfono ni email. Orden `inicio, turnoId`.
- **Precedencia de ruta**: el patrón literal `/api/turnos/pendientes-recordatorio` gana sobre `/api/turnos/{id}` en Spring MVC (más específico); igual se prueba explícitamente (si se rompiera, `{id}` daría `400` por conversión de `Long`).

### D8 — Configuración SMTP
- `spring-boot-starter-mail` en `backend/build.gradle` (versión del BOM).
- `application.yml`: `spring.mail.port: ${SMTP_PORT:587}`; nueva propiedad `app.mail.from: ${SMTP_FROM:}`; `mail.smtp.auth: true` y `mail.smtp.starttls.enable`/`required: ${SMTP_STARTTLS:true}` (hallazgo de review, regla 12: la contraseña SMTP nunca viaja en texto plano; solo un SMTP local sin TLS justifica `SMTP_STARTTLS=false`). `.env.example` suma `SMTP_FROM=` (y `SMTP_PORT=587`), sin valores reales. `docker-compose.yml` ya usa `env_file: .env` para el backend: se verifica que `SMTP_FROM` llegue; solo se edita si hiciera falta.
- Sin `SMTP_HOST` o sin `SMTP_FROM` la app arranca igual; el adaptador detecta la falta de configuración (`ObjectProvider<JavaMailSender>` vacío, host o remitente en blanco) y falla con código fijo `SMTP_NO_CONFIGURADO` → `ERROR` + `503` (`EmailNoConfiguradoException`) sin intentar conectar.
- **Timeouts del `JavaMailSender`** (conexión, lectura y escritura, ≈10 s cada uno): `spring.mail.properties.mail.smtp.connectiontimeout=10000`, `mail.smtp.timeout=10000` y `mail.smtp.writetimeout=10000` en `application.yml`. Se verifica con un test que lee las propiedades configuradas del `JavaMailSenderImpl` (task 5.1).
- Perfil `test`: sin SMTP real; los tests usan el fake de `EnvioEmail`.

### D9 — Governance MEDIO con checkpoints y logs
- PII (teléfono, email) y secretos SMTP → checkpoints al cerrar las secciones 1, 3 y 5 de `tasks.md`; el PR se marca para review de integrante-1/2 (regla 12).
- Logs solo con ids y nombre simple de la excepción: `recordatorioId`, `turnoId`, `canal`, `estado`, `causa=<SimpleName>`. Nunca se pasa el objeto excepción al logger (el stack trace de `MailSendException` incluye direcciones).

### D10 — Consulta de pendientes (JPQL portable)
- `RecordatorioRepository`/`TurnoRepository` (el que corresponda a la zona: se prefiere un método en `RecordatorioRepository` con `@Query` sobre `Turno`) con: `t.estado in :estados and t.inicio >= :desde and t.inicio < :hasta and not exists (select r from Recordatorio r where r.turno = t and r.estado in (GENERADO, ENVIADO))`, `join fetch t.paciente`, `join fetch t.profesional`. El filtro de tenant (`@TenantId`) aplica a ambas entidades.
- Último recordatorio: segunda consulta por los ids de la página (`turno.id in :ids`, orden `generadoEn desc, id desc`), elegido en memoria. Sin SQL nativo.

### D11 — Persistencia del recordatorio
- `Recordatorio` recibe un factory/método de dominio en lugar de setters sueltos: `generado(turno, generadoEn)`, `enviado(turno, generadoEn, enviadoEn)`, `error(turno, generadoEn, codigo)`; `codigo` se trunca a 500.

### D12 — DTOs y mapper
- Records `EnlaceWhatsAppResponse`, `RecordatorioEmailResponse`, `TurnoPendienteResponse` (+ anidados) y `RecordatorioMapper`; ningún controlador importa entidades JPA (regla 1).

### D13 — Turno cambiado entre (a) y (c)
- Si el turno se cancela mientras sale el email, el paso (c) igual registra `ENVIADO`: el email ya salió y el registro refleja lo ocurrido. Si el turno desapareció (no hay borrado físico de turnos en el MVP) se loguea por id y responde `500` genérico.

## Risks / Trade-offs

- [GET con efecto lateral: prefetch/crawlers o doble render generan recordatorios extra] → mitigación: requiere token; contrato documentado para C-14; pendientes ignora duplicados (basta uno `GENERADO`).
- [Email enviado pero auditoría/persistencia fallan en (c)] → el paciente recibe el email y no queda registro; se loguea `turnoId` + causa y responde `500`. Aceptado: alternativa (persistir antes y actualizar después) agrega un estado intermedio que el `CHECK` no tiene.
- [H2 no detecta `INSERT` en conexión read-only] → `RecordatorioTransaccionesArchTest` + verificación manual contra MySQL 8.4 de un recordatorio WhatsApp y uno email con error (SMTP inexistente).
- [Cuota del SMTP gratuito (RN-CO-02)] → `ERROR` con código fijo y `502` (falla de envío); el usuario reintenta manualmente o usa WhatsApp.
- [Timeout SMTP largo bloquea el hilo] → sin transacción abierta no se retiene conexión; se fijan `mail.smtp.connectiontimeout`, `mail.smtp.timeout` (lectura) y `mail.smtp.writetimeout` en 10000 ms en `application.yml`, con test que verifica las propiedades.
- [Se toca `common/web/ApiExceptionHandler`, clase compartida fuera de `recordatorio/` (handlers `502` y `503`)] → cambio aprobado por la persona pero **zona de riesgo: requiere review explícita de integrante-1/2** (regla 12); los handlers devuelven `ProblemDetail` genérico sin eco de datos, causa ni detalle interno, y se cubren con tests; los handlers existentes no cambian.
- [Se toca `paciente/abm/TelefonoE164` (zona de C-05): se agrega `esValido(String)` público reutilizado por `EnlaceWhatsApp`, sin cambiar `normalizar`] → **señalado para review de integrante-1/2** junto con `ApiExceptionHandler`; cubierto por `TelefonoE164Test` (16/16).
- [Zona horaria inválida en el consultorio] → C-04 ya la valida; `ZoneId.of` lanzaría y respondería `500` genérico.

## Migration Plan

- Sin migración de esquema. Deploy: agregar `SMTP_FROM` (y credenciales SMTP reales) al `.env` del entorno; sin ellas, WhatsApp y pendientes funcionan y el email responde `503` y registra `ERROR` con `SMTP_NO_CONFIGURADO`.
- Rollback: revertir el PR; las filas de `recordatorio` y `audit_log` quedan válidas para el esquema existente.
- Recorte (orden del proyecto): si falta tiempo, se omite la sección 5 de `tasks.md` (email) completa sin afectar las secciones 1–4.

## Open Questions

- Proveedor SMTP gratuito concreto (Gmail con contraseña de aplicación, Brevo, etc.): no cambia el diseño, solo valores de `.env`.
- Texto final del asunto del email: provisional `Recordatorio de turno`.
