# Proposal

## Why

Todos los changes del MVP (C-03 auth, C-04 configuración, C-05 pacientes, C-06 auditoría, C-07 turnos, C-08 ficha, C-09 recordatorios) necesitan un esquema y un modelo de entidades común, y el SaaS es multi-tenant por columna (DD-02): sin un aislamiento por `consultorio_id` centralizado y probado desde el inicio, cada change tendría que reimplementarlo y una sola consulta olvidada filtraría datos de salud entre consultorios (RN-MT-01, RN-DS-01, Ley 25.326). C-02 está en el camino crítico (C-01 → C-02 → C-03) y es governance CRÍTICA.

## What Changes

- Migración Flyway `V1` con las tablas de cuenta y configuración de agenda: `consultorio`, `usuario`, `profesional`, `sillon`, `prestacion`, `horario_atencion`, `bloqueo_agenda`.
- Migración Flyway `V2` con las tablas de pacientes, agenda y trazabilidad: `paciente`, `ficha_clinica`, `nota_clinica`, `consentimiento_texto` (catálogo global de versiones del texto), `consentimiento_datos`, `turno`, `recordatorio`, `audit_log` (insert-only), más el texto de consentimiento v1.
- Toda tabla de negocio con `consultorio_id`, `created_at` y `updated_at` (excepciones justificadas en design: `consultorio` es el tenant, `consentimiento_texto` es catálogo global, `audit_log` no tiene `updated_at` por ser inmutable). Las tablas hijas llevan FK compuesta `(consultorio_id, padre_id)` para que la base impida referencias cruzadas entre consultorios.
- SQL portable: las migraciones corren igual en H2 (`MODE=MySQL`) y MySQL 8 (regla 8).
- Entidades JPA internas (nunca expuestas en la API, regla 1), clase base `TenantEntity`, `TenantContext` (contexto de tenant por hilo) y aislamiento centralizado con `@TenantId` de Hibernate 6 + resolver que falla cerrado cuando no hay tenant.
- Repositorios Spring Data por agregado; `AuditLogRepository` sin operaciones de actualización ni borrado.
- Enums de dominio persistidos como texto: `Rol`, `EstadoTurno`, `CanalRecordatorio`, `EstadoRecordatorio`, `AccionAuditoria`.
- Seed: roles como enum (sin tabla), texto de consentimiento v1 (migración), catálogo de prestaciones sugeridas (código) y un admin de desarrollo creado solo en perfil `dev` con contraseña desde variable de entorno.
- Nuevas variables de entorno `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` (solo dev) y almacenamiento de fechas en UTC.
- Tests: aplicación limpia de migraciones en H2, aislamiento entre dos consultorios, fail-closed sin tenant, DNI único por consultorio, email único, `audit_log` no actualizable.

## Capabilities

### New Capabilities
- `tenant-isolation`: contexto de tenant, filtrado automático por `consultorio_id` en lecturas y escrituras, fail-closed sin tenant y modo sistema explícito.
- `persistence-schema`: esquema versionado con Flyway (tablas, columnas comunes, IDs, fechas UTC, enums, unicidades, índices y FKs de integridad entre consultorios).
- `audit-log`: almacenamiento inmutable (insert-only) del registro de auditoría; C-06 lo extiende con el aspecto que lo escribe.
- `seed-data`: datos iniciales (roles, texto de consentimiento v1, prestaciones sugeridas, admin de desarrollo).

### Modified Capabilities
- `runtime-configuration`: se agregan las variables de entorno del admin de desarrollo y la regla de zona horaria UTC para la persistencia.

## Impact

- **Código**: `backend/src/main/java/ar/global/odonto/{common,consultorio,usuario,paciente,agenda,recordatorio,auditoria}/` (entidades, enums, repositorios, `TenantContext`, resolver), `security/` (bean `PasswordEncoder` usado por el seed de dev; zona de riesgo, regla 12), `config/` (configuración JPA/Hibernate).
- **Esquema**: `backend/src/main/resources/db/migration/V1__*.sql`, `V2__*.sql` (primeras migraciones; una vez mergeadas no se editan, regla 6).
- **Configuración**: `application.yml` (propiedades Hibernate: resolver de tenant, `jdbc.time_zone=UTC`, update de entidades inmutables como error), `.env.example` (variables `DEV_ADMIN_*`).
- **Dependencias**: ninguna nueva (Spring Data JPA, Flyway, H2 y Spring Security ya están desde C-01).
- **Consumidores** (esperan al merge del PR único): C-03 pobla `TenantContext` desde el JWT y busca usuarios en modo sistema; C-04..C-09 construyen servicios sobre estas entidades y repositorios.
- **Entrega**: un único PR para todo C-02 (decisión del 2026-11-23, D10). Trade-off: C-03 (Gimena) y C-04 (Renzo) esperan al merge; mientras tanto pueden escribir sus tests contra `design.md`.
- **Riesgo**: governance CRÍTICA (modelo core + aislamiento de tenant); requiere aprobación del diseño antes de apply y review de integrante-1/2 en el PR. El bean `PasswordEncoder` (`security/PasswordConfig`, BCrypt costo 12) es zona de riesgo y requiere review del revisor de seguridad.
