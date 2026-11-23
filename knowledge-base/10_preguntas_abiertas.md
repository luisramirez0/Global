# Preguntas Abiertas

## Riesgos clave

- **R-01 (CRÍTICO) — Plazo**: el usuario indica entrega del trabajo completo el **25/11/2026**, es decir, 2 días desde la fecha de esta KB (2026-11-23), con equipo de 5. Es extremadamente ajustado: el alcance MVP completo probablemente no entra. Se recomienda recortar a un corte vertical mínimo (auth + pacientes + turnos sin solapamiento + wa.me) y declarar el resto como roadmap.
- **R-02**: dolor del segmento no validado con usuarios (discovery).
- **R-03**: datos de salud sensibles; cumplimiento legal sin verificar (Ley 25.326, Ley 26.529).
- **R-04**: competidores locales con plan gratuito (Odonthia, DentalSoft).
- **R-05**: sin pagos/ API oficial de WhatsApp el producto automatiza menos que la competencia.
- **R-06**: evidencia de discovery proveniente de marketing de proveedores.

## Inconsistencias detectadas

### IN-01 — Fuente `docs/consigna.txt` ausente
**Esperado**: la tarea de importación lista `docs/consigna.txt` (consigna original) como fuente. **Real**: no existe la carpeta `docs/` en el proyecto. **Impacto**: no se pudo contrastar la KB con los requisitos académicos originales (entregables, criterios de evaluación). **Resolución propuesta**: proveer el archivo y regenerar/ajustar la KB (especialmente 01 y 09).

### IN-02 — Discovery recomienda WhatsApp API oficial; decisión del usuario es wa.me
**Discovery dice**: recordatorios por API oficial (MVP D.3). **Usuario**: wa.me, presupuesto cero. **Resolución**: prevalece el usuario (DD-07).

### IN-03 — Discovery sugiere multi-profesional/multi-sillón; usuario fija independiente
**Resolución**: prevalece el usuario (DD-01); el modelo mantiene la extensibilidad.

### IN-04 — Plazo "trabajo completo" vs alcance de producto comercial
Ver R-01.

## Preguntas abiertas (priorizadas)

| ID | Prioridad | Pregunta | Bloquea | Decisor |
|---|---|---|---|---|
| PA-01 | Alta | ¿Qué incluye exactamente el entregable del 25/11/2026 (código, informe, demo, presentación) y es solo el MVP? | Planificación | Usuario / cátedra |
| PA-02 | Alta | Proveer `docs/consigna.txt` (ausente) | KB 01/09 | Usuario |
| PA-03 | Alta | ¿Hay acceso a un odontólogo para validar duraciones, ficha y dolor real? | Validación | Equipo |
| PA-04 | Alta | Cumplimiento legal: plazo de conservación de HC (Ley 26.529), registro en AAIP, responsable de la base | Lanzamiento comercial | Asesoría legal |
| PA-05 | Media | Modelo comercial (gratis con límites, suscripción ARS/USD) | Etapa comercial | Equipo |
| PA-06 | Media | Residencia de datos y hosting gratuito para producción | Despliegue | Equipo técnico |
| PA-07 | Media | ¿La recepcionista ve la ficha clínica o solo datos administrativos? | RBAC | Product owner |
| PA-08 | Media | Política de edición de notas clínicas (adenda vs edición) | Ficha | Product owner / legal |
| PA-09 | Media | Hosting gratuito aceptable para la demo (local, Docker, free tier) | Entrega | Equipo técnico |
| PA-10 | Media | ~~JWT vs sesión por cookie~~ Resuelta 2026-11-23 (C-03): JWT Bearer sin refresh en el MVP, ver DD-04 | Seguridad | Equipo técnico |
| PA-11 | Baja | Roles/estructura del equipo de 5 (frontend, backend, QA, etc.) | Reparto | Equipo |
| PA-12 | Baja | Demos pendientes de competidores; fuentes de Bilog, DentalTec, Odonto.ar, Dentidesk | Posicionamiento | Equipo |
| PA-13 | Baja | Obras sociales y ARCA: cuándo y cómo (etapa posterior) | Etapa 3 | Product owner |

## Campos discovery de la KB

Todos inferidos con confianza razonable salvo `scale`: `saas_multi_tenant` es el diseño buscado, pero el MVP atiende un solo profesional por consultorio. [DISCOVERY] `scale` — confirmar si el primer despliegue será multi-cliente real o un único piloto.
