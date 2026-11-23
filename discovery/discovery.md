# Discovery: sistemas odontológicos de gestión de turnos y agenda (Argentina / LATAM)

Fecha de consulta de todas las fuentes: 2026-11-23. Insumo: `docs/consigna.txt`. Notas por competidor (esquema fijo de `web-scraper`) en `discovery/sources/`.

## Metodología y criterios de evidencia

- Solo se relevaron fuentes accesibles por WebFetch/WebSearch: sitios oficiales, páginas de precios, centros de ayuda, ficha de marketplaces y notas de prensa. Capterra y GetApp devolvieron HTTP 403 y solo se usaron como referencia de buscador (no como evidencia de funciones).
- **Comprobado** = la función o dato figura en la página oficial del proveedor (o en su ayuda), aunque siga siendo una descripción del propio proveedor; no implica haber usado el producto. **Afirmación comercial** = cifra o promesa de resultado del proveedor (clientes, "hasta 85 % menos ausencias", "el mejor") o dato publicado por un competidor en su blog. **No evidenciado** = no aparece en las fuentes consultadas; no equivale a "no existe".
- Ningún sistema fue probado en demo. Todas las puntuaciones de la sección B son estimaciones sobre evidencia pública y deben validarse con demos.
- Sesgo declarado: los blogs de Odonthia y Docfav comparan productos propios con ajenos; se usaron solo como pista de candidatos y, cuando se citan, se rotulan como "según competidor".
- Los precios en pesos están sujetos a inflación y cambian con frecuencia; son los vistos el 2026-11-23.
- Candidatos mencionados solo en blogs de competidores y sin sitio oficial localizable (DentalTec, Odonto.ar) no se incluyen en las tablas. Bilog se incluye con evidencia indirecta, sin puntuar.

## A. Tabla comparativa (ordenada por relevancia para Argentina)

Leyenda: SI = comprobado en fuente oficial; AC = afirmación comercial; NE = No evidenciado; S = SaaS/nube. Moneda según el sitio.

