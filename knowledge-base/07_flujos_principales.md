# Flujos Principales

## Flujo 1: Registro e inicio de sesión
**Disparador**: odontólogo nuevo accede al sistema. **Actor**: Odontólogo.

1. SPA envía `POST /api/auth/register` (datos del consultorio y del usuario).
2. API valida email único, crea Consultorio, Usuario, Profesional y Sillón por defecto (transacción).
3. SPA llama `POST /api/auth/login`; API devuelve token.
4. SPA guarda el token (ver DD-04) y carga la agenda.

**Errores**: email duplicado -> 409; credenciales inválidas -> 401.

## Flujo 2: Crear turno
**Disparador**: odontólogo selecciona un hueco en la agenda. **Actor**: Odontólogo/Recepción.

1. Selecciona/crea paciente.
2. Elige prestación (determina duración), sillón y horario.
3. `POST /api/turnos`.
4. API, en una transacción, valida horario de atención, bloqueos y solapamientos (RN-AG-01..04) y crea el turno en estado `PROGRAMADO`.
5. Se registra en AuditLog.

```
SPA -> API -> (validaciones + lock) -> MySQL
                                   <- 201 Turno
```

**Errores**: solapamiento -> 409 con turno en conflicto; fuera de horario -> 422; sobreturno requiere flag explícito.

## Flujo 3: Recordatorio por WhatsApp (wa.me)
**Disparador**: turno próximo (ej. día anterior). **Actor**: Odontólogo/Recepción.

1. La SPA lista turnos del día siguiente sin recordatorio.
2. Pide `GET /api/turnos/{id}/recordatorio/whatsapp`; API valida RN-CO-03 y devuelve el enlace `https://wa.me/<E164>?text=<mensaje>` y registra Recordatorio `GENERADO`.
3. El usuario hace clic y WhatsApp se abre con el mensaje; envía manualmente.
4. El usuario marca el turno `CONFIRMADO` o lo cancela según la respuesta del paciente.

**Errores**: paciente sin teléfono -> botón deshabilitado y aviso.

## Flujo 4: Cancelar o reprogramar turno
1. Usuario elige turno -> cancelar (motivo) o mover.
2. API valida la transición (RN-AG-05) y, si reprograma, revalida RN-AG-01..04.
3. Hueco liberado; se audita. (Futuro: ofrecer a lista de espera.)

## Flujo 5: Atención y registro clínico básico
1. Paciente llega; usuario marca `ASISTIO`.
2. Abre ficha: verifica consentimiento (si falta, lo registra), consulta/edita anamnesis, agrega nota.
3. Cada lectura/escritura queda en AuditLog.

## Flujo 6: Ausente
1. Fin de la franja: turno no asistido -> `AUSENTE`.
2. Queda disponible para métricas/recall (posterior).

## Flujo 7: Exportación de datos del paciente
1. `GET /api/pacientes/{id}/export` (solo ADMIN/PROFESIONAL).
2. API arma el paquete (datos, ficha, turnos, notas), registra `EXPORT` en AuditLog y devuelve el archivo.
