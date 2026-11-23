# Tasks

> TDD estricto: cada tarea de comportamiento arranca con un test que falla (RED), luego el mínimo código (GREEN), un segundo caso (TRIANGULAR) y refactor con tests en verde. No correr `docker compose up` ni buildear imágenes (regla 9); no commitear sin autorización (regla 10).

## 1. Scaffolding del backend (sin comportamiento)

- [x] 1.1 Descargar el starter de Spring Initializr (Gradle-Groovy, Java 17, Boot 3.5.x, `ar.global`/`odonto`, paquete `ar.global.odonto`, deps `web,data-jpa,validation,security,flyway,mysql,h2`) a un directorio temporal vacío fuera del repo, inspeccionarlo y copiar a `backend/` solo `gradlew`, `gradlew.bat`, `gradle/wrapper/*` (Gradle 8.14.x con `distributionSha256Sum`), `settings.gradle` y `build.gradle`; verificar con `cd backend && ./gradlew --version` (muestra Gradle 8.14.x)
- [x] 1.2 Ajustar `backend/build.gradle` según design D2 (`options.release = 17`, `flyway-mysql`, `mysql-connector-j` runtime, `h2` testRuntime, `spring-security-test`, JaCoCo, `test { useJUnitPlatform(); systemProperty 'spring.profiles.active', 'test' }`); verificar con `./gradlew dependencies --configuration testRuntimeClasspath` (lista h2 y flyway-mysql)
- [x] 1.3 Crear `OdontoApplication` en `ar.global.odonto`, `package-info.java` en `config`, `security`, `common`, `consultorio`, `usuario`, `paciente`, `agenda`, `recordatorio`, `auditoria`, y `src/main/resources/db/migration/.gitkeep`; verificar con `./gradlew compileJava` en verde

## 2. Arranque con perfil test y configuración (spec runtime-configuration, service-health)

- [x] 2.1 RED: escribir `OdontoApplicationTests` (`@SpringBootTest`) que verifica que el contexto carga, que el perfil activo es `test` y que `Flyway` está presente y migró sobre H2; confirmar que falla con `./gradlew test --tests '*OdontoApplicationTests'` (sin `application-test.yml` no hay datasource)
- [x] 2.2 GREEN: crear `application.yml` (default `dev`, `ddl-auto: validate`, `open-in-view: false`, bloque `app.*` y `spring.mail.*` con placeholders `${VAR:default}` de D3, exclusión de `UserDetailsServiceAutoConfiguration`), `application-dev.yml` (MySQL desde `DB_URL/DB_USER/DB_PASSWORD`) y `application-test.yml` (H2 `MODE=MySQL`, Flyway); verificar `OdontoApplicationTests` en verde
- [x] 2.3 TRIANGULAR: agregar caso que asegura `spring.jpa.hibernate.ddl-auto == validate` en el entorno cargado; verificar en verde
- [x] 2.4 RED: escribir `AppPropertiesTest` con `ApplicationContextRunner` cubriendo (a) `CORS_ALLOWED_ORIGINS=http://a.test,http://b.test` produce exactamente 2 orígenes y (b) sin variables, `baseUrl` y orígenes valen `http://localhost:5173`; confirmar que falla (no existe `AppProperties`)
- [x] 2.5 GREEN + REFACTOR: crear record `config.AppProperties` (`baseUrl`, `cors.allowedOrigins`, `jwt.secret`, `jwt.expirationMin`) y `config.PropertiesConfig` con `@ConfigurationPropertiesScan`; verificar `./gradlew test` en verde

## 3. Endpoint de salud y línea base de seguridad (specs service-health, api-cors-policy)

