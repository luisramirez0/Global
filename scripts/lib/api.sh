#!/usr/bin/env bash
# Helpers HTTP compartidos por demo-seed.sh y smoke-e2e.sh (C-16).
# Requisitos: Git Bash (o cualquier bash), curl y node (el mismo que usa frontend/).
# No imprime tokens, contraseñas ni datos de pacientes (regla 5): solo ids y códigos HTTP.

API="${API:-http://localhost:8080/api}"
TOKEN=""
HTTP_STATUS=""
HTTP_BODY=""
HTTP_HEADERS=""

_TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$_TMP_DIR"' EXIT

require_tools() {
	local t
	for t in curl node; do
		command -v "$t" >/dev/null 2>&1 || { echo "Falta '$t' en el PATH." >&2; exit 3; }
	done
}

# api METODO RUTA [CUERPO_JSON] [extra curl args...]
# Deja HTTP_STATUS, HTTP_BODY y HTTP_HEADERS. Usa TOKEN si está definido.
# El cuerpo viaja desde un archivo (--data-binary @archivo): los argumentos inline
# con acentos llegan mal codificados desde Git Bash (ver handoff C-05).
api() {
	local method="$1" path="$2" body="${3:-}"
	shift 3 2>/dev/null || shift $#
	local args=(-s -S -X "$method" -o "$_TMP_DIR/body" -D "$_TMP_DIR/headers" -w '%{http_code}'
		-H 'Accept: application/json' --max-time 30)
	if [ -n "$TOKEN" ]; then
		args+=(-H "Authorization: Bearer $TOKEN")
	fi
	if [ -n "$body" ]; then
		printf '%s' "$body" >"$_TMP_DIR/req.json"
		args+=(-H 'Content-Type: application/json; charset=utf-8' --data-binary "@$_TMP_DIR/req.json")
	fi
	HTTP_STATUS="$(curl "${args[@]}" "$@" "$API$path" 2>/dev/null)" || HTTP_STATUS="000"
	HTTP_BODY="$(cat "$_TMP_DIR/body" 2>/dev/null || true)"
	HTTP_HEADERS="$(tr -d '\r' <"$_TMP_DIR/headers" 2>/dev/null || true)"
}

# header NOMBRE -> valor del encabezado de la última respuesta (sin distinguir mayúsculas)
header() {
	printf '%s\n' "$HTTP_HEADERS" | awk -v n="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" '
		{ i = index($0, ":"); if (i > 0 && tolower(substr($0, 1, i - 1)) == n) { v = substr($0, i + 1); sub(/^ +/, "", v); print v } }' | tail -1
}

# json RUTA -> valor de HTTP_BODY en la ruta con puntos (p. ej. "usuario.rol", "0.id", "contenido.length")
json() {
	printf '%s' "$HTTP_BODY" | node -e '
		let s = "";
		process.stdin.on("data", (d) => (s += d)).on("end", () => {
			let v;
			try { v = JSON.parse(s); } catch { process.exit(0); }
			for (const k of process.argv[1].split(".")) { v = v == null ? v : v[k]; }
			if (v != null) process.stdout.write(typeof v === "object" ? JSON.stringify(v) : String(v));
		});' "$1"
}

# Fechas en la zona del consultorio (America/Argentina/Buenos_Aires, UTC-3 fijo, sin horario de verano).
fecha_ar() { date -u -d "-3 hours ${1:-}" +%F; }
# instante_ar AAAA-MM-DD HH:MM -> instante UTC ISO-8601 (p. ej. 2026-11-26T13:00:00Z)
instante_ar() { date -u -d "$1 $2 -0300" +%Y-%m-%dT%H:%M:%SZ; }

check_health() {
	api GET /health ""
	if [ "$HTTP_STATUS" != "200" ]; then
		echo "La API no responde en $API/health (HTTP $HTTP_STATUS). ¿Está levantado el stack? (ver README)" >&2
		exit 4
	fi
}

# login EMAIL PASSWORD -> fija TOKEN
login() {
	local email="$1" password="$2" saved="$TOKEN"
	TOKEN=""
	api POST /auth/login "{\"email\":$(json_str "$email"),\"password\":$(json_str "$password")}"
	if [ "$HTTP_STATUS" != "200" ]; then
		TOKEN="$saved"
		return 1
	fi
	TOKEN="$(json accessToken)"
}

# registrar EMAIL PASSWORD CONSULTORIO NOMBRE APELLIDO -> HTTP_STATUS (201 / 409)
# CONSULTORIO, NOMBRE y APELLIDO van tal cual dentro del JSON (texto fijo del script, sin comillas).
registrar() {
	local saved="$TOKEN"
	TOKEN=""
	api POST /auth/register "{\"consultorioNombre\":\"$3\",\"nombre\":\"$4\",\"apellido\":\"$5\",\"email\":$(json_str "$1"),\"password\":$(json_str "$2")}"
	TOKEN="$saved"
}

# json_str TEXTO -> literal JSON entre comillas (para email y contraseña, que elige la persona)
json_str() { node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"; }

# set_rol EMAIL ROL -> cambia el rol por SQL dentro del contenedor mysql (no hay ABM de usuarios en el MVP).
# Requiere correr desde la raíz del repo con el stack de docker compose levantado.
set_rol() {
	local email="$1" rol="$2"
	if ! printf '%s' "$email" | grep -Eq '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$'; then
		echo "Email inválido para set_rol" >&2
		return 1
	fi
	case "$rol" in ADMIN | PROFESIONAL | RECEPCION) ;; *) echo "Rol inválido" >&2; return 1 ;; esac
	MSYS_NO_PATHCONV=1 docker compose exec -T mysql sh -c \
		"MYSQL_PWD=\"\$MYSQL_PASSWORD\" mysql -u\"\$MYSQL_USER\" \"\$MYSQL_DATABASE\" -e \"UPDATE usuario SET rol = '$rol' WHERE email = '$email';\"" \
		>/dev/null
}
