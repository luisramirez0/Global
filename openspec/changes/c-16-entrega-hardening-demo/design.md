# Design

## Context

- Motivación y alcance: `proposal.md`. Requisitos: `specs/delivery-demo/spec.md` y los deltas de `api-cors-policy` y
  `runtime-configuration`.
- Estado de `main` (`e703329`): C-01..C-15 mergeados y archivados. Línea base: backend 955/955 (con `.env.example`
  presente; en un contenedor `gradle:8.14-jdk21`, porque la máquina solo tiene JDK 26), frontend 1987/1987 en 84 archivos,
  con lint y typecheck limpios.
- Contratos que usan los scripts (handoffs C-03..C-15): `POST /auth/register` crea consultorio, ADMIN, profesional y
  "Sillón 1"; `DevDataSeeder` **no** crea profesional (sin él, turnos y notas dan `422`); máximo 2 sillones activos;
  la grilla es de 15 minutos; los horarios usan hora local `HH:mm` e ISO `diaSemana` 1..7; los instantes son UTC;
  `America/Argentina/Buenos_Aires` es UTC-3 fijo; el otro consultorio da `404`; RECEPCION da `403` en ficha, export y
  auditoría; `GET .../recordatorio/whatsapp` no es idempotente (registra `GENERADO`).
- Entorno de la responsable: Windows con Docker Desktop; Git Bash y PowerShell 5.1; `node` disponible; sin `jq` ni
  Python real. Regla 9: el stack lo levanta la persona.

## Goals / Non-Goals

**Goals:** demo reproducible desde una base vacía con dos comandos; smoke que falle ruidosamente; scripts que corran
en Git Bash y PowerShell sin WSL; ningún secreto ni PII en scripts, salidas o logs; cambios de código mínimos y con test.

**Non-Goals:** features nuevas; ABM de usuarios; `GRANT` sobre `audit_log` (D-01); export en la ficha (B-01); CSP;
proxy y `forward-headers-strategy`; corregir el desfase de `horario_atencion` (B-02); E2E de navegador (Playwright).

## Decisions

### D1. Datos demo por la API real, no por un seeder Java
Se usa un script contra la API en lugar de ampliar `DevDataSeeder`. Ventajas: no toca el backend, deja auditoría real
(la demo de `#/auditoria` tiene filas), valida los contratos de verdad y sirve de base para el smoke. Costo: requiere
el stack levantado. El seed **se detiene** si el consultorio demo ya existe (`409`), en vez de "reparar" datos a medias.

### D2. Bash + PowerShell con un helper común cada uno
`scripts/lib/api.sh` usa `curl` y `node`, porque Git Bash no trae `jq` y el frontend ya exige Node. `scripts/lib/api.ps1`
usa `System.Net.Http.HttpClient`, que en PS 5.1 no lanza excepciones con 4xx y da acceso a los headers. Los cuerpos con
acentos viajan **desde un archivo** (bash) o como bytes UTF-8 (`StringContent`): los argumentos inline llegan mal
codificados en Windows (C-05). Los `.ps1` son ASCII puro (PS 5.1 lee como ANSI los archivos sin BOM); los acentos van
con el marcador `%uXXXX`, que se expande en memoria.

### D3. Rol RECEPCION por SQL, opcional
No hay ABM de usuarios y el registro crea un consultorio por cuenta. El cambio de rol es un `UPDATE usuario SET rol`
dentro del contenedor (`docker compose exec -T mysql`), con email y rol validados contra una lista y la contraseña por
`MYSQL_PWD` (no en la línea de comandos). Es solo para demo y smoke; se activa con `DEMO_RECEPCION=1` / `SMOKE_DB=1`.

### D4. Smoke idempotente y aislado
Cada corrida registra consultorios nuevos (`smoke-a|b-<marca>@smoke.local`) con una contraseña aleatoria que no se
imprime: no ensucia la demo y se puede repetir. El paso del email acepta `201`, `502` o `503` (SMTP opcional). El
código de salida es la cantidad de fallas.

### D5. `Retry-After` expuesto, y solo ese header
`Access-Control-Expose-Headers: Retry-After`. `Location` y `Content-Disposition` no hacen falta (la SPA usa el cuerpo
y arma el nombre del archivo). Exponer de más no es necesario.

### D6. Sin perfil por defecto
`docker-compose.yml` fija `SPRING_PROFILES_ACTIVE: dev` y `build.gradle` fija `test` para los tests (verificado antes
del cambio). Sin default, un arranque sin perfil falla por falta de datasource en vez de activar el seed de desarrollo.
`ProfileDefaultsTest` protege ambas mitades y falla con el `application.yml` anterior.

### D7. Hardening que no puede romper la demo
MySQL en `127.0.0.1` (los clientes del host siguen entrando por `localhost`). Headers en nginx a nivel `http`
(`conf.d`), heredados por el `default.conf` de la imagen, que no define `add_header`; validado con `nginx -t` y `curl`
en un contenedor temporal. Se descartó CSP (podría bloquear la API en otro origen sin una prueba en el navegador) y el
cambio del healthcheck de MySQL (riesgo de arranque). Ambos van a `docs/bugs-conocidos.md`.

## Risks / Trade-offs

- **Los scripts no se ejecutaron contra la API real** al escribirlos (regla 9): se validaron con `bash -n`, el parser
  de PowerShell y pruebas offline de los helpers. La primera corrida real es la de la responsable; si algo falla, se
  corrige antes de la demo.
- `bootRun` sin perfil deja de funcionar (mitigado con el README).
- El seed usa horario de atención todos los días (incluido el domingo) para que la demo funcione cualquier día; no
  representa un consultorio real.
- RECEPCION queda en otro consultorio (B-03): muestra el menú por rol y el `403`, no la operación sobre los mismos datos.