| # | Sistema (proveedor, país) | URL oficial | Segmento / modalidad | Agenda y turnos digitales | Automatización | Clínica | Administración / integraciones locales | Seguridad | Precio publicado | Adopción |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | DentalSoft (Argentina) | https://dentalsoft.com.ar/ | Consultorio/clínica; S | SI: diaria/semanal/mensual, bloqueos, urgencias, multi-profesional y sucursal, Google Calendar; reserva online 24/7 (Pro) | WhatsApp manual (Gestión) / automático (Pro, Meta cobra); email automático. Lista de espera NE | SI odontograma FDI 18 estados; periodontograma NE; imágenes 5-10 GB; presupuestos | SI caja, Mercado Pago (Pro), liquidación de obras sociales; ARCA NE | Roles, backup y exportación (SI); cifrado NE | Gratis (3 meses, 50 turnos); $30.000; $60.000 (moneda sin código) | AC "11 reseñas Google 5,0"; "300 clínicas" solo según competidor |
| 2 | Odonthia (Genera Impacto, Argentina) | https://odonthia.com/ | Consultorio; S | SI agenda, reserva online, sincronización de calendario | WhatsApp automático en planes pagos; resto NE | SI odontograma FDI (temporales), periodontograma, firma electrónica, portal paciente | Caja, presupuestos, obras sociales mencionadas; facturación NE | SI registro de actividad, exportación, respaldo | Gratis sin vencimiento; $78.700 y $162.500 ARS/mes con IVA (US$47/97 fuera de AR) | AC 4.735 consultorios en 22 países (registrados, no activos) |
| 3 | DentalCore (La Plata, Argentina) | https://dentalcore.app/ | Consultorio/clínica; S | SI multi-doctor, sala de espera, portal sin instalación | SI confirmación WhatsApp (API oficial Meta)/email/SMS, recall por segmentos, recuperación de tratamientos | SI odontograma, periodontograma, módulos por especialidad, 22 consentimientos | SI Mercado Pago, ARCA, liquidación de 65 obras sociales, caja, FHIR | SI TLS, AES-256 en backups, 2FA, auditoría; ISO 27001 "sigue controles", NO certificado | $75.000 ARS/mes (2 usuarios) +$15.000 por usuario; FAQ dice USD 50 (inconsistente); prueba 7 días | NE (sin clientes ni casos) |
| 4 | AgendaPro (Chile/México; sitio AR) | https://agendapro.com/ar/dental/software-odontologico | Consultorio/clínica y otras verticales; S + apps | SI turnos 24/7 por odontólogo/práctica/sillón, Google Calendar, Google Maps | SI recordatorios WhatsApp/SMS/email; IA en WhatsApp, Instagram, Messenger; campañas | SI odontograma digital, ficha, consentimiento, recetas, presupuestos; periodontograma NE | Mercado Pago (seña/cuotas) SI; obras sociales y ARCA NE | Cifrado y backups (declarado); cita Leyes 25.326 y 26.529 | Desde $13.900 ARS/mes; prueba 14 días | AC "+30.000" clínicas / "135.000" profesionales (inconsistentes) |
| 5 | ClinIA / OdontoClinIA (Emprinet, Argentina) | https://www.clinia.com.ar/odontologia | Consultorio a hospital/cadena; S | SI agenda por profesional/consultorio; IA para pedir turno por WhatsApp | Recordatorios WhatsApp/email | SI odontograma 52 piezas versionado, HC CIE-10 | SI ARCA, PUCO (cobertura), caja con arqueo, receta electrónica ReNaPDiS (solo recetario) | Backups cada 10 min, acceso controlado | No publicado; demo 45 min | NE |
| 6 | Dentalink (Chile; módulo Argentina) | https://web-es.softwaredentalink.com/ | Consultorio/clínica; S | SI WhatsApp, reserva por redes, Contact Center IA | SI confirmaciones/recordatorios WhatsApp y email | SI odontograma y periodontograma, presupuestos | Ayuda oficial: obras sociales, conciliaciones, receta electrónica AR; ARCA NE | RGPD y "trazabilidad" (AC); ISO NE en sitio oficial | Cotización; USD 35/50/75 solo según competidor | AC "+15.000 clientes" |
| 7 | Docfav (Argentina) | https://pro.docfav.com/es-ar | Consultorio generalista; S | SI agenda y portal de reserva/confirmación/cancelación | SI recordatorios WhatsApp y email | Odontograma NE; firma electrónica SI | Cobros SI; obras sociales y facturación NE | Cifrado, servidores UE, declara Ley 25.326 (AC) | USD (blog propio: 19 + 7 por profesional); prueba 100 turnos o 30 días | NE |
| 8 | YoFacturo (Argentina) | https://yo-facturo.com/clinicas/ | PyME y consultorios; S | Agenda por profesional, turnero (plan Completo) | Recordatorios WhatsApp/email | Sin HC ni odontograma (lo declara) | SI facturación ARCA, obras sociales como cuenta corriente, API (Premium) | Roles; auditoría y MFA (Premium) | $20.000 a $150.000 ARS/mes; 30 días gratis | NE |
| 9 | Doctocliq (Perú) | https://www.doctocliq.com/ | Consultorios dentales y médicos; S + apps | SI agenda compartida; reserva online no descripta | SI confirmación automática; IA en WhatsApp (Soyla) | SI odontograma, presupuestos, plan de tratamiento | Facturación por país (AR no listada) | Roles; exportación a pedido | Plan gratis; USD 19-49 según terceros | AC "+6.500 profesionales" |
| 10 | OdontoGRAMA (Argentina, titular Julio Santolo) | https://odontograma.com.ar/ | Consultorio; S | SI agendas con control de asistencia | NE | SI ficha con imágenes, tratamientos | SI caja, cuentas corrientes, facturación a prepagas/obras sociales | NE ("protegidos 24x7") | Gratis (sin precios) | NE |
| 11 | OdontoApp (LATAM) | https://odontoapp.com.ar/ | Odontólogos; S | Agenda digital | Recordatorios automáticos | Odontograma, HC | NE | NE | NE | AC ">100" clientes |
| 12 | Bilog (Argentina) | sin sitio oficial localizado | Consultorio/clínica | NE | NE | Según competidor: odontograma | Según competidor: liquidación y auditoría de obras sociales | NE | Según competidor: freemium 50 pacientes | Según competidor: "+20 años" |
| 13 | Órbita (La Plata, Argentina) | sin sitio oficial localizado; nota en Ámbito 28/07/2026 https://www.ambito.com/tecnologia/desarrollo-nacional-crearon-una-ia-argentina-que-organiza-turnos-medicos-whatsapp-y-ya-se-prueba-consultorios-n6304027 | No odontológico específico; chatbot IA | SI (prensa) turnos, cancelación, reprogramación por WhatsApp | SI recordatorios (prensa) | No aplica | NE | NE | NE | Solo "se prueba en consultorios" |
| 14 | Medesk (país NE) | https://www.medesk.net/es/solutiones/odontologia | Clínicas; S | SI agenda inteligente, Google Calendar | Mensajes automáticos (canal NE) | SI odontograma | Facturación electrónica genérica; sin AR | GDPR declarado | Cotizador | AC ">50 países" |
| 15 | Nimbo (Ecaresoft, México; sitio AR) | https://www.nimbo-x.com/odontograma | Odontólogos; S | Agenda y recordatorios | WhatsApp NE | SI odontograma adulto/infantil, receta | NE | Disponibilidad 99,99 % (AC) | MXN 144/mes (sitio México); prueba 14 días | NE |
| 16 | Dentidesk (Chile) | https://dentidesk.com (solo dominio vía terceros; no accedido) | Clínicas; S + app iPad | Agenda (terceros) | NE | Odontograma (TrustRadius) | NE | NE | No publicado | NE |
| 17 | Clinic Cloud / Doctoralia (España) | https://www.clinic-cloud.com/ | Consultorios; S | SI agenda, reserva vía Doctoralia | SI WhatsApp, SMS, email | Odontograma NE | Facturación España (Verifactu); sin AR | RGPD declarado | No publicado; prueba gratis | AC "+12.000 doctores" |
| 18 | Odontonet (España) | https://www.softwaredoit.es/odontonet/odontonet.html (directorio de terceros) | Clínicas; nube/local | Agenda, sala de espera | SMS | SI odontograma 3D y periodontograma (descripción de directorio) | Sin AR | NE | No publicado | 1 reseña de 2/5 (2024) |
| 19 | Open Dental (EE. UU.) | https://www.opendental.com/ | Clínicas; despliegue NE | Web Sched | Texting y mensajes automáticos | Periodontograma NE en la página | Sin AR | NE | Sin cifras | Capterra UK 4,6 (88 reseñas, vía buscador; no verificado) |

