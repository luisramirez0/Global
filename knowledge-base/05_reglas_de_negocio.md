# Reglas de Negocio

Códigos `RN-{DOMINIO}-{NN}`. Las reglas marcadas **(a validar)** provienen de la checklist de discovery, sin confirmación de usuarios.

## Dominio: Cuenta y multi-tenancy (RN-MT)
- **RN-MT-01**: Todo dato de negocio pertenece a un consultorio; un usuario solo accede a datos de su `consultorio_id`. Preparado para clínicas.
- **RN-MT-02**: En el MVP cada consultorio tiene 1 profesional y 1–2 sillones; el modelo no impone ese límite técnicamente (límite por plan/config, posterior).

## Dominio: Agenda y turnos (RN-AG)
- **RN-AG-01**: Un sillón no puede tener dos turnos solapados en el tiempo. **(a validar)**
- **RN-AG-02**: Un profesional no puede tener dos turnos solapados. Excepción: sobreturno explícito (`es_sobreturno=true`), que queda auditado. **(a validar)**
- **RN-AG-03**: La duración del turno proviene de la prestación; es variable por prestación y debe ser múltiplo de la grilla de la agenda (suposición: 15 min).
- **RN-AG-04**: No se pueden crear turnos fuera del horario de atención ni dentro de un bloqueo, salvo sobreturno autorizado.
- **RN-AG-05**: Estados válidos y transiciones: `PROGRAMADO -> CONFIRMADO | CANCELADO | ASISTIO | AUSENTE`; `CONFIRMADO -> CANCELADO | ASISTIO | AUSENTE`. `CANCELADO`, `ASISTIO`, `AUSENTE` son finales (reapertura requiere acción explícita auditada).
- **RN-AG-06**: Reprogramar = mover inicio/fin/sillón revalidando RN-AG-01..04; conserva historial en auditoría.
- **RN-AG-07**: Un turno cancelado libera el hueco inmediatamente. (Lista de espera automática: posterior.)
- **RN-AG-08**: Las fechas se guardan en UTC o con zona del consultorio de forma consistente; la zona por defecto es America/Argentina/Buenos_Aires.
- **RN-AG-09**: Políticas de cancelación y seña configurables por consultorio. **(a validar; seña posterior)**

## Dominio: Pacientes y ficha (RN-PA)
- **RN-PA-01**: El DNI es único por consultorio.
- **RN-PA-02**: El teléfono se normaliza a formato internacional (E.164, +54...) para generar enlaces `wa.me`.
- **RN-PA-03**: No se elimina físicamente un paciente con turnos o notas; se desactiva (baja lógica), por conservación de la HC (Ley 26.529, plazos a verificar).
- **RN-PA-04**: La ficha básica incluye anamnesis simple; odontograma y demás quedan fuera del MVP.

## Dominio: Datos sensibles y trazabilidad (RN-DS)
- **RN-DS-01**: Los datos de salud son sensibles (Ley 25.326); acceso solo por rol autorizado. **(verificación legal pendiente)**
- **RN-DS-02**: Cada lectura/alta/modificación/exportación de ficha clínica genera un registro en `AuditLog`; el log es inmutable.
- **RN-DS-03**: Debe registrarse el consentimiento de tratamiento de datos del paciente (versión del texto + fecha) antes de cargar la ficha clínica.
- **RN-DS-04**: La historia clínica se conserva según la Ley 26.529 (plazo exacto **a verificar con asesoría legal**; discovery no lo confirma).
- **RN-DS-05**: Datos en tránsito por HTTPS; contraseñas con hash fuerte (BCrypt/Argon2); backups de la base (cifrado: a definir por presupuesto cero).
- **RN-DS-06**: El paciente (o su titular) puede solicitar acceso/exportación de sus datos (derecho de acceso, Ley 25.326).

## Dominio: Comunicación (RN-CO)
- **RN-CO-01**: El recordatorio por WhatsApp es un enlace `wa.me/<tel>?text=<mensaje>` abierto manualmente por el usuario; el sistema no puede saber si se envió realmente (solo registra que se generó/abrió).
- **RN-CO-02**: El recordatorio por email se envía por SMTP gratuito, sujeto a cuota del proveedor.
- **RN-CO-03**: No se envían mensajes a pacientes sin teléfono/email válido ni a turnos cancelados.
- **RN-CO-04**: El mensaje no debe incluir datos clínicos, solo fecha, hora, consultorio y profesional.

## Dominio: Excepciones globales (RN-GL)
- **RN-GL-01**: Presupuesto cero: ninguna funcionalidad del MVP puede depender de un servicio pago.
- **RN-GL-02**: Todo lo marcado "posterior" (odontograma, obras sociales, ARCA, seña MP) no debe bloquear el MVP, pero el modelo no debe impedirlo.
