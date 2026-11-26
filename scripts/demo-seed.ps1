# Version PowerShell de scripts/demo-seed.sh (mismos datos ficticios, por la API real).
# Uso (PowerShell, desde la raiz del repo, con el stack levantado):
#   $env:DEMO_PASSWORD = 'una-clave-de-8+'; powershell -ExecutionPolicy Bypass -File scripts\demo-seed.ps1
# Variables: API, DEMO_EMAIL (default demo@consultorio.local), DEMO_PASSWORD (obligatoria),
# DEMO_RECEPCION (1 = crea recepcion@consultorio.local con rol RECEPCION en su propio consultorio).
# ASCII puro a proposito (PS 5.1): los acentos van como %uXXXX.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\api.ps1')

$demoEmail = if ($env:DEMO_EMAIL) { $env:DEMO_EMAIL } else { 'demo@consultorio.local' }
$demoPassword = [string]$env:DEMO_PASSWORD
$demoRecepcion = ($env:DEMO_RECEPCION -eq '1')

function Stop-Seed([string]$Msg) { Write-Host "ERROR: $Msg"; exit 1 }
function Assert-Status([int]$Esperado, [string]$Que) {
    if ($script:Last.Status -ne $Esperado) { Stop-Seed "${Que}: se esperaba HTTP $Esperado y llego $($script:Last.Status)" }
}

if ($demoPassword.Length -lt 8) { Stop-Seed 'defini DEMO_PASSWORD (minimo 8 caracteres)' }
Assert-Health

Write-Host '== 1. Consultorio demo'
$r = Register-Consultorio $demoEmail $demoPassword 'Consultorio Demo Sonrisas' 'Laura' 'G%u00f3mez'
if ($r.Status -eq 409) { Stop-Seed "ya existe una cuenta $demoEmail. Parti de una base limpia (docker compose down -v) o usa otro DEMO_EMAIL." }
Assert-Status 201 'registro'
if (-not (Connect-Api $demoEmail $demoPassword)) { Stop-Seed "login del consultorio demo (HTTP $($script:Last.Status))" }
Write-Host '   consultorio y ADMIN creados (el registro tambien crea el profesional y el Sillon 1)'

Write-Host '== 2. Configuracion: sillones, prestaciones, horarios, bloqueo'
$r = Invoke-Api POST /sillones '{"nombre":"Sill%u00f3n 2"}'
Assert-Status 201 'alta de Sillon 2'
$sillon2 = $r.Json.id
$r = Invoke-Api GET /sillones
Assert-Status 200 'listado de sillones'
$sillon1 = @($r.Json | Where-Object { $_.id -ne $sillon2 })[0].id
if (-not $sillon1) { Stop-Seed 'no se encontro el Sillon 1' }

$prest = @{}
foreach ($p in @(@('Consulta', 30), @('Control', 15), @('Limpieza', 45), @('Extracci%u00f3n simple', 60))) {
    $r = Invoke-Api POST /prestaciones ('{"nombre":"' + $p[0] + '","duracionMinutos":' + $p[1] + '}')
    Assert-Status 201 'alta de prestacion'
    $prest[$p[1]] = $r.Json.id
}

foreach ($d in 1..7) {
    Invoke-Api POST /horarios-atencion ('{"diaSemana":' + $d + ',"horaDesde":"09:00","horaHasta":"18:00"}') | Out-Null
    Assert-Status 201 "horario dia $d"
}

$manana = Get-FechaAr 1
$hoy = Get-FechaAr 0
Invoke-Api POST /bloqueos ('{"inicio":"' + (Get-InstanteAr $manana '13:00') + '","fin":"' + (Get-InstanteAr $manana '14:00') + '","motivo":"Almuerzo"}') | Out-Null
Assert-Status 201 'bloqueo de manana 13:00-14:00'
Write-Host '   2 sillones, 4 prestaciones, horario 09:00-18:00 todos los dias, bloqueo manana 13-14 h'