Observación: Doctoralia Pro (Docplanner) figura en Argentina según un listado de terceros; no se accedió a un sitio oficial argentino, por lo que no se puntúa por separado.

## B. Matriz de puntuación (0-5) y puntaje ponderado

Pesos: Turnos y automatización 25 %, Clínica 20 %, Integraciones locales y WhatsApp 15 %, Administración/cobros/facturación 15 %, Experiencia del paciente 10 %, Seguridad/exportación/trazabilidad 10 %, Precio y adopción 5 %. Puntaje = suma(nota x peso). Escala: 0 = No evidenciado; 3 = cubre lo básico con evidencia oficial; 5 = cobertura completa evidenciada. Las notas son criterio del analista, no mediciones; una función "NE" puntúa bajo aunque pueda existir.

| Rank | Sistema | Turnos | Clínica | Integr. | Admin | Paciente | Seguridad | Precio | Ponderado |
|---|---|---|---|---|---|---|---|---|---|
| 1 | DentalCore | 4 | 5 | 4.5 | 4.5 | 4 | 4.5 | 3 | **4.35** |
| 2 | Dentalink | 4 | 4.5 | 3.5 | 4 | 3.5 | 3.5 | 2.5 | **3.85** |
| 3 | AgendaPro | 4.5 | 3 | 4 | 3 | 4.5 | 3.5 | 4 | **3.77** |
| 4 | DentalSoft | 4.5 | 3.5 | 3 | 3.5 | 4 | 3 | 4.5 | **3.73** |
| 5 | ClinIA / OdontoClinIA | 3.5 | 4 | 4 | 4 | 2.5 | 3.5 | 2 | **3.58** |
| 6 | Odonthia | 3.5 | 4 | 2.5 | 2.5 | 3.5 | 3.5 | 5 | **3.38** |
| 7 | Doctocliq | 3.5 | 3.5 | 2.5 | 2.5 | 3 | 2.5 | 4.5 | **3.10** |
| 8 | Docfav | 4 | 2 | 2.5 | 2 | 4 | 3.5 | 4.5 | **3.05** |
| 9 | Clinic Cloud | 4 | 2 | 2 | 2 | 4 | 3.5 | 2.5 | **2.88** |
| 10 | Medesk | 3 | 3.5 | 1.5 | 3 | 2.5 | 3 | 3 | **2.83** |
| 11 | Open Dental | 3 | 3 | 2 | 3 | 2.5 | 1.5 | 3 | **2.65** |
| 12 | Odontonet | 3 | 4 | 0.5 | 3 | 2 | 1.5 | 2 | **2.52** |
| 13 | YoFacturo | 2.5 | 0.5 | 3.5 | 4 | 1 | 3.5 | 3.5 | **2.48** |
| 14 | OdontoGRAMA | 2.5 | 3 | 0.5 | 3.5 | 1 | 1.5 | 4.5 | **2.30** |
| 15 | Nimbo | 2.5 | 3.5 | 1 | 1.5 | 1.5 | 2.5 | 4 | **2.30** |
| 16 | Dentidesk | 2.5 | 3.5 | 1 | 2 | 2 | 1.5 | 2 | **2.23** (evidencia solo de terceros) |
| 17 | OdontoApp | 2 | 3 | 1 | 1 | 1.5 | 1 | 2 | **1.75** |
| 18 | Órbita | 3 | 0 | 3 | 0 | 3.5 | 1 | 1 | **1.70** (solo prensa; no es sistema de gestión) |

