# Spec Delta

## Purpose

Que cualquier integrante pueda levantar, cargar y verificar la demo de la entrega desde una base vacía, en Windows con Git Bash o PowerShell, con datos ficticios, sin exponer secretos ni datos de pacientes y con los límites conocidos documentados.

## ADDED Requirements

### Requirement: Instrucciones de ejecución
El repositorio SHALL incluir un `README.md` en la raíz con los requisitos, la configuración de `.env` a partir de `.env.example` (sin valores reales), cómo levantar el stack con Docker Compose, cómo cargar los datos demo, cómo correr el smoke y los tests, y los problemas conocidos del entorno Windows.

#### Scenario: Base vacía a demo
- **GIVEN** una máquina con Docker Desktop y el repositorio clonado
- **WHEN** la persona sigue el README (copiar `.env`, `docker compose up --build`, script de datos demo)
- **THEN** puede iniciar sesión en `http://localhost:5173` con la cuenta demo y ver turnos de mañana en la agenda

### Requirement: Datos demo por la API
Los datos demo SHALL cargarse con scripts que usan la API real (`scripts/demo-seed.sh` y `scripts/demo-seed.ps1`), con datos ficticios, la contraseña tomada de `DEMO_PASSWORD` (nunca escrita en el repositorio ni impresa) y sin requerir WSL. Si el consultorio demo ya existe, el script MUST detenerse sin modificar datos.

#### Scenario: Carga completa
- **GIVEN** el stack levantado sobre una base vacía y `DEMO_PASSWORD` definida
- **WHEN** se ejecuta el script de datos demo
- **THEN** existen un consultorio con dos sillones, prestaciones, horarios, un bloqueo, pacientes (uno sin teléfono y uno con nombre XSS), una ficha con consentimiento y turnos para mañana

#### Scenario: Consultorio demo existente
- **GIVEN** la cuenta demo ya fue registrada
- **WHEN** se vuelve a ejecutar el script
- **THEN** termina con error indicando partir de una base limpia y no crea datos

#### Scenario: Sin contraseña
- **WHEN** se ejecuta el script sin `DEMO_PASSWORD` o con menos de 8 caracteres
- **THEN** termina con error antes de llamar a la API

### Requirement: Smoke E2E contra el stack real
El repositorio SHALL incluir un smoke (`scripts/smoke-e2e.sh` y `scripts/smoke-e2e.ps1`) que, contra el stack levantado, recorra registro y login, configuración, paciente con consentimiento, turno con conflicto `409`, enlace `wa.me`, export con su fila `EXPORT` en la auditoría, aislamiento entre consultorios y rechazo sin token. MUST terminar con código distinto de cero si algún paso falla.

#### Scenario: Todo en verde
- **GIVEN** el stack levantado
- **WHEN** se ejecuta el smoke
- **THEN** cada paso informa `[OK]` y el código de salida es `0`

#### Scenario: Aislamiento entre consultorios
- **GIVEN** un paciente, su ficha y un turno del consultorio A
- **WHEN** un usuario del consultorio B los pide por id, o pide su export
- **THEN** cada respuesta es `404` y la auditoría de B no muestra el export de A

#### Scenario: Repetible
- **WHEN** el smoke se ejecuta dos veces seguidas sobre la misma base
- **THEN** ambas corridas pasan, porque cada una registra consultorios con emails únicos

#### Scenario: RECEPCION opcional
- **GIVEN** `SMOKE_DB=1`
- **WHEN** el smoke cambia el rol de un usuario a `RECEPCION` y vuelve a iniciar sesión
- **THEN** la ficha clínica, el export y la auditoría responden `403`

### Requirement: Sin secretos ni PII en scripts y salidas
Los scripts de demo y smoke MUST NOT contener credenciales reales ni imprimir tokens, contraseñas o datos de pacientes; sus salidas SHALL limitarse a ids, códigos HTTP y textos fijos.

#### Scenario: Salida del smoke
- **WHEN** se ejecuta el smoke
- **THEN** la salida no contiene el token, la contraseña ni el nombre, DNI, teléfono o email de los pacientes de prueba

### Requirement: Documentación de seguridad y límites
El repositorio SHALL incluir un guion corto de demo, un checklist de seguridad con evidencia verificable por cada control (test, comando o paso del smoke), la lista de bugs conocidos y deuda con su impacto en la demo, y las verificaciones manuales pendientes de los changes anteriores.

#### Scenario: Control sin evidencia
- **WHEN** un control de seguridad no está cumplido
- **THEN** figura en el checklist como deuda y en la lista de bugs conocidos con un responsable propuesto