- [x] 3.1 RED: escribir `HealthControllerIT` (`@SpringBootTest` + `@AutoConfigureMockMvc`) con: `GET /api/health` sin token → 200, `application/json`, cuerpo exacto `{"status":"UP"}` (sin otros campos); confirmar que falla (404/401)
- [x] 3.2 GREEN: crear `common.health.HealthResponse` (record) y `HealthController`, y `security.SecurityConfig` stateless según D5 (permitAll `GET /api/health` y `OPTIONS /**`, `anyRequest().authenticated()`, entry point 401, sin httpBasic/formLogin, CSRF deshabilitado con comentario de DD-04); verificar `HealthControllerIT` en verde
- [x] 3.3 TRIANGULAR: agregar en `HealthControllerIT` `POST /api/health` → 4xx y respuesta sin `Set-Cookie` `JSESSIONID`; verificar en verde
- [x] 3.4 Escribir `SecurityDefaultDenyIT` (guarda de regresión): `GET /api/cualquier-recurso` y `GET /api/pacientes` sin token → exactamente 401 (entry point de 3.2) sin cuerpo con datos; verificar en verde y comprobar que el test ejercita la regla agregando temporalmente `anyRequest().permitAll()` (debe fallar) y revirtiendo
- [x] 3.5 RED: escribir `CorsPolicyIT`: preflight `OPTIONS /api/health` con `Origin: http://localhost:5173` → 2xx con `Access-Control-Allow-Origin` igual al origen; con `Origin: http://evil.example` → 403 sin el header; confirmar que falla (sin `CorsConfigurationSource`)
- [x] 3.6 GREEN: crear `config.CorsConfig` (`CorsConfigurationSource` desde `AppProperties`, sin `*`, métodos y headers de D5, `/api/**`) y enganchar `cors(withDefaults())` en `SecurityConfig`; verificar `CorsPolicyIT` en verde
- [x] 3.7 TRIANGULAR: agregar casos en `CorsPolicyIT` con `@TestPropertySource(properties = "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173")` (segundo origen aceptado) y preflight con `Access-Control-Request-Headers: authorization,content-type` (ambos autorizados); verificar en verde
- [x] 3.8 REFACTOR: revisar nombres, constantes de rutas públicas y que ningún log imprima secretos; verificar `./gradlew test` completo en verde y anotar en el handoff que `security/` requiere review de integrante-1/2 (regla 12)

## 4. Scaffolding del frontend (sin comportamiento)

- [x] 4.1 Crear `frontend/package.json` (scripts `dev`, `build`, `typecheck`, `lint`, `test`, `test:watch`) e instalar devDependencies `typescript@5`, `vite`, `vitest`, `jsdom`, `eslint@9`, `typescript-eslint`, `@eslint/js` con `npm install -D`; verificar que se genera `package-lock.json` y `npx vitest --version` responde
- [x] 4.2 Crear `tsconfig.json` estricto (D6), `vite.config.ts` (puerto 5173 `strictPort`, `test.environment: 'jsdom'`), `eslint.config.js` con `@typescript-eslint/no-explicit-any: error`, `index.html` (`lang="es"`, `<div id="app">`, `src/main.ts`), carpetas `src/api pages components state utils` con `.gitkeep` y `frontend/.env.example` con `VITE_API_BASE_URL`; verificar con `npm run typecheck` (sin errores sobre un `src/main.ts` vacío)

## 5. Comportamiento del frontend (spec frontend-bootstrap)

- [x] 5.1 RED: escribir `src/api/config.test.ts` para `resolveApiBaseUrl`: `'https://api.ejemplo.test/api/'` → sin barra final; `undefined` → `http://localhost:8080/api`; confirmar que `npm test` falla (módulo inexistente)
- [x] 5.2 GREEN + TRIANGULAR: implementar `src/api/config.ts` (`resolveApiBaseUrl` pura + `API_BASE_URL` desde `import.meta.env.VITE_API_BASE_URL`); agregar caso de cadena vacía `''` → default y URL sin barra que queda igual; verificar `npm test` en verde
- [x] 5.3 RED: escribir `src/app.test.ts` (jsdom, consultas por rol): `mountApp(document)` con `#app` vacío monta un `heading` nivel 1 con el nombre del producto; confirmar que falla
- [x] 5.4 GREEN: implementar `src/app.ts` con `createElement` + `textContent` y `src/main.ts` que llama `mountApp(document)`; verificar en verde
- [x] 5.5 TRIANGULAR: agregar casos: título `<img src=x onerror=alert(1)>` se muestra literal y `document.querySelector('img')` es `null`; sin `#app` lanza `Error` con mensaje descriptivo; limpiar DOM en `afterEach`; verificar `npm test` en verde
- [x] 5.6 RED/GREEN: escribir `tests/tooling/no-explicit-any.test.ts` (`// @vitest-environment node`) que usa `new ESLint({ cwd })` + `lintText('const x: any = 1; export { x };', { filePath: 'src/x.ts' })` y espera un mensaje `@typescript-eslint/no-explicit-any` con severidad error, más un caso con `unknown` sin errores; verificar con `npm test`, `npm run lint` y `npm run typecheck` en verde

