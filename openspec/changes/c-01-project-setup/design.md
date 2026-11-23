# Design

## Context

Repositorio recién inicializado con git, sin commits y sin código: solo `knowledge-base/`, `CHANGES.md`, `openspec/`, `.github/` (CODEOWNERS comentado, plantilla de PR) y `.active-stack/`. Motivación y alcance en `proposal.md`; requisitos en `specs/`.

Restricciones que condicionan el diseño:
- Stack fijo (DD-03): TS vanilla / Spring Boot 3 + Gradle + JPA / MySQL 8 + Flyway (DD-05). Versiones = supuesto SU-04.
- Reglas duras de `CLAUDE.md`: 4 (TS `strict`, sin `any`), 5 (secretos por entorno), 6 (Flyway, `ddl-auto` `validate`/`none`), 8 (tests de integración contra H2 `MODE=MySQL`, perfil `test`, mismas migraciones), 9 (no levantar el stack ni `docker compose up` sin pedido), 11 (todo gratuito).
- Máquina local observada: JDK 24, Node 22.20 / npm 10.9, Docker 29.9; **Gradle no está instalado** (hay que obtener el wrapper).
- `.gitignore` existente tiene bloques gestionados (`active-stack:team-mode`, `.atl/`, backups): se agregan entradas sin tocarlos.

## Goals / Non-Goals

**Goals:**
- Esqueleto compilable y testeable en ambas capas, con `./gradlew test` y `npm test` en verde desde un clon limpio, sin MySQL ni `.env`.
- Fijar convenciones que el resto de las fichas hereda: paquete base, perfiles, nombres de propiedades, puertos, estructura de carpetas.
- Política de acceso segura por defecto (CORS restringido + deny-by-default) para que C-03 solo agregue autenticación.

**Non-Goals:**
- Entidades, migraciones `V*` y filtro de tenant (C-02). `db/migration/` queda vacío (con `.gitkeep`).
- JWT, login, `PasswordEncoder`, RBAC (C-03). No se valida `JWT_SECRET` todavía.
- `@RestControllerAdvice` / ProblemDetail de negocio, Spring Mail (C-09), UI real (C-10), CI, hosting (PA-09).

## Decisions

### D1 — Paquete base `ar.global.odonto`
`groupId = ar.global`, `artifactId = odonto`, clase principal `ar.global.odonto.OdontoApplication`. Subpaquetes: `config`, `security`, `common` (incluye `common.health`) y de dominio `consultorio`, `usuario`, `paciente`, `agenda`, `recordatorio`, `auditoria` (con `package-info.java` para que existan en git).
- Por qué: neutro, corto, refleja proyecto ("Global") y dominio; no implica poseer un dominio `.com`/`.edu`. Los globs de CODEOWNERS (`backend/src/main/java/**/security/`) no dependen del paquete, así que solo se actualiza el comentario.
- Alternativas: `ar.com.global.odonto` (sugiere dominio comercial inexistente), `com.global.turnos` (pierde el contexto AR/odonto).

### D2 — Gradle con DSL Groovy, wrapper 8.14.x, Spring Boot 3.5.x, release Java 17
- `backend/build.gradle` + `settings.gradle` (Groovy). Groovy por ser el default más documentado en tutoriales Spring y menor curva para un equipo de 5 estudiantes; Kotlin DSL aporta autocompletado pero no compensa en 2 días.
- Wrapper Gradle 8.14.x: soporta ejecutarse sobre el JDK 24 local y es compatible con Boot 3.5.
- `java { sourceCompatibility = 17 }` + `options.release = 17` **sin toolchain**: compila contra la API de Java 17 con cualquier JDK ≥17 instalado, sin exigir descargar un JDK 17 (toolchain con auto-provisioning requiere plugin foojay y red). Imágenes Docker usan Temurin 17.
- Spring Boot 3.5.x (última línea 3.x; Jackson 2, `spring-boot-starter-web`). Sin Boot 4: el KB fija 3.x.
- Obtención del wrapper: como Gradle no está instalado, se descarga un proyecto de Spring Initializr (`start.spring.io/starter.zip`, Gradle-Groovy, Java 17, Boot 3.5.x, `ar.global` / `odonto`, deps `web,data-jpa,validation,security,flyway,mysql,h2`) a un directorio temporal vacío fuera del repo, se inspecciona y se copian `gradlew`, `gradlew.bat`, `gradle/wrapper/*` y se adapta `build.gradle`. Alternativa: descargar la distribución Gradle y correr `gradle wrapper`.
- Dependencias: `starter-web`, `starter-data-jpa`, `starter-validation`, `starter-security`, `flyway-core`, `flyway-mysql`, `runtimeOnly mysql-connector-j`, `testRuntimeOnly h2`, `testImplementation starter-test`, `spring-security-test`. JaCoCo plugin incluido (gratuito, lo usa `springboot-tdd`).
- Tarea `test`: `useJUnitPlatform()` y `systemProperty 'spring.profiles.active', 'test'` para que toda la suite corra en perfil `test` sin variables de entorno.