Bilog no se puntúa (sin fuente oficial). Advertencia crítica: el liderazgo de DentalCore se apoya en autodescripción de un producto joven sin clientes públicos; que puntúe primero refleja amplitud declarada, no calidad demostrada. Dentalink y AgendaPro tienen más adopción afirmada, pero con cifras no auditables.

## C. Análisis competitivo

### C.1 Funcionalidades que ya son estándar de mercado (presentes en la mayoría de los sistemas con evidencia oficial)
- Agenda multi-profesional con vistas diaria/semanal y sincronización con Google Calendar (DentalSoft, AgendaPro, DentalCore, Medesk).
- Recordatorios automáticos por WhatsApp o email (DentalSoft Pro, Odonthia, AgendaPro, DentalCore, Docfav, ClinIA, Dentalink). Nota: en varios casos el envío automático por WhatsApp es de pago o está limitado a planes altos, y Meta cobra el mensaje.
- Odontograma digital (con notación FDI en DentalSoft, Odonthia, ClinIA).
- Presupuestos y caja diaria.
- Plan gratuito o prueba sin tarjeta (DentalSoft, Odonthia, OdontoGRAMA, Doctocliq, AgendaPro, Docfav).
- Reserva online 24/7 (DentalSoft Pro, Odonthia, AgendaPro, Docfav).

### C.2 Diferenciadores reales (pocos sistemas, con evidencia oficial)
- Facturación ARCA integrada: DentalCore, ClinIA, YoFacturo. Ausente o NE en DentalSoft, Odonthia, AgendaPro, Dentalink.
- Liquidación y gestión de obras sociales: DentalSoft, DentalCore (65 precargadas), Dentalink (ayuda oficial), OdontoGRAMA; verificación de cobertura vía PUCO solo en ClinIA.
- Periodontograma y módulos por especialidad: DentalCore, Dentalink, Odonthia (mencionado).
- Recall y recuperación de pacientes por segmentos: DentalCore; campañas en AgendaPro y Dentalink Titanium.
- Receta electrónica argentina: ClinIA (ReNaPDiS, solo recetario), Dentalink (módulo AR, solo título de ayuda), DentalCore (en trámite).
- Seña/pago con Mercado Pago: AgendaPro, DentalSoft Pro, DentalCore.
- IA conversacional en WhatsApp (AgendaPro "Alex", ClinIA, Dentalink, Doctocliq, Órbita): hoy más una afirmación comercial que una función verificable; ninguno publica tasa de resolución ni de derivación.
- Auditoría y trazabilidad visibles: DentalCore (log no editable), Odonthia (registro de actividad), YoFacturo (Premium).
- Interoperabilidad (HL7 FHIR): DentalCore, ClinIA.

