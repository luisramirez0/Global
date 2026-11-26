# Guion de la demo (C-16): versión corta

> Supuesto de PA-01 (2026-11-25): la entrega es **código + demo**. Este guion es corto a propósito y se ajusta después.
> Duración objetivo: 8 a 10 minutos. Todos los datos son ficticios.

## Antes de empezar (unos 15 minutos antes)

1. Docker Desktop abierto y sano. Si hubo errores de disco de WSL2, reiniciá Docker Desktop.
2. Desde la raíz del repo (Git Bash):
   ```bash
   docker compose down -v && docker compose up --build -d
   curl -s http://localhost:8080/api/health        # {"status":"UP"}
   DEMO_PASSWORD='...' DEMO_RECEPCION=1 bash scripts/demo-seed.sh
   bash scripts/smoke-e2e.sh                          # debe terminar con 0 fallas
   ```
   En PowerShell: `scripts\demo-seed.ps1` y `scripts\smoke-e2e.ps1` (ver README).
3. Navegador en <http://localhost:5173>, con una pestaña en el login y otra con `docker compose logs -f backend`
   (para mostrar que los logs solo tienen ids).
4. Tener a mano el id de María Pérez, que el script imprime en "pacientes: ids ...".

## Recorrido

| # | Min | Flujo (KB 07) | Qué mostrar | Qué decir |
|---|---|---|---|---|
| 1 | 1 | Flujo 1: login | Entrar con `demo@consultorio.local`. Se llega a `#/agenda`. | Multi-tenant: cada consultorio ve solo lo suyo; JWT de 30 minutos. |
| 2 | 1 | Configuración | `#/config`: 2 sillones (el máximo), prestaciones con duración, horario y el bloqueo de mañana a las 13 h. | La grilla es de 15 minutos (supuesto PA-03). |
| 3 | 2 | Flujo 2: turnos | Vista **Día de mañana**: los 5 turnos. "Nuevo turno" para Juan en el **mismo sillón y horario** que María (09:00) → **mensaje de conflicto, sin sobreturno**. Repetir en el otro sillón → conflicto de **profesional** con "Agendar como sobreturno". Probar 13:00 → **bloqueo**. | El no-solapamiento lo valida el backend en una transacción con lock: `409`/`422`, nunca un turno doble. |
| 4 | 2 | Flujo 5: ficha | `#/pacientes`, buscar "perez". Ficha de **Juan** → **bloqueada hasta registrar el consentimiento**; registrarlo, cargar alergias, guardar y agregar una nota. Ficha de **María** → ya cargada. | Datos de salud: consentimiento previo, notas inmutables y cada lectura queda auditada. |
| 5 | 1 | Seguridad (XSS) | En la agenda o en pacientes, el paciente `<img src=x onerror=alert(1)>` se ve como **texto**. | Sin framework no hay escape automático: nada de `innerHTML`. |
| 6 | 2 | Flujo 3: recordatorio | `#/recordatorios` (mañana): "WhatsApp" en María → "Abrir WhatsApp" abre `wa.me` con el mensaje. Ana tiene el botón **deshabilitado** (sin teléfono). Volver a la agenda y "Confirmar" el turno de María. | Presupuesto cero: `wa.me` sin API paga; el mensaje no incluye datos clínicos. Sin SMTP, "Email" muestra "no disponible" (`503`). |
| 7 | 1 | Flujo 7: auditoría y export | `#/auditoria`: filtrar por entidad `FichaClinica` y el id de Juan → ver `READ`/`CREATE`. **Exportar** a María con su id → se descarga `paciente-<id>-export.json` y aparece la fila `EXPORT`. | Ley 26.529: derecho de acceso del paciente; todo queda registrado. El export todavía no está en la ficha (B-01). |
| 8 | 1 | RBAC | Cerrar sesión y entrar como `recepcion@consultorio.local`: el menú no tiene "Auditoría", y `#/auditoria` muestra "Tu rol no tiene acceso a la auditoría.". Su consultorio está vacío (B-03): dar de alta un paciente y ver que no aparece "Ficha" ni "Dar de baja". | RECEPCION: agenda y pacientes, sin datos clínicos (supuesto PA-07). El backend también responde `403` (smoke con `SMOKE_DB=1`). |
| — | — | Cierre | El smoke (`[OK]` en todos los pasos) y [docs/checklist-seguridad.md](checklist-seguridad.md). | Lo que queda: [docs/bugs-conocidos.md](bugs-conocidos.md) y el roadmap C-17..C-22. |

## Plan B

- **El stack no levanta**: mostrar el smoke de una corrida anterior (guardar la salida con `bash scripts/smoke-e2e.sh | tee smoke.txt`,
  sin subirla al repo) y los tests (`bash scripts/test.sh`).
- **El backend arranca pero la agenda rechaza horarios válidos** ("fuera de agenda"): es el desfase B-02. Partir de `down -v`
  y cargar los datos solo con el backend de Docker.
- **El seed se detiene con "ya existe una cuenta"**: la base no está limpia; `docker compose down -v` o `DEMO_EMAIL=otro@...`.
- **WhatsApp no abre**: el navegador bloqueó la pestaña; por eso el enlace es un segundo clic ("Abrir WhatsApp").
