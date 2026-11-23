# Visión y Objetivos

## Propósito del sistema

SaaS comercial de **gestión de turnos y agenda para odontólogos**, con foco inicial en Argentina. Se construye como "Trabajo Global" de la materia Desarrollo de Software (3er año) con intención de ser vendido como producto real.

Problema (hipótesis de discovery, **no validada con usuarios**): los consultorios odontológicos argentinos gestionan turnos con WhatsApp manual, agendas en papel o herramientas genéricas, y sufren ausentismo, huecos sin cubrir y carga administrativa. Los sistemas existentes (DentalSoft, Odonthia, DentalCore, AgendaPro, Dentalink, ClinIA) cubren partes del problema, pero ninguno evidencia públicamente la combinación agenda por sillón + lista de espera + seña + ARCA + obras sociales a precio de consultorio (ver `discovery/discovery.md`, sección C.3).

## Segmento inicial (decisión confirmada 2026-11-23)

**Odontólogo independiente**: un profesional, 1–2 sillones. El dominio se diseña para crecer a clínicas (multi-profesional, multi-sillón, multi-sucursal) pero el MVP apunta solo al independiente. Ver DD-01.

## Objetivos por actor

| Actor | Objetivo principal | Objetivos secundarios |
|---|---|---|
| Odontólogo (dueño del consultorio) | Tener su agenda ordenada, sin solapamientos ni huecos | Reducir ausentismo; consultar ficha básica del paciente; no pagar licencias caras |
| Secretaria/asistente (opcional, post-MVP en el independiente) | Cargar y mover turnos rápido | Enviar recordatorios sin escribir cada mensaje |
| Paciente | Saber/confirmar/cancelar su turno sin llamar | Reservar por enlace (si se implementa) |
| Equipo de desarrollo | Entregar un MVP funcional y demostrable | Base comercializable y extensible |

## Alcance MVP

Ver `06_funcionalidades.md` para detalle. Resumen:

- Autenticación del odontólogo y gestión de su consultorio (un tenant por consultorio).
- Agenda diaria/semanal con 1–2 sillones, duración variable por prestación, bloqueos y prevención de solapamientos.
- ABM de pacientes y **ficha básica** (datos personales, contacto, anamnesis básica, notas).
- Turnos: crear, confirmar, cancelar, reprogramar, marcar asistió/ausente.
- Recordatorios por **WhatsApp con enlace `wa.me`** (mensaje prearmado, envío manual con un clic) y por **email vía SMTP gratuito**.
- Registro de auditoría de accesos/cambios a datos de salud y consentimiento de tratamiento de datos.
- Exportación de datos del paciente/agenda.

## Fuera de alcance del MVP (etapas posteriores)

- Odontograma, periodontograma, imágenes/radiografías, presupuestos y planes de tratamiento.
- Obras sociales (nomencladores, liquidaciones, PUCO).
- Facturación ARCA, caja.
- WhatsApp Business API oficial (tiene costo por mensaje de Meta): no se usa por presupuesto cero.
- Cobro de seña con Mercado Pago (a lo sumo sandbox opcional).
- Portal del paciente completo, firma electrónica/digital, receta electrónica, IA en WhatsApp, multisucursal.
- Lista de espera con reasignación automática (diferenciador de discovery; candidato a etapa 2).

## Restricciones clave

- **Presupuesto cero**: sin integraciones pagas ni hosting pago asumido.
- **Plazo**: entrega el **25/11/2026**, el usuario indica que "el trabajo completo" vence esa fecha. Es extremadamente ajustado (ver `10_preguntas_abiertas.md` R-01).
- Equipo de 5 personas.
- Stack fijo (ver `02`).
- Datos de salud sensibles: Ley 25.326 (datos personales) y Ley 26.529 (derechos del paciente / historia clínica). Verificación legal pendiente.

## Métricas de éxito (propuestas, a confirmar)

- Demo end-to-end funcionando: alta de paciente → turno → recordatorio wa.me → asistió/ausente.
- Cero solapamientos de turnos posibles por sillón/profesional (test automatizado).
- Para etapa comercial (posterior): reducción de ausentismo medida con datos propios del consultorio piloto (no prometer cifras).
