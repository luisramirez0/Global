# Decisiones y Supuestos

## Decisiones documentadas

### DD-01 — Segmento inicial: odontólogo independiente
**Decisión**: MVP para un profesional con 1–2 sillones. **Contexto**: discovery dejaba abierto el segmento. **Alternativas**: consultorio, clínica. **Justificación**: alcance viable con el plazo; menos roles y sin multi-sucursal. **Trade-offs**: el modelo se diseña con multi-tenant y roles para crecer; se posterga el valor de clínicas. **Origen**: usuario, 2026-11-23.

### DD-02 — Multi-tenant por columna desde el inicio
**Decisión**: `consultorio_id` en toda tabla de negocio. **Justificación**: crecer a clínicas sin migración traumática; es SaaS. **Trade-offs**: algo más de código (filtro de tenant) en el MVP.

### DD-03 — Stack fijo
**Decisión**: frontend TypeScript vanilla; backend Spring Boot (REST, Gradle, Hibernate/JPA) y MySQL. **Origen**: usuario. **Trade-offs**: el frontend sin framework exige disciplina de módulos y cuidado con XSS.

### DD-04 — Mecanismo de autenticación
**Decisión provisional**: JWT en header (o cookie HttpOnly); definir en el diseño. **Estado**: abierta (PA-10).

### DD-05 — Migraciones con Flyway (sugerido)
**Decisión provisional**: versionar el esquema con Flyway en lugar de `ddl-auto`. **Justificación**: reproducibilidad entre 5 integrantes.

### DD-06 — Anti-solapamiento
**Decisión provisional**: validación en servicio dentro de transacción con bloqueo pesimista del sillón/profesional para el rango; sin depender de constraints exclusivos de MySQL (no soporta exclusion constraints).

### DD-07 — Presupuesto cero: WhatsApp por wa.me, email por SMTP gratuito
**Decisión**: sin WhatsApp Business API (Meta cobra por mensaje, según discovery). **Trade-offs**: el envío es manual (un clic), sin automatización ni confirmación de entrega. **Origen**: usuario.

### DD-08 — Alcance clínico del MVP: turnos + ficha básica
**Decisión**: sin odontograma, periodontograma, obras sociales ni ARCA (etapas posteriores). **Origen**: usuario.

### DD-09 — Mercado Pago fuera del MVP
**Decisión**: sin cobros reales; a lo sumo sandbox opcional. **Origen**: usuario (presupuesto cero).

### DD-10 — Convenciones de setup (C-01)
**Decisión**: paquete base `ar.global.odonto`; Gradle (Groovy DSL) 8.14 + Spring Boot 3.5 + `options.release = 17` (sin toolchain); frontend Vite + Vitest (jsdom) + ESLint 9/typescript-eslint; puertos 8080 (API) / 5173 (frontend) / 3306 (MySQL); salud propia en `GET /api/health` (sin Actuator). **Trade-offs**: Spring Initializr ya no ofrece Boot 3.x, por lo que el `build.gradle` se escribió a mano; el wrapper se tomó del starter con Gradle 8.14.8 y `distributionSha256Sum`. **Origen**: equipo (change `c-01-project-setup`).

## Supuestos inferidos

### SU-01 — El dolor principal es ausentismo y huecos
**Origen**: discovery (cifras de proveedores). **Riesgo si es falso**: producto mal enfocado. **Validar**: entrevistar odontólogos.

### SU-02 — Un independiente se maneja bien con WhatsApp manual
**Origen**: DentalSoft usa WhatsApp manual con mensaje listo en planes básicos. **Riesgo**: poco valor percibido. **Validar**: piloto.

### SU-03 — Grilla de 15 minutos y duraciones por prestación sugeridas
**Origen**: inferido. **Validar**: con odontólogo.

### SU-04 — Versiones: Java 17+, Spring Boot 3.x, MySQL 8, TS 5
**Origen**: no especificadas; estándar actual.

### SU-05 — Plazo del 25/11/2026 abarca el trabajo completo
**Origen**: usuario ("el trabajo completo"). **Riesgo**: inviable construir todo el alcance; ver R-01. **Validar**: confirmar con la cátedra qué se entrega (código, informe, presentación).

### SU-06 — Modelo comercial (suscripción en ARS, plan gratuito) aún sin definir
**Origen**: discovery pregunta 7 sin respuesta. Competidores locales ofrecen plan gratuito (presión de precio).