### D3 — Perfiles y configuración
- `application.yml` (común): `spring.profiles.default: dev`; `spring.jpa.hibernate.ddl-auto: validate`; `spring.jpa.open-in-view: false`; `spring.flyway.locations: classpath:db/migration`; `server.port: 8080`; bloque `app.*`:
  - `app.base-url: ${APP_BASE_URL:http://localhost:5173}`
  - `app.cors.allowed-origins: ${CORS_ALLOWED_ORIGINS:http://localhost:5173}` (lista separada por comas)
  - `app.jwt.secret: ${JWT_SECRET:}` y `app.jwt.expiration-min: ${JWT_EXPIRATION_MIN:30}` (se bindean ya; C-03 agrega validación de no vacío/longitud)
  - `spring.mail.host/port/username/password: ${SMTP_*:}` (inertes hasta C-09, que agrega el starter).
- `application-dev.yml`: `spring.datasource.url/username/password: ${DB_URL} ${DB_USER} ${DB_PASSWORD}` (sin defaults sensibles).
- `application-test.yml`: `jdbc:h2:mem:global;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1`, Flyway habilitado sobre las mismas `db/migration`, `ddl-auto: validate`.
- Propiedades tipadas: `ar.global.odonto.config.AppProperties` (record `@ConfigurationProperties("app")` con `baseUrl`, `cors.allowedOrigins: List<String>`, `jwt`), habilitado por `@ConfigurationPropertiesScan` en una `@Configuration` dedicada (no en la clase principal).
- Se excluye `UserDetailsServiceAutoConfiguration` para que Boot no genere ni loguee una contraseña en memoria (regla 5).
- Variables extra solo para Compose: `DB_NAME` (default `global`) y `DB_ROOT_PASSWORD` (sensible, `changeme`).

### D4 — Salud: controlador propio `GET /api/health` en vez de Actuator
`common.health.HealthController` devuelve un record `HealthResponse(String status)` → `{"status":"UP"}`. Por qué: contrato mínimo y estable bajo `/api`, sin exponer detalles; Actuator agrega superficie (endpoints, info de build) que habría que endurecer. Alternativa: Actuator con solo `health` expuesto — válida a futuro (C-16) sin romper el contrato.

### D5 — Línea base de seguridad (zona de riesgo, regla 12)
`security.SecurityConfig` con un único `SecurityFilterChain`:
- `cors(withDefaults())` usando el `CorsConfigurationSource` de `config.CorsConfig`.
- `csrf.disable()` justificado porque la API es stateless sin cookies de sesión; si DD-04/PA-10 elige cookie HttpOnly, C-03 debe reactivar CSRF.
- `sessionCreationPolicy(STATELESS)`, `httpBasic`/`formLogin` deshabilitados, `exceptionHandling.authenticationEntryPoint(new HttpStatusEntryPoint(UNAUTHORIZED))` → 401 sin cuerpo HTML.
- `permitAll`: `GET /api/health` y `OPTIONS /**` (preflight); `anyRequest().authenticated()`.
- `CorsConfig`: `allowedOrigins` desde `AppProperties` (nunca `*`, `allowCredentials=false` hasta DD-04), métodos `GET,POST,PUT,PATCH,DELETE,OPTIONS`, headers `Authorization,Content-Type`, `maxAge 3600`, registrado para `/api/**`. Un origen no permitido recibe 403 del `CorsFilter` de Spring.
- C-03 reemplaza/extiende esta clase; el PR de C-01 lo avisa a integrante-1/2.

### D6 — Frontend: Vite + Vitest + ESLint, TypeScript estricto
- "Bundler liviano" = Vite (dev server 5173, `strictPort`), Vitest (misma config de Vite), entorno `jsdom` por defecto; ESLint 9 flat config + `typescript-eslint` con `@typescript-eslint/no-explicit-any: error`. Todo OSS y estándar; alternativas (esbuild a mano, Parcel) no traen runner integrado.
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `module/moduleResolution: ESNext/Bundler`, `types: ["vite/client"]`.
- Scripts npm: `dev`, `build` (`tsc --noEmit && vite build`), `typecheck`, `lint`, `test` (`vitest run`), `test:watch`.
- Estructura: `src/main.ts` (entry, llama `mountApp`), `src/app.ts` (`mountApp(doc, title?)` con `createElement` + `textContent`; error si falta `#app`), `src/api/config.ts` (`resolveApiBaseUrl(raw: string | undefined): string` puro + `API_BASE_URL` desde `import.meta.env.VITE_API_BASE_URL`), carpetas `pages/ components/ state/ utils/` con `.gitkeep`, `index.html` con `<div id="app">`, `lang="es"`. `.env.example` propio del frontend con `VITE_API_BASE_URL=http://localhost:8080/api`.
- Test de la regla "sin any": `tests/tooling/no-explicit-any.test.ts` (entorno `node`) usa la API `ESLint.lintText` con la config del proyecto sobre un snippet con `any` y espera un error de `no-explicit-any`; así la regla 4 queda protegida por un test y no solo por convención.

