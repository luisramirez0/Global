<!-- active-stack:agent-instruction -->
# Global (SaaS de turnos odontológicos) — Instrucciones para Agentes

SaaS multi-tenant de gestión de turnos para odontólogo independiente (Argentina). Presupuesto cero (`wa.me` + SMTP gratuito). Datos de salud sensibles (Ley 25.326 / 26.529). Entrega: 25/11/2026; MVP = C-01..C-16.

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | TypeScript vanilla (sin framework), HTML + CSS, bundler liviano, Vitest |
| Backend | Spring Boot 3.x / Java 17+, API REST |
| Build | Gradle 8.x |
| Persistencia | Hibernate / JPA (Spring Data JPA), MySQL 8.x, migraciones Flyway |
| Email | SMTP gratuito vía Spring Mail |
| Mensajería | Enlaces `wa.me` generados por el sistema (sin API) |

Versiones exactas = supuestos (KB 09, SU-04). Diseño visual diferido: ver `design-system/README.md`.

## Base de Conocimiento

Índice: [knowledge-base/README.md](knowledge-base/README.md)

| Doc | Contenido |
|---|---|
| [01](knowledge-base/01_vision_y_objetivos.md) | Visión, alcance MVP |
| [02](knowledge-base/02_descripcion_general.md) | Stack, integraciones, API |
| [03](knowledge-base/03_actores_y_roles.md) | Actores, RBAC |
| [04](knowledge-base/04_modelo_de_datos.md) | Entidades, seed |
| [05](knowledge-base/05_reglas_de_negocio.md) | Reglas RN-XX |
| [06](knowledge-base/06_funcionalidades.md) | Épicas e historias |
| [07](knowledge-base/07_flujos_principales.md) | Flujos |
| [08](knowledge-base/08_arquitectura_propuesta.md) | Patrones, directorios, seguridad, env vars |
| [09](knowledge-base/09_decisiones_y_supuestos.md) | DD-xx / SU-xx |
| [10](knowledge-base/10_preguntas_abiertas.md) | Riesgos y preguntas (PA-01..PA-04 de prioridad Alta: resolver/consultar antes de codear lo afectado) |

## Skills Disponibles

| Agente | Rol | Skills que carga |
|---|---|---|
| Fundación | Contexto e instrucciones | `kb-creator`, `roadmap-generator`, `agent-instruction`, `discovery-research`, `web-scraper`, `find-skills`, `skill-registry` |
| Orquestación OPSX | Cambios con OpenSpec | `openspec-explore`, `openspec-propose`, `openspec-apply-change`, `openspec-update-change`, `openspec-sync-specs`, `openspec-archive-change` |
| Backend | Implementación | `java-springboot`, `springboot-patterns`, `springboot-security`, `spring-boot-security-jwt`, `java-jpa-hibernate`, `springboot-tdd`, `java-junit`, `api-design-principles` |
| Frontend | Implementación | `vitest`, `javascript-testing-patterns`, `accessibility` |
| Equipo | Git y PRs | `git-workflow-and-versioning` |

> Skills instaladas globalmente por cada integrante (`npx skills add <repo>@<skill> -g`). Si una skill contradice este archivo, manda este archivo (por ejemplo, no se usa Testcontainers: ver regla 8).

> Los compact rules de cada skill los resuelve el orquestador desde [.atl/skill-registry.md](.atl/skill-registry.md) (generado por `skill-registry`; no versionado — no está en el repo).

## Roadmap de Changes

Fuente: [CHANGES.md](CHANGES.md) (leer el item y sus "Leer antes" antes de implementar).

- MVP C-01..C-16: setup, modelo de datos, auth JWT/RBAC, config del consultorio, pacientes, auditoría, turnos sin solapamiento, ficha clínica + consentimiento, recordatorios wa.me/email, frontend (shell, config, pacientes, agenda, recordatorios), export de auditoría, hardening/demo.
- Post-entrega C-17..C-22: NO se implementan para el 25/11.
- Camino crítico: C-01 → C-02 → C-03 → C-04 → C-07 → C-09 → C-14 → C-16.
- Primer change: C-01 `project-setup`. C-03 desbloquea al resto (fork de 5 lanes).
- Orden de recorte si falta tiempo: C-16 (solo hardening) → email de C-09 → exportación de C-15 → C-11 → C-14. Nunca C-01..C-08, C-10, C-12, C-13.

