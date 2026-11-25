# Global: turnos odontológicos (MVP)

SaaS multi-tenant de gestión de turnos para un odontólogo independiente (Argentina), con presupuesto cero:
recordatorios por enlace `wa.me` y email por SMTP gratuito. Maneja datos de salud (Ley 25.326 / 26.529).

- **Backend**: Spring Boot 3.5 / Java 17, MySQL 8.4, Flyway (`backend/`).
- **Frontend**: TypeScript sin framework con Vite, servido por nginx en Docker (`frontend/`).
- Documentación: [knowledge-base/](knowledge-base/README.md), roadmap en [CHANGES.md](CHANGES.md),
  guion de la demo en [docs/demo.md](docs/demo.md), [checklist de seguridad](docs/checklist-seguridad.md)
  y [bugs conocidos](docs/bugs-conocidos.md).

## Requisitos

| Para | Necesitás |
|---|---|
| Levantar la demo | Docker Desktop (Compose v2). En Windows, con el motor de WSL2 que usa Docker Desktop. |
| Scripts de demo y smoke | Git Bash con `curl` y `node` (Node 22+), **o** Windows PowerShell 5.1 / PowerShell 7. Los scripts no dependen de WSL. |
| Tests del backend | JDK 17 a 24. Gradle 8.14 **no** corre con JDK 25/26 (ver "Problemas conocidos del entorno"). |
| Tests del frontend | Node 22+ y `npm ci` en `frontend/`. |

## 1. Configurar el entorno

```bash
cp .env.example .env
```

Completá en `.env` (es local y está en `.gitignore`: **nunca** lo subas):

| Variable | Qué poner |
|---|---|
| `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD` | Credenciales locales de MySQL (cualquier valor, solo para tu máquina). |
| `JWT_SECRET` | Al menos 32 bytes aleatorios. Si falta o es corto, el backend no arranca. Por ejemplo, `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`. |
| `JWT_EXPIRATION_MIN` | `30`. |
| `CORS_ALLOWED_ORIGINS`, `APP_BASE_URL` | `http://localhost:5173`. |
| `VITE_API_BASE_URL` | `http://localhost:8080/api` (se fija al construir la imagen del frontend). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Opcional. Vacíos: la app arranca igual y el email de recordatorio responde `503` ("no disponible"). WhatsApp (`wa.me`) no necesita nada. |
| `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD` | Opcional: admin del seed de desarrollo. **La demo no lo usa** (ver la sección 3). |

## 2. Levantar el stack

```bash
docker compose down -v        # solo si querés partir de una base vacía (borra TODOS los datos locales)
docker compose up --build -d  # MySQL + backend (perfil dev) + frontend
docker compose ps             # los tres en "running"; mysql en "healthy"
```

- Frontend: <http://localhost:5173>
- API: <http://localhost:8080/api/health>, que debe responder `{"status":"UP"}`. El backend tarda unos segundos
  después de que MySQL queda sano, porque Flyway aplica las migraciones al arrancar.
- Logs: `docker compose logs -f backend`.
- MySQL queda publicado solo en `127.0.0.1:3306`, para verificaciones por SQL desde tu máquina.

> Si ya tenías contenedores de este stack de antes (`global-backend`, `global-mysql`, `global-frontend`), `--build`
> reconstruye las imágenes con el código actual y `down -v` borra la base vieja con sus datos de prueba.

## 3. Cargar los datos de la demo

Desde la raíz del repo, con el stack levantado. La contraseña la elegís vos: no se guarda ni se imprime.

```bash
# Git Bash
DEMO_PASSWORD='elegí-una-clave' DEMO_RECEPCION=1 bash scripts/demo-seed.sh
```

```powershell
# PowerShell
$env:DEMO_PASSWORD = 'elegi-una-clave'; $env:DEMO_RECEPCION = '1'
powershell -ExecutionPolicy Bypass -File scripts\demo-seed.ps1
```

El script crea, por la API real y con datos ficticios:
- el consultorio "Consultorio Demo Sonrisas" con el ADMIN `demo@consultorio.local`, su profesional y dos sillones;
- cuatro prestaciones de 15, 30, 45 y 60 minutos, horario de 09:00 a 18:00 todos los días y un bloqueo mañana de 13 a 14 h;
- cinco pacientes. María tiene consentimiento, anamnesis y una nota; Ana no tiene teléfono; Juan no tiene email; y hay uno con nombre XSS;
- cinco turnos para mañana (alimentan `#/recordatorios`) y uno hoy a las 09:00, para marcar "Asistió".