### C.3 Vacíos frecuentes en el mercado argentino
1. Ningún sistema evidencia la combinación completa "turnero online con sillón/box + lista de espera + seña Mercado Pago + facturación ARCA + obras sociales" a precio de consultorio. La lista de espera no figura (No evidenciado) en ninguno de los sistemas relevados.
2. Obras sociales: la gestión real (nomencladores actualizados, autorizaciones, rechazos, formatos de liquidación) está mal documentada públicamente. Las guías del sector advierten que los cambios de requisitos generan rechazos de facturación, pero ningún proveedor publica frecuencia de actualización de nomencladores ni formatos soportados.
3. Cumplimiento normativo: casi todos "mencionan" la Ley 25.326 o 26.529 sin documentación pública verificable (DPA, registro ante AAIP, política de retención de la HC, ubicación de datos). Docfav declara servidores en la UE; DentalCore aclara que no está certificado ISO 27001. La firma electrónica se ofrece sin aclarar su validez en la HC (Odonthia aclara que no es firma digital).
4. Seguimiento de ausentes y recuperación: pocas funciones evidenciadas con métricas; las cifras de reducción de ausentismo son afirmaciones comerciales.
5. Precios en USD o por cotización dificultan la planificación en un contexto de inflación; los precios en ARS publicados cambian rápido y varían entre página y blog del mismo proveedor.
6. Portabilidad y salida: exportación evidenciada solo en DentalSoft, Odonthia, DentalCore (PDF/FHIR), Dentalink (parcial) y Doctocliq (a pedido); la migración desde otro sistema se promete poco.
7. Evidencia de adopción casi inexistente: ningún proveedor argentino publica casos de éxito nombrados ni reseñas verificadas en el sitio.

### C.4 Oportunidades de innovación para un sistema nuevo
- Agenda por sillón/box con duración variable por prestación, prevención de solapamientos, sobreturnos y lista de espera con reasignación automática de huecos por cancelación (hueco liberado se ofrece por WhatsApp al siguiente paciente en espera).
- Confirmación y seña por Mercado Pago integradas al turno, con política de cancelación configurable y bloqueo de huecos hasta confirmar.
- Motor de obras sociales transparente: cobertura, copago y requisitos por práctica visibles al dar el turno; nomencladores versionados y publicados.
- Prevención de ausentismo con scoring de riesgo por paciente (basado en historial propio, sin cifras prometidas) y secuencias de recordatorio y recall por tratamiento pendiente.
- Seguridad y privacidad verificables: página pública de cumplimiento con datos reales (ubicación de datos, cifrado, DPA, retención), auditoría de accesos a la HC, exportación completa autoservicio.
- Experiencia del paciente: enlace de reserva único (web, Instagram, WhatsApp, Google), reprogramación autoservicio, sin descarga de app.
- Precio en ARS con indexación explícita, plan gratuito real y migración asistida desde planillas/otros sistemas.

## D. Recomendación final

### D.1 Cinco competidores prioritarios para demo
1. DentalCore: mayor cobertura declarada (ARCA, obras sociales, WhatsApp API oficial, auditoría); validar si la profundidad coincide con lo anunciado y qué tan maduro está (sin clientes públicos).
2. Dentalink: referente regional con módulo Argentina; validar manejo real de obras sociales, ARCA y receta electrónica.
3. AgendaPro: referente en experiencia del paciente, marketing y reserva; validar odontograma real, seña con Mercado Pago y ausencia de obras sociales/ARCA.
4. DentalSoft: competidor local directo, mejor turnero online a precio publicado en pesos; validar liquidación de obras sociales y automatización WhatsApp.
5. ClinIA / OdontoClinIA: integraciones con entes argentinos (PUCO, ARCA, ReNaPDiS); validar usabilidad y facilidad para un consultorio pequeño.
Menciones para seguimiento: Odonthia (modelo freemium con IA) y Bilog (sin fuente oficial hallada; pedir demo si se confirma).

### D.2 Tres referentes de experiencia de usuario
1. AgendaPro: reserva en múltiples canales y apps para profesional y paciente.
2. DentalSoft: turnero online en cuatro pasos y recordatorio con mensaje listo para enviar.
3. Odonthia: onboarding gratuito sin tarjeta, odontograma FDI simple y registro de actividad visible.
(La elección de UX es una hipótesis basada en descripciones públicas; debe confirmarse en demo/prueba.)

