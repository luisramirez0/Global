# Arquitectura Propuesta

Propuesta: sujeta a revisión del equipo. El stack está fijado; el resto son supuestos.

## Patrones aplicados

| Patrón | Dónde | Por qué |
|---|---|---|
| Capas (Controller -> Service -> Repository) | Backend | Simple y conocido por el equipo |
| DTOs + mappers | API | No exponer entidades JPA |
| Multi-tenant por columna (`consultorio_id`) | Persistencia | Crecer a clínicas sin rediseño |
| Filtro de tenant centralizado (Hibernate filter o especificación base) | Repositorios | Evitar fugas entre consultorios |
| Máquina de estados de turno | Dominio | Transiciones válidas (RN-AG-05) |
| Auditoría por aspecto/evento | Transversal | RN-DS-02 |
| Módulos TS + cliente API tipado | Frontend | Estructura sin framework |

## Estructura de directorios (propuesta)

```
global/
├── backend/                      (Gradle, Spring Boot)
│   └── src/main/java/.../
│       ├── config/  security/  common/
│       ├── consultorio/  usuario/  paciente/
│       ├── agenda/   (turno, bloqueo, sillon, prestacion)
│       ├── recordatorio/  auditoria/
│   └── src/main/resources/ (application.yml, db/migration)
│   └── src/test/
├── frontend/                     (TypeScript vanilla)
│   └── src/
│       ├── api/  (cliente HTTP tipado)
│       ├── pages/ (login, agenda, pacientes, ficha)
│       ├── components/  state/  utils/
│   └── index.html, tsconfig.json
├── knowledge-base/  discovery/  openspec/
```

## Seguridad

- Autenticación: JWT de corta duración + refresh (o sesión por cookie HttpOnly; ver DD-04).
- Autorización: roles ADMIN/PROFESIONAL/RECEPCION con Spring Security; filtro por tenant.
- Validación de input: Bean Validation en backend; sanitización en frontend (evitar `innerHTML` con datos de usuario: riesgo XSS al no usar framework).
- Secrets: variables de entorno; nunca en el repo.
- Hash de contraseñas: BCrypt/Argon2.
- CORS restringido al origen del frontend; HTTPS en producción.
- Auditoría inmutable de accesos a datos de salud.
- Cumplimiento: Ley 25.326 y Ley 26.529 (**verificación legal pendiente**).

## Despliegue (presupuesto cero)

Sin supuestos de hosting pago. Para la entrega académica: ejecución local/Docker Compose (MySQL + backend + frontend estático). Opciones free tier (a evaluar): ver PA-09. `needs_infra`: sí (MySQL + backend).

## Variables de entorno

| Variable | Descripción | Ejemplo | Sensible |
|---|---|---|---|
| `DB_URL` | JDBC MySQL | `jdbc:mysql://localhost:3306/global` | N |
| `DB_USER` / `DB_PASSWORD` | Credenciales DB | — | Y |
| `JWT_SECRET` | Clave de firma | (aleatoria) | Y |
| `JWT_EXPIRATION_MIN` | Vigencia token | `30` | N |
| `SMTP_HOST` / `SMTP_PORT` | Servidor SMTP gratuito | `smtp.gmail.com`/`587` | N |
| `SMTP_USER` / `SMTP_PASSWORD` | Credenciales SMTP | — | Y |
| `APP_BASE_URL` | URL pública del frontend | `http://localhost:5173` | N |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos | `http://localhost:5173` | N |
