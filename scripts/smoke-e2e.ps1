# Version PowerShell de scripts/smoke-e2e.sh: mismos pasos contra el stack levantado.
# Uso (PowerShell, desde la raiz del repo):
#   powershell -ExecutionPolicy Bypass -File scripts\smoke-e2e.ps1
# Variables: API, FRONTEND_URL (default http://localhost:5173), ORIGIN (default http://localhost:5173),
# SMOKE_DB (1 = tambien prueba RECEPCION -> 403 cambiando el rol por docker compose exec).
# Sale con codigo 0 si todo pasa; si no, con la cantidad de fallas. ASCII puro a proposito (PS 5.1).
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\api.ps1')

$frontendUrl = if ($env:FRONTEND_URL) { $env:FRONTEND_URL } else { 'http://localhost:5173' }
$origin = if ($env:ORIGIN) { $env:ORIGIN } else { 'http://localhost:5173' }
$smokeDb = ($env:SMOKE_DB -eq '1')
$marca = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + (Get-Random -Maximum 99999)
$password = 'smoke-' + [guid]::NewGuid().ToString('N').Substring(0, 24)
$script:Fallas = 0
$script:Pasos = 0

function Write-Ok([string]$Msg) { $script:Pasos++; Write-Host "  [OK]    $Msg" }
function Write-Ko([string]$Msg) { $script:Pasos++; $script:Fallas++; Write-Host "  [FALLA] $Msg (HTTP $($script:Last.Status))" }
function Test-Status([int]$Esperado, [string]$Msg) {
    if ($script:Last.Status -eq $Esperado) { Write-Ok $Msg } else { Write-Ko "${Msg}: se esperaba $Esperado" }
}
function Test-True([bool]$Cond, [string]$Msg) { if ($Cond) { Write-Ok $Msg } else { Write-Ko $Msg } }
function Exit-Resumen {
    Write-Host ''
    Write-Host "Resultado: $($script:Pasos - $script:Fallas)/$($script:Pasos) pasos OK, $($script:Fallas) fallas."
    exit $script:Fallas
}
function Get-Header([string]$Name) { $v = $script:Last.Headers[$Name.ToLowerInvariant()]; if ($v) { return [string]$v } return '' }

Assert-Health
$manana = Get-FechaAr 1
Write-Host "Smoke E2E contra $($script:Api) (marca $marca, turnos del $manana)"

Write-Host '== Infraestructura'
$r = Invoke-Api GET /health
Test-Status 200 'GET /health'
Test-True ($r.Json.status -eq 'UP') 'health = UP'
Invoke-Api GET '' -Url "$frontendUrl/" | Out-Null
Test-Status 200 "frontend sirve index.html en $frontendUrl"
Test-True ((Get-Header 'x-content-type-options') -eq 'nosniff') 'frontend con X-Content-Type-Options: nosniff (imagen del frontend sin reconstruir?)'
Invoke-Api OPTIONS /auth/login -Headers @{ Origin = $origin; 'Access-Control-Request-Method' = 'POST'; 'Access-Control-Request-Headers' = 'authorization,content-type' } | Out-Null
Test-Status 200 "preflight CORS desde $origin"
Invoke-Api OPTIONS /health -Headers @{ Origin = 'http://evil.example'; 'Access-Control-Request-Method' = 'GET' } | Out-Null
Test-Status 403 'preflight CORS desde un origen no permitido'
Invoke-Api GET /health -Headers @{ Origin = $origin } | Out-Null
Test-True ((Get-Header 'access-control-expose-headers') -match '(?i)retry-after') 'CORS expone Retry-After (aviso del 429 en la SPA)'

Write-Host '== Flujo 1: registro e inicio de sesion'
$emailA = "smoke-a-$marca@smoke.local"
Register-Consultorio $emailA $password 'Smoke A' 'Ana' 'Smoke' | Out-Null
Test-Status 201 'registro del consultorio A'
Register-Consultorio $emailA $password 'Smoke A' 'Ana' 'Smoke' | Out-Null
Test-Status 409 'registro con email duplicado'
$script:Token = ''
Invoke-Api POST /auth/login ('{"email":' + (ConvertTo-JsonString $emailA) + ',"password":"incorrecta"}') | Out-Null
Test-Status 401 'login con contrasena incorrecta'
$okLogin = Connect-Api $emailA $password
Test-Status 200 'login del consultorio A'
if (-not $okLogin) { Write-Host '  Abortado: sin token no se puede seguir'; Exit-Resumen }
$r = Invoke-Api GET /auth/me
Test-Status 200 'GET /auth/me'
Test-True ($r.Json.usuario.rol -eq 'ADMIN') 'el registro crea un ADMIN'

