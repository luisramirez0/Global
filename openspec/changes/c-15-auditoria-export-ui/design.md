# Design

> Decisiones D1–D11 aprobadas por la persona (Integrante 3) el 2026-11-24, tal como se recomendaron, incluyendo D8 (no tocar el backend de C-06) y D11 (componente de export montado en `#/auditoria` mientras C-12 está pendiente).

## Contexto

- `GET /api/auditoria` (C-06, `auditoria/consulta`): `@PreAuthorize(GESTION)`, tenant por `@TenantId`, `readOnly` válido porque la lectura del log no se audita. Filtros `desde`/`hasta` (UTC, `hasta` exclusivo), `accion`, `entidad` (un valor), `entidadId`, `usuarioId`, `page`/`size` (20, máx. 100). Respuesta `Pagina<{id, fecha, usuarioId, accion, entidad, entidadId, detalle, ip}>`.
- Quién audita qué hoy: `FichaClinica`, `NotaClinica`, `ConsentimientoDatos` → `entidadId = pacienteId`; `Turno` → `turnoId`; `LOGIN` (`Usuario`) → `usuarioId`. `Paciente` (ABM) no audita. `EXPORT` existe en `AccionAuditoria` y no se usa.
- Regla 5 de C-06 (MySQL 8.4): un método que audita no corre en una transacción `readOnly`; H2 no lo detecta.
- `TurnoRepository` no tiene consulta por paciente. C-12 (ficha en el frontend) está pendiente. `NavItem` no filtra por rol.

## Decisiones

### D1. Endpoint
`GET /api/pacientes/{id}/export` en `paciente/export/` (`PacienteExportController`, `PacienteExportService`). `@PreAuthorize(Permisos.GESTION)`. Respuesta `200 application/json` con:
- `Content-Disposition: attachment; filename="paciente-<id>-export.json"` (el nombre del archivo nunca lleva nombre ni DNI).
- `Cache-Control: no-store`.

### D2. Contenido
```json
{
  "exportadoEn": "2026-11-24T13:00:00Z",
  "paciente": { "id", "nombre", "apellido", "dni", "fechaNacimiento", "sexo", "telefono", "email", "direccion", "obraSocialTexto", "activo" },
  "consentimientos": [ { "id", "versionTexto", "aceptadoEn", "registradoPorUsuarioId" } ],
  "ficha": { "alergias", "medicacionActual", "antecedentesMedicos", "enfermedadesRelevantes", "embarazo", "motivoConsulta", "observaciones", "actualizadaEn" } | null,
  "notas": [ { "id", "fecha", "profesionalId", "turnoId", "texto" } ],
  "turnos": [ { "id", "inicio", "fin", "estado", "sobreturno", "motivoCancelacion", "notas", "profesionalId", "prestacion": { "id", "nombre" }, "sillon": { "id", "nombre" } } ]
}
```
- Orden: consentimientos del más reciente al más antiguo (consulta existente); notas y turnos en orden cronológico ascendente (`fecha`/`inicio`, luego `id`).
- Sin paginar: es el paquete completo del paciente.
- Excluye `consultorio_id`, `version` de bloqueo optimista, `createdAt`/`updatedAt` técnicos (salvo `actualizadaEn` de la ficha) y el propio log de auditoría.
- DTOs propios del paquete (records); no se reutilizan los factories package-private de `ficha/` ni `abm/` (regla 1: nunca entidades).

### D3. Auditoría
El servicio no lleva `@Transactional` ni `@Audited`. Arma el paquete y registra dentro de un `TransactionTemplate` de lectura-escritura (`REQUIRED`):
`AuditService.registrar(EXPORT, "Paciente", pacienteId, {consentimientos:n, ficha:bool, notas:n, turnos:n})`.
- Detalle dinámico (conteos) → `registrar` explícito, regla 6 de C-06. Sin contenido clínico ni datos personales.
- Ningún método del paquete corre en una transacción `readOnly` (test de arquitectura).

### D4. Fail-closed
El registro va dentro de la transacción, antes de devolver. Un error de `registrar` se loguea solo con ids y tipo de excepción y se traduce a `AuditoriaFallidaException` (`500` genérico), como `TurnoService`. Un error al confirmar también propaga como `500`. En ningún caso la respuesta lleva datos del paciente.