Write-Host '== 3. Pacientes (ficticios)'
$pacientes = @(
    @('Mar%u00eda', 'P%u00e9rez', '30111222', '+5491150000001', 'maria.perez@example.com'),
    @('Juan', 'Rodr%u00edguez', '31222333', '+5491150000002', ''),
    @('Ana', 'L%u00f3pez', '32333444', '', 'ana.lopez@example.com'),
    @('Carlos', 'Fern%u00e1ndez', '33444555', '+5491150000004', 'carlos.fernandez@example.com'),
    @('<img src=x onerror=alert(1)>', 'Prueba XSS', '34555666', '+5491150000005', '')
)
$pac = @()
foreach ($p in $pacientes) {
    $cuerpo = '{"nombre":"' + $p[0] + '","apellido":"' + $p[1] + '","dni":"' + $p[2] + '"'
    if ($p[3]) { $cuerpo += ',"telefono":"' + $p[3] + '"' }
    if ($p[4]) { $cuerpo += ',"email":"' + $p[4] + '"' }
    $cuerpo += '}'
    $r = Invoke-Api POST /pacientes $cuerpo
    Assert-Status 201 'alta de paciente'
    $pac += $r.Json.id
}
Write-Host "   $($pac.Count) pacientes: ids $($pac -join ' ') (Ana sin telefono, Juan sin email, el ultimo con nombre XSS)"

Write-Host '== 4. Ficha clinica de Maria (consentimiento, anamnesis, nota)'
$r = Invoke-Api GET /consentimientos/texto-vigente
Assert-Status 200 'texto de consentimiento vigente'
Invoke-Api POST "/pacientes/$($pac[0])/consentimientos" ('{"versionTexto":"' + $r.Json.version + '"}') | Out-Null
Assert-Status 201 'consentimiento'
Invoke-Api PUT "/pacientes/$($pac[0])/ficha" '{"alergias":"Penicilina","medicacionActual":"Ninguna","motivoConsulta":"Control anual","embarazo":false,"version":null}' | Out-Null
Assert-Status 200 'anamnesis'
Invoke-Api POST "/pacientes/$($pac[0])/notas" '{"texto":"Primera consulta. Sin hallazgos relevantes."}' | Out-Null
Assert-Status 201 'nota clinica'
Write-Host '   Juan y Ana quedan SIN consentimiento (para mostrar el bloqueo de la ficha)'

Write-Host '== 5. Turnos'
function New-Turno($Paciente, $Duracion, $Sillon, $Fecha, $Hora) {
    Invoke-Api POST /turnos ('{"pacienteId":' + $Paciente + ',"prestacionId":' + $prest[$Duracion] + ',"sillonId":' + $Sillon +
        ',"inicio":"' + (Get-InstanteAr $Fecha $Hora) + '"}') | Out-Null
    Assert-Status 201 "turno $Fecha $Hora"
}
New-Turno $pac[0] 30 $sillon1 $manana '09:00'
New-Turno $pac[1] 15 $sillon1 $manana '09:30'
New-Turno $pac[2] 45 $sillon2 $manana '10:00'
New-Turno $pac[3] 30 $sillon1 $manana '11:00'
New-Turno $pac[4] 15 $sillon2 $manana '12:00'
New-Turno $pac[3] 15 $sillon1 $hoy '09:00'
Write-Host "   5 turnos manana ($manana) y 1 hoy ($hoy 09:00, para marcar Asistio)"

if ($demoRecepcion) {
    Write-Host '== 6. Usuario RECEPCION (consultorio propio; no hay ABM de usuarios en el MVP)'
    $r = Register-Consultorio 'recepcion@consultorio.local' $demoPassword 'Consultorio Recepcion Demo' 'Rita' 'Recepcion'
    if ($r.Status -ne 201 -and $r.Status -ne 409) { Stop-Seed "registro de recepcion (HTTP $($r.Status))" }
    if (-not (Set-Rol 'recepcion@consultorio.local' 'RECEPCION')) { Stop-Seed 'no se pudo cambiar el rol (docker compose levantado y corriendo desde la raiz?)' }
    Write-Host '   recepcion@consultorio.local con rol RECEPCION (misma contrasena que la demo)'
}

Write-Host ''
Write-Host "Listo. Entra a http://localhost:5173 con $demoEmail y la contrasena de DEMO_PASSWORD."