## Reglas Duras (específicas del proyecto)

> Reglas globales ya definidas en el archivo global de instrucciones del cliente activo (orquestador, governance, TDD, engram): el proyecto las hereda. Acá viven solo las reglas **específicas de este proyecto** + las universales que el global no cubra.

1. NUNCA exponer entidades JPA en la API → usar DTOs + mappers.
2. NUNCA consultar/escribir datos de negocio sin filtrar por `consultorio_id` → usar el filtro de tenant centralizado (Hibernate filter/especificación base); todo test de repositorio/servicio cubre el aislamiento entre consultorios.
3. NUNCA usar `innerHTML`/`insertAdjacentHTML` con datos de usuario en el frontend → `textContent` o creación de nodos DOM (sin framework no hay escape automático; riesgo XSS).
4. NUNCA usar `any` ni desactivar `strict` en TypeScript → tipos explícitos o `unknown` con narrowing; cliente API tipado en `src/api`.
5. NUNCA commitear secretos ni loguear datos de salud/PII (nombre, DNI, HC, contraseña, JWT) → todo por variables de entorno (`.env.example` sin valores reales); logs solo con IDs.
6. NUNCA cambiar el esquema a mano ni editar migraciones ya aplicadas → nueva migración Flyway versionada en `db/migration`; `ddl-auto` en `validate`/`none` fuera de tests.
7. NUNCA acceder a datos clínicos sin dejar auditoría ni permitir turnos solapados → todo acceso a ficha/export pasa por el aspecto de auditoría (RN-DS-02); el no-solapamiento se valida en el servicio y se cubre con tests de concurrencia y borde.
8. NUNCA mockear la base en tests de integración → correr contra H2 en memoria en modo de compatibilidad MySQL (`MODE=MySQL`), configurado en el perfil `application-test`, con las mismas migraciones Flyway que producción; evitar SQL nativo específico de MySQL y, si una consulta lo necesita, documentarlo y marcar ese test como pendiente de validar contra MySQL; los tests de dominio puro (máquina de estados, solapamiento) corren sin Spring.
9. NUNCA buildear/levantar el stack ni ejecutar `docker compose up` sin que se pida → los tests sí se corren (`./gradlew test`, `npm test`).
10. NUNCA commitear, pushear ni abrir PR sin autorización explícita de la persona → commits en Conventional Commits y con la línea Co-Authored-By vigente.
11. NUNCA introducir dependencias o servicios de pago (WhatsApp Business API, SMS, hosting) ni features post-entrega C-17..C-22 en el MVP → usar `wa.me` y SMTP gratuito; si algo queda fuera de alcance, escalar.
12. NUNCA tocar zonas de riesgo (auth/JWT/RBAC, auditoría, consentimiento, export de datos) sin avisar a los reviewers → implementar con checkpoints y describirlo en el PR para integrante-1/2.

## Flujo de Trabajo

KB → CHANGES.md (ficha C-XX) → alcance y criterios de aceptación → implementación con TDD y verificación → marcar `[x]` en CHANGES.md con evidencia.
<!-- /active-stack:agent-instruction -->

<!-- active-stack:team-mode -->
## Reglas de equipo

Proyecto de equipo (5 integrantes): la configuración vive en `.active-stack/team.json`; los nombres, en `.active-stack/team.local.json` (no versionado).

- Al iniciar la sesión, si existe `.active-stack/team.json`, usá la skill `active-delivery` para identificar a la persona y mostrar «qué me toca». Si no está disponible, aplicá lo de abajo a mano.
- Una ficha (C-XX) = una rama (`<id>-slug`) = un PR, usando `.github/pull_request_template.md`.
- El Responsable de cada ficha es el indicado en `CHANGES.md`; no trabajes fichas ajenas sin acordarlo.
- PRs siempre hacia `main`; nada directo a `main` y sin force-push. Commit, push y PR solo con autorización de la persona.
- Cambios en zonas de riesgo (auth, seguridad, datos de salud, auditoría, consentimiento): review obligatoria de integrante-1 (principal) o integrante-2 (suplente).
- Handoff al terminar en `knowledge-base/entrega/<id>.md`: qué se hizo, cómo se verificó, qué sigue, decisiones abiertas.
- No inventes nombres ni cuentas: lo que falte queda pendiente.
<!-- /active-stack:team-mode -->