Write-Host '== Configuracion'
$r = Invoke-Api GET /sillones
Test-Status 200 'listar sillones'
$sillon = @($r.Json)[0].id
if (-not $sillon) { Write-Host '  Abortado: el registro no creo el Sillon 1'; Exit-Resumen }
$r = Invoke-Api POST /prestaciones '{"nombre":"Consulta","duracionMinutos":30}'
Test-Status 201 'alta de prestacion de 30 min'
$prest = $r.Json.id
Invoke-Api POST /prestaciones '{"nombre":"Mal","duracionMinutos":20}' | Out-Null
Test-Status 400 'prestacion fuera de la grilla de 15 min'
foreach ($d in 1..7) { Invoke-Api POST /horarios-atencion ('{"diaSemana":' + $d + ',"horaDesde":"09:00","horaHasta":"18:00"}') | Out-Null }
Test-Status 201 'horarios de atencion 09:00-18:00'

Write-Host '== Paciente y ficha clinica (consentimiento)'
$r = Invoke-Api POST /pacientes '{"nombre":"Paciente","apellido":"Smoke","dni":"40123456","telefono":"+5491150009999","email":"paciente.smoke@example.com"}'
Test-Status 201 'alta de paciente'
$pac = $r.Json.id
if (-not $pac) { Write-Host '  Abortado: sin paciente no se puede seguir'; Exit-Resumen }
$r = Invoke-Api POST /pacientes '{"nombre":"Otro","apellido":"Smoke","dni":"40.123.456"}'
Test-Status 409 'DNI duplicado (en otro formato)'
Test-True ($r.Json.pacienteId -eq $pac) 'el 409 de DNI trae el pacienteId existente'
$r = Invoke-Api GET "/pacientes/$pac/ficha"
Test-Status 409 'ficha sin consentimiento'
Test-True ($r.Json.codigo -eq 'CONSENTIMIENTO_REQUERIDO') 'codigo CONSENTIMIENTO_REQUERIDO'
$r = Invoke-Api GET /consentimientos/texto-vigente
Test-Status 200 'texto de consentimiento vigente'
Invoke-Api POST "/pacientes/$pac/consentimientos" ('{"versionTexto":"' + $r.Json.version + '"}') | Out-Null
Test-Status 201 'registrar consentimiento'
Invoke-Api PUT "/pacientes/$pac/ficha" '{"alergias":"Ninguna conocida","version":null}' | Out-Null
Test-Status 200 'guardar anamnesis'
Invoke-Api POST "/pacientes/$pac/notas" '{"texto":"Nota de smoke."}' | Out-Null
Test-Status 201 'agregar nota clinica'

Write-Host '== Flujo 2: turnos sin solapamiento'
$r = Invoke-Api POST /turnos ('{"pacienteId":' + $pac + ',"prestacionId":' + $prest + ',"sillonId":' + $sillon + ',"inicio":"' + (Get-InstanteAr $manana '10:00') + '"}')
Test-Status 201 "crear turno $manana 10:00"
$turno = $r.Json.id
Test-True ($r.Json.estado -eq 'PROGRAMADO') 'el turno nace PROGRAMADO'
$r = Invoke-Api POST /turnos ('{"pacienteId":' + $pac + ',"prestacionId":' + $prest + ',"sillonId":' + $sillon + ',"inicio":"' + (Get-InstanteAr $manana '10:15') + '"}')
Test-Status 409 'turno superpuesto en el mismo sillon'
Test-True ($r.Json.conflicto.motivo -eq 'SILLON') 'el 409 identifica el conflicto de sillon'
Test-True ($r.Json.conflicto.turnoId -eq $turno) 'el 409 identifica el turno en conflicto'
Invoke-Api POST /turnos ('{"pacienteId":' + $pac + ',"prestacionId":' + $prest + ',"sillonId":' + $sillon + ',"inicio":"' + (Get-InstanteAr $manana '08:00') + '"}') | Out-Null
Test-Status 422 'turno fuera del horario de atencion'
Invoke-Api GET ("/turnos?desde=" + (Get-InstanteAr $manana '00:00') + "&hasta=" + (Get-InstanteAr (Get-FechaAr 2) '00:00')) | Out-Null
Test-Status 200 'agenda del dia'

