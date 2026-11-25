#!/usr/bin/env bash
# Smoke E2E de C-16 contra el stack levantado (API real + MySQL). Crea sus propios
# consultorios con emails únicos (smoke-a-<marca>@smoke.local), así que no ensucia la demo
# y se puede repetir. Todos los datos son ficticios.
#
# Uso (Git Bash, desde la raíz del repo):
#   bash scripts/smoke-e2e.sh
# Variables:
#   API           (default http://localhost:8080/api)
#   FRONTEND_URL  (default http://localhost:5173)
#   ORIGIN        (default http://localhost:5173; origen permitido por CORS)
#   SMOKE_DB      (1 = también prueba RECEPCION -> 403 cambiando el rol por `docker compose exec`. Default 0)
#
# Sale con código 0 si todos los pasos pasan; si no, con la cantidad de fallas.
# No imprime tokens, contraseñas ni datos de pacientes (solo ids y códigos HTTP).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/api.sh
. "$ROOT/scripts/lib/api.sh"

FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
ORIGIN="${ORIGIN:-http://localhost:5173}"
SMOKE_DB="${SMOKE_DB:-0}"
MARCA="$(date -u +%Y%m%d%H%M%S)$RANDOM"
PASSWORD="smoke-$(node -e 'process.stdout.write(require("crypto").randomBytes(12).toString("hex"))')"
FALLAS=0
PASOS=0

ok() { PASOS=$((PASOS + 1)); printf '  [OK]    %s\n' "$1"; }
ko() { PASOS=$((PASOS + 1)); FALLAS=$((FALLAS + 1)); printf '  [FALLA] %s (HTTP %s)\n' "$1" "$HTTP_STATUS"; }
check() { # check CODIGO DESCRIPCION
	if [ "$HTTP_STATUS" = "$1" ]; then ok "$2"; else ko "$2: se esperaba $1"; fi
}
check_eq() { # check_eq OBTENIDO ESPERADO DESCRIPCION
	if [ "$1" = "$2" ]; then ok "$3"; else ko "$3: se esperaba '$2' y llegó '$1'"; fi
}
abortar_si() { # abortar_si CONDICION_FALLIDA MENSAJE -> sin este dato no tiene sentido seguir
	if [ -z "$1" ]; then echo "  Abortado: $2" >&2; resumen; fi
}
resumen() {
	echo
	echo "Resultado: $((PASOS - FALLAS))/$PASOS pasos OK, $FALLAS fallas."
	exit "$FALLAS"
}

require_tools
check_health
MANANA="$(fecha_ar '+1 day')"
echo "Smoke E2E contra $API (marca $MARCA, turnos del $MANANA)"

echo "== Infraestructura"
api GET /health ""
check 200 "GET /health"
check_eq "$(json status)" "UP" "health = UP"
HTTP_STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$FRONTEND_URL/" 2>/dev/null || echo 000)"
check 200 "frontend sirve index.html en $FRONTEND_URL"
case "$(curl -s -D - -o /dev/null --max-time 10 "$FRONTEND_URL/" 2>/dev/null | tr -d '\r' | tr '[:upper:]' '[:lower:]')" in
	*"x-content-type-options: nosniff"*) ok "frontend con X-Content-Type-Options: nosniff" ;;
	*) ko "frontend con X-Content-Type-Options: nosniff (¿imagen del frontend sin reconstruir?)" ;;
esac
HTTP_STATUS="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS -H "Origin: $ORIGIN" \
	-H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: authorization,content-type' \
	--max-time 10 "$API/auth/login" 2>/dev/null || echo 000)"
check 200 "preflight CORS desde $ORIGIN"
HTTP_STATUS="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS -H 'Origin: http://evil.example' \
	-H 'Access-Control-Request-Method: GET' --max-time 10 "$API/health" 2>/dev/null || echo 000)"
check 403 "preflight CORS desde un origen no permitido"
api GET /health "" -H "Origin: $ORIGIN"
case "$(header access-control-expose-headers)" in
	*[Rr]etry-[Aa]fter*) ok "CORS expone Retry-After (aviso del 429 en la SPA)" ;;
	*) ko "CORS expone Retry-After" ;;
esac

