#!/usr/bin/env bash
# Carga los datos de la demo de C-16 por la API real (no toca la base a mano, salvo el
# cambio de rol opcional de RECEPCION). Todos los datos son ficticios.
#
# Uso (Git Bash, desde la raíz del repo, con el stack levantado):
#   DEMO_PASSWORD='una-clave-de-8+' bash scripts/demo-seed.sh
# Variables:
#   API             (default http://localhost:8080/api)
#   DEMO_EMAIL      (default demo@consultorio.local)   cuenta ADMIN del consultorio demo
#   DEMO_PASSWORD   (obligatoria, mínimo 8 caracteres; no se guarda ni se imprime)
#   DEMO_RECEPCION  (1 = crea además recepcion@consultorio.local con rol RECEPCION, en su
#                    propio consultorio; requiere `docker compose exec`. Default 0)
#
# Si el consultorio demo ya existe (409), se detiene: partir de una base limpia con
# `docker compose down -v` (lo corre la persona, ver README).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/api.sh
. "$ROOT/scripts/lib/api.sh"

DEMO_EMAIL="${DEMO_EMAIL:-demo@consultorio.local}"
DEMO_PASSWORD="${DEMO_PASSWORD:-}"
DEMO_RECEPCION="${DEMO_RECEPCION:-0}"

fail() { echo "ERROR: $*" >&2; exit 1; }
expect() { # expect CODIGO DESCRIPCION
	[ "$HTTP_STATUS" = "$1" ] || fail "$2: se esperaba HTTP $1 y llegó $HTTP_STATUS"
}

require_tools
[ "${#DEMO_PASSWORD}" -ge 8 ] || fail "definí DEMO_PASSWORD (mínimo 8 caracteres)"
check_health

echo "== 1. Consultorio demo"
registrar "$DEMO_EMAIL" "$DEMO_PASSWORD" 'Consultorio Demo Sonrisas' 'Laura' 'Gómez'
[ "$HTTP_STATUS" = "409" ] && fail "ya existe una cuenta $DEMO_EMAIL. Partí de una base limpia (docker compose down -v) o usá otro DEMO_EMAIL."
expect 201 "registro"
login "$DEMO_EMAIL" "$DEMO_PASSWORD" || fail "login del consultorio demo (HTTP $HTTP_STATUS)"
echo "   consultorio y ADMIN creados (el registro también crea el profesional y el Sillón 1)"

echo "== 2. Configuración: sillones, prestaciones, horarios, bloqueo"
api POST /sillones '{"nombre":"Sillón 2"}'
expect 201 "alta de Sillón 2"
SILLON2="$(json id)"
api GET /sillones ""
expect 200 "listado de sillones"
# El otro sillón activo es el "Sillón 1" que crea el registro.
SILLON1="$(json 0.id)"
[ "$SILLON1" = "$SILLON2" ] && SILLON1="$(json 1.id)"
[ -n "$SILLON1" ] && [ -n "$SILLON2" ] || fail "no se encontraron los ids de los sillones"

declare -A PREST
for p in 'Consulta:30' 'Control:15' 'Limpieza:45' 'Extracción simple:60'; do
	nombre="${p%%:*}"
	dur="${p##*:}"
	api POST /prestaciones "{\"nombre\":\"$nombre\",\"duracionMinutos\":$dur}"
	expect 201 "alta de prestación"
	PREST[$dur]="$(json id)"
done

# Todos los días (1 = lunes .. 7 = domingo) para que la demo funcione cualquier día de la semana.
for d in 1 2 3 4 5 6 7; do
	api POST /horarios-atencion "{\"diaSemana\":$d,\"horaDesde\":\"09:00\",\"horaHasta\":\"18:00\"}"
	expect 201 "horario día $d"
done

MANANA="$(fecha_ar '+1 day')"
HOY="$(fecha_ar)"
api POST /bloqueos "{\"inicio\":\"$(instante_ar "$MANANA" 13:00)\",\"fin\":\"$(instante_ar "$MANANA" 14:00)\",\"motivo\":\"Almuerzo\"}"
expect 201 "bloqueo de mañana 13:00-14:00"
echo "   2 sillones, 4 prestaciones, horario 09:00-18:00 todos los días, bloqueo mañana 13-14 h"

