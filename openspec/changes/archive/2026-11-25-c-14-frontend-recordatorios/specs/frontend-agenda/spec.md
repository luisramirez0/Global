# Spec Delta

## ADDED Requirements

### Requirement: Recordatorio desde el diálogo del turno
El diálogo de acciones de un turno `PROGRAMADO` o `CONFIRMADO` SHALL ofrecer "WhatsApp" y "Email" con el mismo comportamiento, avisos y mensajes de la página de recordatorios. Un turno `CANCELADO`, `ASISTIO` o `AUSENTE` MUST NOT ofrecerlos. Un recordatorio no cambia el turno: MUST NOT cerrar el diálogo ni recargar la agenda.

#### Scenario: Turno recordable
- **GIVEN** un turno `CONFIRMADO`
- **WHEN** se abren sus acciones
- **THEN** el diálogo ofrece "WhatsApp" y "Email" además de las acciones de estado existentes

#### Scenario: Turno no recordable
- **GIVEN** un turno `CANCELADO`
- **WHEN** se abren sus acciones
- **THEN** el diálogo no ofrece "WhatsApp" ni "Email"

#### Scenario: Enlace desde la agenda
- **GIVEN** el diálogo de un turno `PROGRAMADO` abierto
- **WHEN** se pulsa "WhatsApp" y la API devuelve el enlace
- **THEN** el diálogo sigue abierto con el enlace "Abrir WhatsApp" enfocado y la agenda no se recarga

#### Scenario: Sin teléfono desde la agenda
- **GIVEN** el diálogo de un turno cuyo paciente no tiene teléfono
- **WHEN** se pulsa "WhatsApp" y la API responde `422` con campo `telefono`
- **THEN** el botón queda deshabilitado con "El paciente no tiene teléfono cargado." y el foco permanece dentro del diálogo

#### Scenario: Email sin confirmar desde la agenda
- **GIVEN** el diálogo de un turno `CONFIRMADO`
- **WHEN** se pulsa "Email" y la API responde `500`
- **THEN** el botón "Email" queda deshabilitado con el aviso de envío sin confirmar, el diálogo sigue abierto y, al cerrarlo y reabrirlo, el botón sigue deshabilitado

#### Scenario: Email ya enviado
- **GIVEN** el email del turno 7 enviado desde la página de recordatorios, o desde el diálogo y este reabierto
- **WHEN** se abre el diálogo del turno 7
- **THEN** el botón "Email" está deshabilitado con "Recordatorio enviado por email."

#### Scenario: Sin pedido al abrir
- **WHEN** se abre el diálogo de un turno recordable
- **THEN** no se envía ningún pedido de recordatorio