Write-Host '== Flujo 3: recordatorio por WhatsApp (wa.me)'
$r = Invoke-Api GET "/turnos/pendientes-recordatorio?fecha=$manana"
Test-Status 200 'pendientes de recordatorio de manana'
Test-True (@($r.Json | Where-Object { $_.turnoId -eq $turno }).Count -eq 1) 'el turno aparece como pendiente'
$r = Invoke-Api GET "/turnos/$turno/recordatorio/whatsapp"
Test-Status 200 'generar enlace de WhatsApp'
Test-True (([string]$r.Json.enlace).StartsWith('https://wa.me/')) 'el enlace es https://wa.me/...'
$r = Invoke-Api GET "/turnos/pendientes-recordatorio?fecha=$manana"
Test-True (@($r.Json | Where-Object { $_.turnoId -eq $turno }).Count -eq 0) 'con un recordatorio GENERADO el turno deja de estar pendiente'
$r = Invoke-Api POST "/turnos/$turno/recordatorio/email"
switch ($r.Status) {
    201 { Write-Ok 'email de recordatorio enviado (SMTP configurado)' }
    503 { Write-Ok 'email sin SMTP configurado -> 503 (esperado si SMTP_HOST/SMTP_FROM estan vacios)' }
    502 { Write-Ok 'email con SMTP inalcanzable -> 502 (informativo: revisar SMTP_*)' }
    default { Write-Ko 'email de recordatorio: se esperaba 201, 502 o 503' }
}
Invoke-Api PATCH "/turnos/$turno/estado" '{"estado":"CONFIRMADO"}' | Out-Null
Test-Status 200 'confirmar el turno'

Write-Host '== Flujo 7: exportacion y auditoria'
Invoke-Api GET "/pacientes/$pac/export" | Out-Null
Test-Status 200 'exportar datos del paciente'
Test-True ((Get-Header 'content-disposition') -like "*paciente-$pac-export.json*") "descarga paciente-$pac-export.json"
Test-True ((Get-Header 'cache-control') -like '*no-store*') 'export con Cache-Control: no-store'
$r = Invoke-Api GET "/auditoria?entidad=Paciente&accion=EXPORT&entidadId=$pac"
Test-Status 200 'consultar auditoria'
Test-True ($r.Json.totalElementos -eq 1) 'una fila EXPORT del paciente en audit_log'
$r = Invoke-Api GET "/auditoria?entidad=FichaClinica&entidadId=$pac"
Test-True ($r.Json.totalElementos -ge 1) 'lecturas/escrituras de la ficha auditadas'

Write-Host '== Aislamiento entre consultorios y autenticacion'
$tokenA = $script:Token
$emailB = "smoke-b-$marca@smoke.local"
Register-Consultorio $emailB $password 'Smoke B' 'Beto' 'Smoke' | Out-Null
Test-Status 201 'registro del consultorio B'
[void](Connect-Api $emailB $password)
Test-Status 200 'login del consultorio B'
Invoke-Api GET "/pacientes/$pac" | Out-Null
Test-Status 404 'B no ve el paciente de A'
Invoke-Api GET "/pacientes/$pac/ficha" | Out-Null
Test-Status 404 'B no ve la ficha de A'
Invoke-Api GET "/pacientes/$pac/export" | Out-Null
Test-Status 404 'B no puede exportar el paciente de A'
Invoke-Api GET "/turnos/$turno" | Out-Null
Test-Status 404 'B no ve el turno de A'
$r = Invoke-Api GET "/auditoria?entidad=Paciente&accion=EXPORT&entidadId=$pac"
Test-True ($r.Json.totalElementos -eq 0) 'B no ve la auditoria de A'
$script:Token = ''
Invoke-Api GET /pacientes | Out-Null
Test-Status 401 'sin token -> 401'
$script:Token = $tokenA + 'x'
Invoke-Api GET /pacientes | Out-Null
Test-Status 401 'token adulterado -> 401'

if ($smokeDb) {
    Write-Host '== RBAC: RECEPCION'
    if (Set-Rol $emailB 'RECEPCION') {
        [void](Connect-Api $emailB $password)
        Test-Status 200 'login como RECEPCION (el rol viaja en el JWT)'
        Invoke-Api GET /pacientes | Out-Null
        Test-Status 200 'RECEPCION lista pacientes'
        $r = Invoke-Api POST /pacientes '{"nombre":"Rec","apellido":"Smoke","dni":"41234567"}'
        Test-Status 201 'RECEPCION da de alta un paciente'
        $pacB = $r.Json.id
        Invoke-Api GET "/pacientes/$pacB/ficha" | Out-Null
        Test-Status 403 'RECEPCION no accede a la ficha clinica'
        Invoke-Api GET "/pacientes/$pacB/export" | Out-Null
        Test-Status 403 'RECEPCION no exporta'
        Invoke-Api GET /auditoria | Out-Null
        Test-Status 403 'RECEPCION no ve la auditoria'
    } else {
        Write-Ko 'cambiar el rol por SQL (docker compose exec mysql)'
    }
} else {
    Write-Host '== RBAC: RECEPCION omitido ($env:SMOKE_DB = 1 para probarlo)'
}

Exit-Resumen
