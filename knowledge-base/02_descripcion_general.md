# Descripción General

## Stack tecnológico (fijado por el usuario)

| Capa | Tecnología | Versión mínima |
|---|---|---|
| Frontend | **TypeScript vanilla** (sin framework: sin React/Vue/Angular), HTML + CSS, bundler liviano (a definir, ej. Vite o `tsc` + ES modules) | TS 5.x (supuesto) |
| Backend | **Spring Boot**, API REST | Spring Boot 3.x / Java 17+ (supuesto) |
| Build backend | **Gradle** | 8.x (supuesto) |
| Persistencia | **Hibernate / JPA** (Spring Data JPA) | según Boot |
| Base de datos | **MySQL** | 8.x (supuesto) |
| Migraciones | Flyway o Liquibase (sugerido, ver DD-05) | — |
| Email | SMTP gratuito (ej. Gmail SMTP con contraseña de aplicación, u otro proveedor free tier) vía Spring Mail | — |
| Mensajería | Enlaces `wa.me` generados por el sistema (sin API) | — |

Versiones exactas: no especificadas por el usuario; son supuestos (ver SU-04).

## Arquitectura general

Cliente-servidor, monolito modular en el backend:

```
Navegador (SPA TypeScript vanilla)
        |  HTTPS, JSON, JWT (o sesión; ver DD-04)
        v
Spring Boot API REST (controllers -> services -> repositories JPA)
        |
        v
MySQL (esquema único, multi-tenant por columna consultorio_id)
        |
        +--> SMTP gratuito (recordatorios por email)
Frontend genera enlaces wa.me (no hay llamada a servidor de WhatsApp)
```

Decisiones de alto nivel:
- **Monolito modular** (no microservicios): equipo de 5, plazo mínimo.
- **Multi-tenant por columna** (`consultorio_id`) desde el inicio, para crecer a clínicas sin rediseñar (DD-02).
- Frontend sin framework: se organiza en módulos TS (páginas, componentes, cliente API, estado simple).

## Integraciones externas

| Servicio | Propósito | Tipo | Estado |
|---|---|---|---|
| WhatsApp `wa.me` | Recordatorio/confirmación manual con mensaje prearmado | Deep link (sin API) | MVP |
| SMTP gratuito | Recordatorios y notificaciones por email | SMTP | MVP |
| Mercado Pago | Seña de turno | REST/webhook | Posterior (a lo sumo sandbox opcional) |
| WhatsApp Business API (Meta) | Envío automático | REST | Descartado por costo (presupuesto cero) |
| Google Calendar | Sincronización | REST/OAuth | Posterior |
| ARCA, PUCO/obras sociales | Facturación, cobertura | REST/SOAP | Posterior |

## API REST (resumen; detalle a definir en diseño)

| Recurso | Endpoints principales |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh` |
| Consultorio | `GET/PUT /api/consultorio` |
| Profesionales / Sillones / Prestaciones | CRUD `/api/profesionales`, `/api/sillones`, `/api/prestaciones` |
| Pacientes | CRUD `/api/pacientes`, `GET /api/pacientes/{id}/ficha` |
| Turnos | `GET /api/turnos?desde&hasta&sillon`, `POST /api/turnos`, `PATCH /api/turnos/{id}/estado`, `PUT /api/turnos/{id}` (reprogramar) |
| Bloqueos | CRUD `/api/bloqueos` |
| Recordatorios | `GET /api/turnos/{id}/recordatorio/whatsapp` (devuelve enlace wa.me), `POST /api/turnos/{id}/recordatorio/email` |
| Auditoría | `GET /api/auditoria` |
| Exportación | `GET /api/pacientes/{id}/export` |