echo "== Flujo 1: registro e inicio de sesión"
EMAIL_A="smoke-a-$MARCA@smoke.local"
registrar "$EMAIL_A" "$PASSWORD" 'Smoke A' 'Ana' 'Smoke'
check 201 "registro del consultorio A"
registrar "$EMAIL_A" "$PASSWORD" 'Smoke A' 'Ana' 'Smoke'
check 409 "registro con email duplicado"
TOKEN=""
api POST /auth/login "{\"email\":$(json_str "$EMAIL_A"),\"password\":\"incorrecta\"}"
check 401 "login con contraseña incorrecta"
login "$EMAIL_A" "$PASSWORD"
check 200 "login del consultorio A"
abortar_si "$TOKEN" "sin token no se puede seguir"
api GET /auth/me ""
check 200 "GET /auth/me"
check_eq "$(json usuario.rol)" "ADMIN" "el registro crea un ADMIN"

echo "== Configuración"
api GET /sillones ""
check 200 "listar sillones"
SILLON="$(json 0.id)"
abortar_si "$SILLON" "el registro no creó el Sillón 1"
api POST /prestaciones '{"nombre":"Consulta","duracionMinutos":30}'
check 201 "alta de prestación de 30 min"
PREST="$(json id)"
api POST /prestaciones '{"nombre":"Mal","duracionMinutos":20}'
check 400 "prestación fuera de la grilla de 15 min"
for d in 1 2 3 4 5 6 7; do api POST /horarios-atencion "{\"diaSemana\":$d,\"horaDesde\":\"09:00\",\"horaHasta\":\"18:00\"}"; done
check 201 "horarios de atención 09:00-18:00"

echo "== Paciente y ficha clínica (consentimiento)"
api POST /pacientes '{"nombre":"Paciente","apellido":"Smoke","dni":"40123456","telefono":"+5491150009999","email":"paciente.smoke@example.com"}'
check 201 "alta de paciente"
PAC="$(json id)"
abortar_si "$PAC" "sin paciente no se puede seguir"
api POST /pacientes '{"nombre":"Otro","apellido":"Smoke","dni":"40.123.456"}'
check 409 "DNI duplicado (en otro formato)"
check_eq "$(json pacienteId)" "$PAC" "el 409 de DNI trae el pacienteId existente"
api GET "/pacientes/$PAC/ficha" ""
check 409 "ficha sin consentimiento"
check_eq "$(json codigo)" "CONSENTIMIENTO_REQUERIDO" "código CONSENTIMIENTO_REQUERIDO"
api GET /consentimientos/texto-vigente ""
check 200 "texto de consentimiento vigente"
api POST "/pacientes/$PAC/consentimientos" "{\"versionTexto\":\"$(json version)\"}"
check 201 "registrar consentimiento"
api PUT "/pacientes/$PAC/ficha" '{"alergias":"Ninguna conocida","version":null}'
check 200 "guardar anamnesis"
api POST "/pacientes/$PAC/notas" '{"texto":"Nota de smoke."}'
check 201 "agregar nota clínica"

echo "== Flujo 2: turnos sin solapamiento"
INICIO="$(instante_ar "$MANANA" 10:00)"
api POST /turnos "{\"pacienteId\":$PAC,\"prestacionId\":$PREST,\"sillonId\":$SILLON,\"inicio\":\"$INICIO\"}"
check 201 "crear turno $MANANA 10:00"
TURNO="$(json id)"
check_eq "$(json estado)" "PROGRAMADO" "el turno nace PROGRAMADO"
api POST /turnos "{\"pacienteId\":$PAC,\"prestacionId\":$PREST,\"sillonId\":$SILLON,\"inicio\":\"$(instante_ar "$MANANA" 10:15)\"}"
check 409 "turno superpuesto en el mismo sillón"
check_eq "$(json conflicto.motivo)" "SILLON" "el 409 identifica el conflicto de sillón"
check_eq "$(json conflicto.turnoId)" "$TURNO" "el 409 identifica el turno en conflicto"
api POST /turnos "{\"pacienteId\":$PAC,\"prestacionId\":$PREST,\"sillonId\":$SILLON,\"inicio\":\"$(instante_ar "$MANANA" 08:00)\"}"
check 422 "turno fuera del horario de atención"
api GET "/turnos?desde=$(instante_ar "$MANANA" 00:00)&hasta=$(instante_ar "$(fecha_ar '+2 days')" 00:00)" ""
check 200 "agenda del día"