### D.3 MVP sugerido
**Imprescindibles (estándar de mercado + núcleo del problema)**
- Agenda diaria/semanal multi-profesional y multi-sillón/box, duración variable por prestación, bloqueos, sobreturnos y prevención de solapamientos.
- Alta de paciente y ficha básica (datos, anamnesis simple, notas).
- Reserva online por enlace público con confirmación, cancelación y reprogramación.
- Recordatorios y confirmación por WhatsApp (API oficial) y email.
- Roles y permisos básicos, registro de auditoría de cambios, exportación de datos.
- Cumplimiento básico de datos de salud: cifrado, backups, consentimiento de tratamiento de datos.

**Diferenciadores (priorizar los que el mercado no evidencia)**
- Lista de espera con reasignación automática de huecos por cancelación.
- Seña/pago por Mercado Pago atada al turno.
- Seguimiento de ausentes y recall por tratamiento pendiente.
- Página pública de seguridad y cumplimiento verificable.

**Etapas posteriores**
- Odontograma FDI y periodontograma, presupuestos y planes de tratamiento, imágenes/radiografías.
- Obras sociales: nomencladores, liquidaciones, autorizaciones (alto costo de mantenimiento; evaluar integración antes de construir).
- Facturación ARCA, caja, reportes y métricas de ocupación.
- Portal del paciente, multisucursal, firma electrónica/digital, receta electrónica, integraciones (Google Calendar, API pública), IA.

## Checklist de Discovery (derivado de la evidencia; sin confirmación del usuario)

### Problema
Los consultorios y clínicas odontológicas argentinas gestionan turnos con WhatsApp manual, agendas en papel o herramientas genéricas; sufren ausentismo, huecos sin cubrir y carga administrativa. Los sistemas existentes cubren partes del problema, pero ninguno evidencia públicamente la integración de agenda por sillón, lista de espera, seña con Mercado Pago, ARCA y obras sociales. (Hipótesis de problema del consultorio: no validada con usuarios; ver Preguntas abiertas.)

### Usuarios
- Odontólogo independiente o de consultorio chico.
- Clínica con varios profesionales y sillones.
- Recepcionista/secretaria (usuario diario de la agenda).
- Paciente (reserva, confirma, cancela).
- Administrador/dueño de clínica (caja, obras sociales, métricas).

### Casos de uso
- Reservar, confirmar, cancelar y reprogramar un turno (paciente y recepción).
- Ocupar huecos por cancelación desde la lista de espera.
- Registrar ausentes y recuperar pacientes.
- Cobrar seña por Mercado Pago.
- Consultar agenda del día por profesional y sillón.
- Atender a un paciente con obra social (cobertura y copago).

### Competidores
Ver sección A (19 sistemas) y notas en `discovery/sources/`. Prioritarios: DentalCore, Dentalink, AgendaPro, DentalSoft, ClinIA.

### Funcionalidades necesarias
Las listadas como imprescindibles en D.3.

### Funcionalidades opcionales
Las listadas como diferenciadores y etapas posteriores en D.3 (odontograma, periodontograma, presupuestos, imágenes, IA, portal, firma, receta electrónica).

### Reglas de negocio (a validar)
- Un sillón/profesional no puede tener dos turnos solapados; los sobreturnos son excepciones explícitas y auditadas.
- La duración depende de la prestación y puede ser variable.
- Políticas de cancelación y seña configurables por consultorio.
- Un turno liberado ofrece el hueco a la lista de espera según prioridad.
- Los datos de salud son sensibles (Ley 25.326); acceso por rol y trazabilidad de cada lectura o cambio de la ficha.
- La historia clínica debe conservarse conforme a la Ley 26.529 (plazo y requisitos de conservación a verificar con asesoría legal).

### Integraciones
WhatsApp Business API (Meta, con costo por mensaje), Mercado Pago, Google Calendar, ARCA (facturación, etapa posterior), PUCO/obras sociales (etapa posterior), email/SMS, redes sociales para reserva.

### Restricciones
- Costo y políticas de plantillas de WhatsApp (Meta cobra por mensaje, según DentalSoft).
- Normativa argentina de datos personales y de salud.
- Mantenimiento de nomencladores de obras sociales.
- Presupuesto y plazo académico/de equipo (a confirmar).
- Dependencia de proveedores externos (Meta, Mercado Pago).