### D7 — Puertos y Docker Compose
| Servicio | Imagen | Puerto host |
|---|---|---|
| `mysql` | `mysql:8.4` (LTS), volumen `mysql-data`, healthcheck `mysqladmin ping` | 3306 |
| `backend` | Dockerfile multi-stage: `eclipse-temurin:17-jdk` → `./gradlew bootJar`; runtime `eclipse-temurin:17-jre`, usuario no root; `SPRING_PROFILES_ACTIVE=dev`, `DB_URL=jdbc:mysql://mysql:3306/${DB_NAME}`, resto de `env_file: .env`; `depends_on: mysql: condition: service_healthy` | 8080 |
| `frontend` | multi-stage `node:22-alpine` (`npm ci && npm run build`, build-arg `VITE_API_BASE_URL`) → `nginx:alpine` sirviendo `dist/` | 5173 → 80 |

El origen del frontend en Compose (`http://localhost:5173`) coincide con el de Vite dev, así `CORS_ALLOWED_ORIGINS` no cambia entre modos. `.dockerignore` en `backend/` y `frontend/`. Por la regla 9, la verificación automática es `docker compose config` (no construye ni levanta); `docker compose up` queda como verificación manual de la persona.

### D8 — Script de tests
`scripts/test.sh` (bash, `set -euo pipefail`): `(cd backend && ./gradlew test)` y luego `(cd frontend && npm test)`; código ≠ 0 si cualquiera falla. Corre en Git Bash en Windows. Se descarta un `package.json` raíz para no mezclar toolings.

### D9 — Estrategia TDD del setup
Cada comportamiento de los specs arranca con un test que falla: integración backend con `@SpringBootTest` + `@AutoConfigureMockMvc` en perfil `test` (H2), unitario de binding con `ApplicationContextRunner`, Vitest para `resolveApiBaseUrl`/`mountApp`/regla de lint. Para artefactos sin código (Compose, `.env.example`, `.gitignore`, script) el "RED" es un chequeo ejecutable que falla antes de crear el archivo (`docker compose config`, `git check-ignore`, `bash scripts/test.sh`). El primer RED de infraestructura es `./gradlew test` / `npm test` fallando por ausencia de test de humo.

## Risks / Trade-offs

- [H2 `MODE=MySQL` no es MySQL] → mismas migraciones Flyway en ambos; SQL estándar; consultas nativas MySQL se documentan y marcan (regla 8). Verificación manual con `docker compose up` antes de C-02 cerrado.
- [Spring Initializr/Maven Central requieren red; la descarga es contenido no confiable] → descargar a directorio temporal vacío fuera del repo, inspeccionar y copiar solo wrapper + build; checksum del wrapper (`distributionSha256Sum`) en `gradle-wrapper.properties`.
- [JDK local 24 vs objetivo 17] → `options.release = 17` impide usar APIs posteriores; imágenes Docker en 17. Si un integrante tiene JDK 17, funciona igual.
- [CSRF deshabilitado] → correcto solo con API stateless sin cookies; queda anotado para C-03/DD-04.
- [Deny-by-default rompe pruebas manuales de C-02 sin auth] → C-02 testea repositorios con `@DataJpaTest`, no endpoints; C-03 abre las rutas públicas de auth.
- [Versiones de npm "latest" pueden cambiar] → `package-lock.json` versionado; `npm ci` en Docker.
- [`exactOptionalPropertyTypes` puede incomodar] → aceptado por la regla 4; si bloquea, se discute en PR (no se relaja `strict`).

## Migration Plan

Greenfield: no hay datos ni despliegue previo. Rollback = revertir el PR de C-01. Tras el merge, cada integrante: `cp .env.example .env`, completar valores locales, `bash scripts/test.sh`.

## Open Questions

- Versión exacta de Spring Boot 3.5.x / Gradle 8.14.x: se toma la última patch disponible al aplicar (no cambia specs ni tareas).
- Hosting de la demo (PA-09): fuera de C-01; Compose cubre la ejecución local.
