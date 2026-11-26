# Helpers HTTP compartidos por demo-seed.ps1 y smoke-e2e.ps1 (C-16).
# Windows PowerShell 5.1 o PowerShell 7. Este archivo es ASCII puro a proposito: PS 5.1 lee
# los .ps1 sin BOM como ANSI. Los textos con acentos usan el marcador %uXXXX (ver Expand-Text).
# No imprime tokens, contrasenas ni datos de pacientes (regla 5): solo ids y codigos HTTP.

Add-Type -AssemblyName System.Net.Http

$script:Api = if ($env:API) { $env:API } else { 'http://localhost:8080/api' }
$script:Token = ''
$script:Http = New-Object System.Net.Http.HttpClient
$script:Http.Timeout = [TimeSpan]::FromSeconds(30)
$script:Last = $null

# 'Sill%u00f3n' -> 'Sillon' con la o acentuada (caracter real en memoria; viaja en UTF-8).
function Expand-Text([string]$Text) {
    return [regex]::Replace($Text, '%u([0-9a-fA-F]{4})', { param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value, 16) })
}

# Literal JSON entre comillas (para email y contrasena).
function ConvertTo-JsonString([string]$Text) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    foreach ($c in $Text.ToCharArray()) {
        $code = [int]$c
        if ($c -eq '"') { [void]$sb.Append('\"') }
        elseif ($c -eq '\') { [void]$sb.Append('\\') }
        elseif ($code -lt 32 -or $code -gt 126) { [void]$sb.Append(('\u{0:x4}' -f $code)) }
        else { [void]$sb.Append($c) }
    }
    [void]$sb.Append('"')
    return $sb.ToString()
}

# Invoke-Api METODO RUTA [CUERPO] [-Headers @{...}] [-Url urlCompleta]
# Devuelve y deja en $script:Last: Status (int, 0 = sin conexion), Body (texto), Json (objeto o $null), Headers (hashtable, claves en minusculas).
function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Body = '', [hashtable]$Headers = @{}, [string]$Url = '')
    $target = if ($Url) { $Url } else { $script:Api + $Path }
    $req = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::new($Method)), $target
    [void]$req.Headers.TryAddWithoutValidation('Accept', 'application/json')
    if ($script:Token -and -not $Url) { [void]$req.Headers.TryAddWithoutValidation('Authorization', "Bearer $($script:Token)") }
    foreach ($k in $Headers.Keys) { [void]$req.Headers.TryAddWithoutValidation($k, [string]$Headers[$k]) }
    if ($Body) {
        $req.Content = New-Object System.Net.Http.StringContent ((Expand-Text $Body), [System.Text.Encoding]::UTF8, 'application/json')
    }
    $result = [pscustomobject]@{ Status = 0; Body = ''; Json = $null; Headers = @{} }
    try {
        $resp = $script:Http.SendAsync($req).GetAwaiter().GetResult()
        $result.Status = [int]$resp.StatusCode
        $bytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        $result.Body = [System.Text.Encoding]::UTF8.GetString($bytes)
        foreach ($h in @($resp.Headers) + @($resp.Content.Headers)) {
            $result.Headers[$h.Key.ToLowerInvariant()] = ($h.Value -join ', ')
        }
        if ($result.Body) { try { $result.Json = $result.Body | ConvertFrom-Json } catch { $result.Json = $null } }
    } catch {
        $result.Status = 0
    }
    $script:Last = $result
    return $result
}

# Fechas en la zona del consultorio (America/Argentina/Buenos_Aires, UTC-3 fijo).
function Get-FechaAr([int]$Dias = 0) { return [DateTime]::UtcNow.AddHours(-3).AddDays($Dias).ToString('yyyy-MM-dd') }
function Get-InstanteAr([string]$Fecha, [string]$Hora) {
    $local = [DateTime]::ParseExact("$Fecha $Hora", 'yyyy-MM-dd HH:mm', [Globalization.CultureInfo]::InvariantCulture)
    return $local.AddHours(3).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
}

function Assert-Health {
    $r = Invoke-Api GET /health
    if ($r.Status -ne 200) {
        Write-Host "La API no responde en $($script:Api)/health (HTTP $($r.Status)). Esta levantado el stack? (ver README)"
        exit 4
    }
}

# Login -> fija $script:Token; devuelve $true/$false
function Connect-Api([string]$Email, [string]$Password) {
    $saved = $script:Token
    $script:Token = ''
    $r = Invoke-Api POST /auth/login ('{"email":' + (ConvertTo-JsonString $Email) + ',"password":' + (ConvertTo-JsonString $Password) + '}')
    if ($r.Status -ne 200) { $script:Token = $saved; return $false }
    $script:Token = $r.Json.accessToken
    return $true
}

# Registro: Consultorio, Nombre y Apellido van tal cual dentro del JSON (texto fijo, admite %uXXXX).
function Register-Consultorio([string]$Email, [string]$Password, [string]$Consultorio, [string]$Nombre, [string]$Apellido) {
    $saved = $script:Token
    $script:Token = ''
    $r = Invoke-Api POST /auth/register ('{"consultorioNombre":"' + $Consultorio + '","nombre":"' + $Nombre + '","apellido":"' + $Apellido +
        '","email":' + (ConvertTo-JsonString $Email) + ',"password":' + (ConvertTo-JsonString $Password) + '}')
    $script:Token = $saved
    return $r
}

# Cambia el rol por SQL dentro del contenedor mysql (no hay ABM de usuarios en el MVP).
# Correr desde la raiz del repo con el stack de docker compose levantado. El SQL va por stdin.
function Set-Rol([string]$Email, [string]$Rol) {
    if ($Email -notmatch '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$') { throw 'Email invalido para Set-Rol' }
    if (@('ADMIN', 'PROFESIONAL', 'RECEPCION') -notcontains $Rol) { throw 'Rol invalido' }
    $sql = "UPDATE usuario SET rol = '$Rol' WHERE email = '$Email';"
    $sql | docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_PASSWORD mysql -u$MYSQL_USER $MYSQL_DATABASE' | Out-Null
    return ($LASTEXITCODE -eq 0)
}
