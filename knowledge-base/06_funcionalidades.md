# Funcionalidades

Organizadas por épica. Prioridad: **M** = MVP, **P** = posterior (etapa 2+). Historias derivadas de discovery (sección D.3) filtradas por las decisiones del 2026-11-23.

## Épica 1: Cuenta y consultorio (M)

### US-001 — Registro e inicio de sesión
**Como** odontólogo **Quiero** registrarme y entrar con email y contraseña **Para** acceder a mi consultorio.
- [ ] CA-1 Alta crea consultorio + usuario ADMIN/PROFESIONAL + profesional + sillón por defecto
- [ ] CA-2 Login devuelve token; rutas protegidas
- [ ] CA-3 Contraseña almacenada con hash
Reglas: RN-MT-01, RN-DS-05

### US-002 — Configurar consultorio
**Como** odontólogo **Quiero** definir sillones, horarios y prestaciones con su duración **Para** que la agenda refleje mi trabajo.
- [ ] CA-1 CRUD de sillones (1–2), prestaciones y horarios de atención
Reglas: RN-AG-03

## Épica 2: Agenda y turnos (M)

### US-010 — Ver agenda diaria/semanal
**Como** odontólogo **Quiero** ver mis turnos por día y semana, por sillón **Para** organizar mi jornada.
- [ ] CA-1 Vista diaria y semanal; filtro por sillón
- [ ] CA-2 Muestra estado por color

### US-011 — Crear turno
**Como** odontólogo **Quiero** asignar un paciente, prestación, sillón y horario **Para** reservar el turno.
- [ ] CA-1 Rechaza solapamientos (sillón/profesional)
- [ ] CA-2 Rechaza fuera de horario/bloqueo
- [ ] CA-3 Permite sobreturno explícito, auditado
Reglas: RN-AG-01..04

### US-012 — Confirmar, cancelar, reprogramar, marcar asistencia
**Como** odontólogo **Quiero** cambiar el estado o mover un turno **Para** reflejar la realidad.
- [ ] CA-1 Solo transiciones válidas
- [ ] CA-2 Reprogramar revalida reglas
Reglas: RN-AG-05..07

### US-013 — Bloquear agenda
**Como** odontólogo **Quiero** bloquear franjas (vacaciones, almuerzo) **Para** que no se agenden turnos.

## Épica 3: Pacientes y ficha básica (M)

### US-020 — ABM de pacientes
- [ ] CA-1 Alta/edición/baja lógica; búsqueda por nombre y DNI; DNI único
Reglas: RN-PA-01..03

### US-021 — Ficha básica y anamnesis
**Como** odontólogo **Quiero** registrar alergias, medicación, antecedentes y notas **Para** atender con contexto.
- [ ] CA-1 Requiere consentimiento registrado
- [ ] CA-2 Cada acceso/cambio queda en auditoría
Reglas: RN-DS-01..04, RN-PA-04

## Épica 4: Recordatorios (M)

### US-030 — Recordatorio por WhatsApp (wa.me)
**Como** odontólogo **Quiero** un botón que abra WhatsApp con el mensaje armado **Para** recordar al paciente sin pagar API.
- [ ] CA-1 Enlace con teléfono E.164 y texto codificado
- [ ] CA-2 Se registra el recordatorio como GENERADO
Reglas: RN-CO-01, RN-CO-03, RN-CO-04

### US-031 — Recordatorio por email
- [ ] CA-1 Envío por SMTP gratuito; manejo de error
Reglas: RN-CO-02

## Épica 5: Seguridad y cumplimiento (M)

### US-040 — Auditoría y exportación
- [ ] CA-1 Consulta de log de accesos; exportación de datos de un paciente (JSON/PDF simple)
Reglas: RN-DS-02, RN-DS-06

## Épica 6: Diferenciadores (P)

- **US-050 Lista de espera con reasignación de huecos** (P, candidato etapa 2).
- **US-051 Reserva online por enlace público** (P).
- **US-052 Seña con Mercado Pago** (P; a lo sumo sandbox opcional).
- **US-053 Seguimiento de ausentes y recall** (P).
- **US-054 Página pública de seguridad y cumplimiento** (P).

## Épica 7: Clínica avanzada y administración (P)

Odontograma FDI, periodontograma, presupuestos/planes de tratamiento, imágenes, obras sociales, facturación ARCA, caja, reportes de ocupación, multi-profesional/multisucursal, portal del paciente, firma electrónica, receta electrónica, Google Calendar, IA en WhatsApp.