echo "== 3. Pacientes (ficticios)"
# nombre|apellido|dni|telefono|email
PACIENTES=(
	'María|Pérez|30111222|+5491150000001|maria.perez@example.com'
	'Juan|Rodríguez|31222333|+5491150000002|'
	'Ana|López|32333444||ana.lopez@example.com'
	'Carlos|Fernández|33444555|+5491150000004|carlos.fernandez@example.com'
	'<img src=x onerror=alert(1)>|Prueba XSS|34555666|+5491150000005|'
)
declare -a PAC
for row in "${PACIENTES[@]}"; do
	IFS='|' read -r nombre apellido dni tel email <<<"$row"
	cuerpo="{\"nombre\":\"$nombre\",\"apellido\":\"$apellido\",\"dni\":\"$dni\""
	[ -n "$tel" ] && cuerpo+=",\"telefono\":\"$tel\""
	[ -n "$email" ] && cuerpo+=",\"email\":\"$email\""
	cuerpo+="}"
	api POST /pacientes "$cuerpo"
	expect 201 "alta de paciente"
	PAC+=("$(json id)")
done
echo "   ${#PAC[@]} pacientes: ids ${PAC[*]} (Ana sin teléfono, Juan sin email, el último con nombre XSS)"

echo "== 4. Ficha clínica de María (consentimiento, anamnesis, nota)"
api GET /consentimientos/texto-vigente ""
expect 200 "texto de consentimiento vigente"
VERSION="$(json version)"
api POST "/pacientes/${PAC[0]}/consentimientos" "{\"versionTexto\":\"$VERSION\"}"
expect 201 "consentimiento"
api PUT "/pacientes/${PAC[0]}/ficha" '{"alergias":"Penicilina","medicacionActual":"Ninguna","motivoConsulta":"Control anual","embarazo":false,"version":null}'
expect 200 "anamnesis"
api POST "/pacientes/${PAC[0]}/notas" '{"texto":"Primera consulta. Sin hallazgos relevantes."}'
expect 201 "nota clínica"
echo "   Juan y Ana quedan SIN consentimiento (para mostrar el bloqueo de la ficha)"

echo "== 5. Turnos"
turno() { # turno PACIENTE PRESTACION_DUR SILLON FECHA HH:MM
	api POST /turnos "{\"pacienteId\":$1,\"prestacionId\":${PREST[$2]},\"sillonId\":$3,\"inicio\":\"$(instante_ar "$4" "$5")\"}"
	expect 201 "turno $4 $5"
}
# Mañana: alimentan #/recordatorios (un solo profesional: sin superposiciones).
turno "${PAC[0]}" 30 "$SILLON1" "$MANANA" 09:00
turno "${PAC[1]}" 15 "$SILLON1" "$MANANA" 09:30
turno "${PAC[2]}" 45 "$SILLON2" "$MANANA" 10:00
turno "${PAC[3]}" 30 "$SILLON1" "$MANANA" 11:00
turno "${PAC[4]}" 15 "$SILLON2" "$MANANA" 12:00
# Hoy temprano (ya empezado): para mostrar "Asistió".
turno "${PAC[3]}" 15 "$SILLON1" "$HOY" 09:00
echo "   5 turnos mañana ($MANANA) y 1 hoy ($HOY 09:00, para marcar Asistió)"

if [ "$DEMO_RECEPCION" = "1" ]; then
	echo "== 6. Usuario RECEPCION (consultorio propio; no hay ABM de usuarios en el MVP)"
	registrar recepcion@consultorio.local "$DEMO_PASSWORD" 'Consultorio Recepcion Demo' 'Rita' 'Recepcion'
	[ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "409" ] || fail "registro de recepción (HTTP $HTTP_STATUS)"
	set_rol recepcion@consultorio.local RECEPCION || fail "no se pudo cambiar el rol (¿docker compose levantado y corriendo desde la raíz?)"
	echo "   recepcion@consultorio.local con rol RECEPCION (misma contraseña que la demo)"
fi

echo
echo "Listo. Entrá a http://localhost:5173 con $DEMO_EMAIL y la contraseña de DEMO_PASSWORD."