### Riesgos
- Supuesto no verificado: que el ausentismo y los huecos sean el dolor principal del segmento (solo hay cifras de proveedores).
- Competidores locales con plan gratuito (Odonthia, DentalSoft) comprimen el precio.
- Las obras sociales son costosas de mantener y pueden desbordar el MVP.
- Cumplimiento legal de datos de salud y de firma electrónica.
- Dependencia de la API de WhatsApp (costos, aprobaciones, cambios de política).
- Rápido avance de la IA conversacional en WhatsApp (AgendaPro, ClinIA, Órbita).
- Sesgo de la evidencia: casi todo proviene de marketing de los proveedores.

### Preguntas abiertas
1. ¿Segmento inicial: odontólogo independiente, consultorio o clínica? ¿Cuántos sillones/profesionales como máximo?
2. ¿Hay acceso a odontólogos o recepcionistas para entrevistas y validación del dolor real?
3. ¿Qué obras sociales y prepagas deben soportarse en el MVP, si alguna?
4. ¿El MVP debe emitir facturas ARCA o basta con registrar cobros?
5. ¿Se usará WhatsApp Business API oficial (costo por mensaje) o un enlace manual `wa.me` en la primera etapa?
6. ¿Cuál es el stack, equipo, plazo y presupuesto del proyecto? (decisión posterior, KB)
7. ¿Modelo comercial pretendido (gratis con límites, suscripción en ARS o USD)?
8. ¿Dónde se alojarán los datos (restricciones de residencia) y quién será el responsable ante la AAIP?
9. Confirmar por demo: odontograma real de AgendaPro, ARCA y obras sociales de Dentalink, liquidación de DentalSoft, madurez de DentalCore.
10. Localizar fuentes oficiales de Bilog, DentalTec, Odonto.ar y Dentidesk.
11. Confirmar con asesoría legal plazos de conservación de la HC y validez de la firma electrónica en consentimientos.

## Fuentes (todas consultadas el 2026-11-23)

Oficiales y de ayuda:
- https://dentalsoft.com.ar/
- https://odonthia.com/
- https://dentalcore.app/
- https://agendapro.com/ar/dental/software-odontologico
- https://web-es.softwaredentalink.com/ y https://web-es.softwaredentalink.com/en/planes
- https://ayuda.softwaredentalink.com/es/collections/19196578-modulo-exclusivo-para-argentina
- https://www.clinia.com.ar/odontologia
- https://pro.docfav.com/es-ar
- https://yo-facturo.com/clinicas/
- https://www.doctocliq.com/
- https://odontograma.com.ar/
- https://odontoapp.com.ar/
- https://www.nimbo-x.com/odontograma
- https://www.medesk.net/es/solutiones/odontologia
- https://www.clinic-cloud.com/
- https://www.opendental.com/

Terceros (no oficiales; tratar como afirmación):
- Odonthia, comparativa (proveedor con interés comercial): https://odonthia.com/blog/mejores-software-odontologicos-argentina-2026
- Docfav, comparativa (proveedor con interés comercial): https://pro.docfav.com/es-ar/blog/mejores-software-odontologos
- Ámbito, nota sobre Órbita (2026-07-28): https://www.ambito.com/tecnologia/desarrollo-nacional-crearon-una-ia-argentina-que-organiza-turnos-medicos-whatsapp-y-ya-se-prueba-consultorios-n6304027
- Develop Argentina, guía de software para clínicas (proveedor de desarrollo a medida; rangos genéricos): https://developargentina.com/blog/software-clinicas-consultorios-argentina-2026
- SoftDoit, ficha de Odontonet: https://www.softwaredoit.es/odontonet/odontonet.html
- Pabau, precios de Doctocliq (competidor): https://pabau.com/es/blog/precios-de-doctocliq/
- Resultados de buscador no abiertos (solo orientativos): Capterra y GetApp (HTTP 403), TrustRadius/Capterra de Dentidesk, ficha de Doctoralia Pro y Noa en Capterra.

Bloqueos: Capterra y GetApp (403); `www.dentalink.com` y `pro.doctoralia.com.ar` no resolvieron.