echo "== Flujo 3: recordatorio por WhatsApp (wa.me)"
api GET "/turnos/pendientes-recordatorio?fecha=$MANANA" ""
check 200 "pendientes de recordatorio de mañana"
case "$HTTP_BODY" in *"\"turnoId\":$TURNO"*) ok "el turno aparece como pendiente" ;; *) ko "el turno aparece como pendiente" ;; esac
api GET "/turnos/$TURNO/recordatorio/whatsapp" ""
check 200 "generar enlace de WhatsApp"
case "$(json enlace)" in https://wa.me/*) ok "el enlace es https://wa.me/..." ;; *) ko "el enlace es https://wa.me/..." ;; esac
api GET "/turnos/pendientes-recordatorio?fecha=$MANANA" ""
case "$HTTP_BODY" in *"\"turnoId\":$TURNO"*) ko "con un recordatorio GENERADO el turno deja de estar pendiente" ;; *) ok "con un recordatorio GENERADO el turno deja de estar pendiente" ;; esac
api POST "/turnos/$TURNO/recordatorio/email" ""
case "$HTTP_STATUS" in
	201) ok "email de recordatorio enviado (SMTP configurado)" ;;
	503) ok "email sin SMTP configurado -> 503 (esperado si SMTP_HOST/SMTP_FROM están vacíos)" ;;
	502) ok "email con SMTP inalcanzable -> 502 (informativo: revisar SMTP_*)" ;;
	*) ko "email de recordatorio: se esperaba 201, 502 o 503" ;;
esac
api PATCH "/turnos/$TURNO/estado" '{"estado":"CONFIRMADO"}'
check 200 "confirmar el turno"

echo "== Flujo 7: exportación y auditoría"
api GET "/pacientes/$PAC/export" ""
check 200 "exportar datos del paciente"
case "$(header content-disposition)" in *"paciente-$PAC-export.json"*) ok "descarga paciente-$PAC-export.json" ;; *) ko "Content-Disposition del export" ;; esac
case "$(header cache-control)" in *no-store*) ok "export con Cache-Control: no-store" ;; *) ko "export con Cache-Control: no-store" ;; esac
api GET "/auditoria?entidad=Paciente&accion=EXPORT&entidadId=$PAC" ""
check 200 "consultar auditoría"
check_eq "$(json totalElementos)" "1" "una fila EXPORT del paciente en audit_log"
api GET "/auditoria?entidad=FichaClinica&entidadId=$PAC" ""
if [ "$(json totalElementos)" -ge 1 ] 2>/dev/null; then ok "lecturas/escrituras de la ficha auditadas"; else ko "lecturas/escrituras de la ficha auditadas"; fi

echo "== Aislamiento entre consultorios y autenticación"
TOKEN_A="$TOKEN"
EMAIL_B="smoke-b-$MARCA@smoke.local"
registrar "$EMAIL_B" "$PASSWORD" 'Smoke B' 'Beto' 'Smoke'
check 201 "registro del consultorio B"
login "$EMAIL_B" "$PASSWORD"
check 200 "login del consultorio B"
api GET "/pacientes/$PAC" ""
check 404 "B no ve el paciente de A"
api GET "/pacientes/$PAC/ficha" ""
check 404 "B no ve la ficha de A"
api GET "/pacientes/$PAC/export" ""
check 404 "B no puede exportar el paciente de A"
api GET "/turnos/$TURNO" ""
check 404 "B no ve el turno de A"
api GET "/auditoria?entidad=Paciente&accion=EXPORT&entidadId=$PAC" ""
check_eq "$(json totalElementos)" "0" "B no ve la auditoría de A"
TOKEN=""
api GET /pacientes ""
check 401 "sin token -> 401"
TOKEN="${TOKEN_A}x"
api GET /pacientes ""
check 401 "token adulterado -> 401"

if [ "$SMOKE_DB" = "1" ]; then
	echo "== RBAC: RECEPCION"
	if set_rol "$EMAIL_B" RECEPCION; then
		login "$EMAIL_B" "$PASSWORD"
		check 200 "login como RECEPCION (el rol viaja en el JWT)"
		api GET /pacientes ""
		check 200 "RECEPCION lista pacientes"
		api POST /pacientes '{"nombre":"Rec","apellido":"Smoke","dni":"41234567"}'
		check 201 "RECEPCION da de alta un paciente"
		PAC_B="$(json id)"
		api GET "/pacientes/$PAC_B/ficha" ""
		check 403 "RECEPCION no accede a la ficha clínica"
		api GET "/pacientes/$PAC_B/export" ""
		check 403 "RECEPCION no exporta"
		api GET /auditoria ""
		check 403 "RECEPCION no ve la auditoría"
	else
		HTTP_STATUS="-"
		ko "cambiar el rol por SQL (docker compose exec mysql)"
	fi
else
	echo "== RBAC: RECEPCION omitido (SMOKE_DB=1 para probarlo)"
fi

resumen