## 6. Entorno local, secretos y script de tests (spec runtime-configuration)

- [x] 6.1 RED: comprobar que `git check-ignore .env backend/build frontend/node_modules frontend/dist` no reporta todos; GREEN: agregar al `.gitignore` raíz (sin tocar los bloques existentes) `.env`, `!.env.example`, `backend/build/`, `backend/.gradle/`, `frontend/node_modules/`, `frontend/dist/`, `coverage/`, `.idea/`, `.vscode/`, `*.iml`; verificar que `git check-ignore` reporta las 4 rutas y no ignora `.env.example`
- [x] 6.2 Crear `.env.example` raíz con todas las variables del spec más `DB_NAME` y `DB_ROOT_PASSWORD`, sensibles vacías o `changeme`; verificar con `grep -c` que cada variable del spec aparece y que no hay valores reales
- [x] 6.3 RED: `docker compose config` falla (no existe el archivo); GREEN: crear `backend/Dockerfile` + `backend/.dockerignore`, `frontend/Dockerfile` (node:22-alpine → nginx:alpine, build-arg `VITE_API_BASE_URL`) + `frontend/.dockerignore` y `docker-compose.yml` según D7 (healthcheck MySQL, `depends_on: service_healthy`, `env_file: .env`, puertos 3306/8080/5173); verificar con `cp .env.example .env && docker compose config --services` → `mysql`, `backend`, `frontend` (sin `up` ni `build`; luego borrar el `.env` temporal si no existía)
- [x] 6.4 RED: `bash scripts/test.sh` falla (no existe); GREEN: crear `scripts/test.sh` (`set -euo pipefail`, backend y luego frontend); verificar que termina con código 0 con todo en verde y con código ≠ 0 al romper temporalmente un test (revertir después)

## 7. Documentación y verificación integral

- [x] 7.1 Registrar DD-10 en `knowledge-base/09_decisiones_y_supuestos.md` (paquete `ar.global.odonto`, Gradle Groovy 8.14 + Boot 3.5 + release 17, Vite/Vitest/ESLint, puertos 8080/5173/3306, salud propia en `/api/health`) y actualizar el comentario de `.github/CODEOWNERS` con el paquete base; verificar con `grep -n "DD-10" knowledge-base/09_decisiones_y_supuestos.md` y `grep -n "ar.global.odonto" .github/CODEOWNERS`
- [x] 7.2 Verificación integral desde estado limpio: `bash scripts/test.sh` en verde (backend + frontend), `npm run lint` y `npm run typecheck` en verde, `docker compose config` válido; confirmar que `git status` no lista `.env`, `build/` ni `node_modules/`
- [x] 7.3 Escribir el handoff `knowledge-base/entrega/C-01.md` (qué se hizo, cómo se verificó, pendiente: `docker compose up` manual por la persona, aviso a reviewers por `security/`) y marcar `[x]` C-01 en `CHANGES.md` con la evidencia de 7.2

## Workflow follow-up

- La persona verifica manualmente `docker compose up` (MySQL + backend + frontend) y `GET http://localhost:8080/api/health`.
- Commit/PR solo con autorización explícita (rama `C-01-project-setup`, plantilla de PR, aviso a integrante-1/2 por `security/`).
- Archivar el change con `/opsx:archive` tras la review.