Con `DEMO_RECEPCION=1` también crea `recepcion@consultorio.local` con rol `RECEPCION`, con la misma contraseña. Para eso
cambia el rol por SQL con `docker compose exec`, porque el MVP no tiene ABM de usuarios. Ese usuario queda en **su
propio** consultorio, porque cada registro crea uno nuevo (ver [bugs conocidos](docs/bugs-conocidos.md)).

Si el consultorio demo ya existe, el script se detiene sin tocar nada. Para repetirlo, hacé `docker compose down -v` o usá
otro `DEMO_EMAIL`.

## 4. Smoke E2E

Recorre registro, configuración, paciente con consentimiento, turno con conflicto `409`, enlace `wa.me`, export
y auditoría, aislamiento entre consultorios y `401`. Crea sus propios consultorios (`smoke-*@smoke.local`), así que no
ensucia la demo y se puede repetir.

```bash
bash scripts/smoke-e2e.sh              # Git Bash
SMOKE_DB=1 bash scripts/smoke-e2e.sh   # además prueba RECEPCION -> 403 (cambia un rol por docker compose exec)
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke-e2e.ps1
```

Sale con código `0` si todo pasa; si no, con la cantidad de fallas, y cada paso imprime `[OK]` o `[FALLA]`. El paso del
email acepta `201`, `502` o `503` según tengas o no SMTP configurado.

## 5. Tests

```bash
bash scripts/test.sh                       # backend (Gradle + H2 en modo MySQL) y frontend (Vitest)
cd backend && ./gradlew test               # solo backend
cd frontend && npm ci && npm test          # solo frontend (también: npm run lint, npm run typecheck)
```

Los tests del backend corren contra H2 (`MODE=MySQL`) con las mismas migraciones Flyway que producción. No necesitan
Docker ni variables de entorno.

## Ejecutar el backend sin Docker (opcional)

El backend **no tiene perfil por defecto**: en Docker lo fija `docker-compose.yml` (`SPRING_PROFILES_ACTIVE: dev`).
Fuera de Docker hay que indicarlo; si no, el arranque falla porque no hay base configurada.

```bash
# Git Bash, con MySQL del compose levantado (docker compose up -d mysql) y las variables de .env exportadas
set -a; . ./.env; set +a
export SPRING_PROFILES_ACTIVE=dev DB_URL=jdbc:mysql://localhost:3306/${DB_NAME:-global}
cd backend && ./gradlew bootRun
```

Frontend en modo desarrollo: `cd frontend && npm run dev`, que usa `VITE_API_BASE_URL` o, por defecto, `http://localhost:8080/api`.

## Problemas conocidos del entorno (Windows)

- **JDK**: Gradle 8.14 necesita un JDK 17 a 24. Con JDK 25/26 la build falla. Opciones: instalar un JDK 21 y usar
  `export JAVA_HOME="/c/Program Files/Java/jdk-21"`, o correr los tests en un contenedor:
  `docker run --rm -v "$(pwd -W)/backend:/src:ro" gradle:8.14-jdk21 bash -c "cp -r /src /w && cd /w && gradle test"`.
- **Antivirus que intercepta HTTPS** (PKIX al bajar dependencias): `export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStoreType=Windows-ROOT"`.
- **Rutas con `Ñ` o acentos**: el worker de tests de Gradle falla con `ClassNotFoundException`. Usá una copia del repo en una ruta ASCII.
- **Acentos desde la consola**: `curl` desde Git Bash con el cuerpo inline, o `Invoke-RestMethod` en PS 5.1, mandan mal los
  acentos y la API responde `400`. Mandá el cuerpo desde un archivo UTF-8 (`--data-binary @archivo.json`), como hacen los scripts.
- **Docker Desktop / WSL2** con `input/output error` o `read-only file system`: reiniciá Docker Desktop (o `wsl --shutdown`)
  antes de la demo. No es un error del código.

## Reglas del proyecto

Ver [CLAUDE.md](CLAUDE.md). Lo esencial: sin secretos en el repo, sin datos de pacientes en los logs, cambios de esquema
solo con migraciones Flyway nuevas y cero servicios pagos.
