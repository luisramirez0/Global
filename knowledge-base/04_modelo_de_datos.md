# Modelo de Datos

Propuesta inicial derivada de discovery y de las decisiones confirmadas. Tipos orientativos para MySQL/JPA. Toda tabla de negocio lleva `consultorio_id` (multi-tenant por columna), `created_at`, `updated_at`.

## Dominios

- **Cuenta y tenant**: Consultorio, Usuario, Rol.
- **Agenda**: Profesional, Sillon, Prestacion, HorarioAtencion, BloqueoAgenda, Turno.
- **Pacientes**: Paciente, FichaClinica (anamnesis básica), NotaClinica, ConsentimientoDatos.
- **Comunicación**: Recordatorio.
- **Trazabilidad**: AuditLog.
- **Posterior (no MVP)**: ListaEspera, Cobro/Seña, ObraSocial, Odontograma, Presupuesto, Factura.

## ERD (textual)

```
Consultorio 1---N Usuario
Consultorio 1---N Profesional   (MVP: 1 profesional, ligado a un Usuario)
Consultorio 1---N Sillon        (MVP: 1-2)
Consultorio 1---N Prestacion
Consultorio 1---N Paciente
Paciente    1---1 FichaClinica
Paciente    1---N NotaClinica
Paciente    1---N ConsentimientoDatos
Profesional 1---N HorarioAtencion
Profesional 1---N BloqueoAgenda   (BloqueoAgenda puede ser tambien por Sillon)
Turno N---1 Paciente
Turno N---1 Profesional
Turno N---1 Sillon
Turno N---1 Prestacion
Turno 1---N Recordatorio
Usuario 1---N AuditLog
```

## Entidades

### Consultorio
- id (PK), nombre, cuit (opcional), telefono, email, direccion, zona_horaria (default `America/Argentina/Buenos_Aires`), activo.

### Usuario
- id, consultorio_id (FK), email (único), password_hash, nombre, rol (`ADMIN|PROFESIONAL|RECEPCION`), activo, ultimo_login.
- Índice único en email.

### Profesional
- id, consultorio_id, usuario_id (FK, nullable), nombre, apellido, matricula (opcional), color_agenda, activo.

### Sillon
- id, consultorio_id, nombre, activo.

### Prestacion
- id, consultorio_id, nombre, duracion_minutos (múltiplo de la grilla, ver RN-AG-03), activo. (Precio: posterior.)

### HorarioAtencion
- id, profesional_id, dia_semana (1-7), hora_desde, hora_hasta.

### BloqueoAgenda
- id, consultorio_id, profesional_id (nullable), sillon_id (nullable), inicio, fin, motivo.

### Paciente
- id, consultorio_id, nombre, apellido, dni (único por consultorio), fecha_nacimiento, sexo (opcional), telefono (formato E.164 para wa.me), email (opcional), direccion (opcional), obra_social_texto (texto libre opcional, no integración), activo.
- Índices: (consultorio_id, dni), (consultorio_id, apellido, nombre).

### FichaClinica (anamnesis básica)
- id, paciente_id (1:1), alergias, medicacion_actual, antecedentes_medicos, enfermedades_relevantes (diabetes, hipertensión, etc. como texto o flags), embarazo (bool opcional), motivo_consulta, observaciones.
- **Contenido de salud: dato sensible** (RN-DS-01).

### NotaClinica
- id, paciente_id, profesional_id, turno_id (nullable), fecha, texto. No editable tras cierto plazo salvo por adenda (a confirmar, PA-08).

### ConsentimientoDatos
- id, paciente_id, version_texto, aceptado_en, registrado_por_usuario_id.

### Turno
- id, consultorio_id, paciente_id, profesional_id, sillon_id, prestacion_id, inicio (datetime), fin (datetime), estado (`PROGRAMADO|CONFIRMADO|CANCELADO|ASISTIO|AUSENTE`), es_sobreturno (bool), motivo_cancelacion, notas.
- Constraint de negocio: sin solapamiento por (sillon) ni por (profesional) salvo `es_sobreturno` (RN-AG-01/02), validado en servicio dentro de transacción (+ bloqueo/lock o constraint auxiliar, ver DD-06).
- Índices: (consultorio_id, inicio), (sillon_id, inicio), (profesional_id, inicio), (paciente_id).

### Recordatorio
- id, turno_id, canal (`WHATSAPP_LINK|EMAIL`), generado_en, enviado_en (nullable; en wa.me solo se sabe que se generó/abrió el enlace), estado (`GENERADO|ENVIADO|ERROR`), detalle_error.

### AuditLog
- id, consultorio_id, usuario_id, accion (`READ|CREATE|UPDATE|DELETE|EXPORT|LOGIN`), entidad, entidad_id, detalle (JSON), ip, fecha. Inmutable (solo insert).

## Seed data inicial

- Roles (enum): ADMIN, PROFESIONAL, RECEPCION.
- Texto versionado de consentimiento de tratamiento de datos (v1).
- Por consultorio nuevo: 1 sillón "Sillón 1", horarios por defecto lunes a viernes (a confirmar), prestaciones sugeridas editables (Consulta 30', Limpieza 45', Arreglo/obturación 60', Control 15'): **Suposición** de duraciones, validar con un odontólogo (PA-03).
- Usuario administrador de desarrollo (solo en perfil `dev`).