### D5. Casos borde
- Paciente dado de baja: se exporta (`activo: false`); el derecho de acceso no caduca (RN-DS-06, RN-PA-03).
- Sin consentimiento: se exporta con `ficha: null` y listas vacías que correspondan. No se exige consentimiento: exportar es entregar al titular lo que ya existe.
- Paciente de otro consultorio o inexistente: `404` sin auditoría (el filtro de tenant lo oculta).
- `RECEPCION` → `403`; sin token → `401`; ninguno deja fila.

### D6. Formato
Solo JSON. El PDF de US-040 queda fuera del MVP (no hay dependencias nuevas).

### D7. Consultas
`paciente/export/PacienteExportRepository extends Repository<Paciente, Long>` (solo lectura, sin `save`/`delete`), con JPQL portable:
- `turnosDe(pacienteId)`: `join fetch` de prestación y sillón, orden `inicio asc, id asc`.
- `notasDe(pacienteId)`: `join fetch` de profesional y `left join fetch` de turno, orden `fecha asc, id asc`.
- Paciente, ficha y consentimientos con los repositorios existentes (`PacienteRepository.findById`, `FichaClinicaRepository.findByPacienteId`, `ConsentimientoDatosRepository.findByPacienteIdOrderByAceptadoEnDescIdDesc`).
- `agenda/` y `auditoria/` sin cambios. El tenant lo aplica `@TenantId` en cada entidad.

### D8. Colisión de `entidadId`
No se cambia `GET /api/auditoria`. La spec `audit-log` aclara que `entidadId` no distingue entidades. En la UI el campo "Id de entidad" solo se habilita con una entidad elegida y se envía siempre junto con `entidad`. El handoff de C-15 corrige el contrato publicado por C-08. Filtro multientidad y vista por paciente: post-entrega.

### D9. Pantalla `#/auditoria`
- Filtros: desde/hasta (`date` en hora del consultorio → `Instant` UTC con `utils/zonaHoraria`; `hasta` se envía como el inicio del día siguiente, exclusivo), acción (select), entidad (select con `FichaClinica`, `NotaClinica`, `ConsentimientoDatos`, `Paciente`, `Turno`, `Usuario`), id de entidad, usuario.
- Tabla: fecha local, usuario (id), acción, entidad, id, detalle (`clave: valor` con `textContent`), IP.
- Paginado anterior/siguiente; estados de carga, vacío y error con "Reintentar"; respuestas viejas descartadas. Filtros en memoria (el router descarta el `?query`).
- `400` → mensaje fijo de filtros inválidos; `403` → mensaje fijo de sin permiso.

### D10. Permisos en la UI
`NavItem` gana `roles?: readonly Rol[]` (aditivo); el layout omite los ítems cuyo rol no coincide. "Auditoría" lleva `['ADMIN', 'PROFESIONAL']`. Si `RECEPCION` entra por URL, la página muestra el mensaje de sin permiso y no pide datos. El backend sigue autorizando.

### D11. Componente de export
`components/exportarPaciente.ts`: botón que pide el export por el cliente tipado (token en header), serializa el JSON a un `Blob` y lo descarga con un `<a download>` temporal + `URL.createObjectURL`/`revokeObjectURL`. Deshabilitado mientras descarga; errores con mensaje fijo (`403`, `404`, red). No guarda nada en `localStorage`, no loguea, no muestra el contenido. Se monta en `#/auditoria` como "Exportar datos de un paciente" por id; C-12 (Integrante 5) lo monta en la ficha (a coordinar).

## Riesgos

- **Read-only en MySQL**: cubierto por D3 y el test de arquitectura; verificación manual contra MySQL 8.4 en la checklist.
- **Volumen**: un paciente con muchas notas/turnos se exporta entero; aceptable para un consultorio independiente.
- **Filtros de `GET /api/auditoria` sin verificar en MySQL** (pendiente de C-06): se incluyen en la checklist manual.
- **Recorte**: la exportación es el tercer ítem del orden de recorte; por eso se implementa primero el backend.
