/** Contrato de autenticación de C-03 (knowledge-base/entrega/C-03.md). */

export const ROLES = ['ADMIN', 'PROFESIONAL', 'RECEPCION'] as const;
export type Rol = (typeof ROLES)[number];

export interface RegistroRequest {
  consultorioNombre: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  /** Opcional; si viene vacía no se envía. */
  matricula?: string;
}

export interface RegistroResponse {
  consultorioId: number;
  usuarioId: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  usuario: { id: number; nombre: string; rol: Rol };
  consultorioId: number;
}

export interface MeResponse {
  usuario: { id: number; nombre: string; email: string; rol: Rol };
  consultorio: { id: number; nombre: string };
}

/** Contrato de configuración de agenda de C-04 (knowledge-base/entrega/C-04.md, spec agenda-configuration). */

export interface Sillon {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface SillonRequest {
  nombre: string;
  /** Omitido en PUT = no cambia. */
  activo?: boolean;
}

export interface Prestacion {
  id: number;
  nombre: string;
  duracionMinutos: number;
  activo: boolean;
}

export interface PrestacionRequest {
  nombre: string;
  duracionMinutos: number;
  /** Omitido en PUT = no cambia. */
  activo?: boolean;
}

/** `diaSemana` ISO: lunes = 1 … domingo = 7. */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Horario {
  id: number;
  profesionalId: number;
  diaSemana: DiaSemana;
  /** `HH:mm`, hora local del consultorio. */
  horaDesde: string;
  horaHasta: string;
}

export interface HorarioRequest {
  /** Omitido: el backend usa el único profesional activo (422 si no hay exactamente uno). */
  profesionalId?: number;
  diaSemana: DiaSemana;
  horaDesde: string;
  horaHasta: string;
}

export interface Bloqueo {
  id: number;
  sillonId: number | null;
  profesionalId: number | null;
  /** Instantes ISO-8601 UTC. */
  inicio: string;
  fin: string;
  motivo: string | null;
}

export interface BloqueoRequest {
  sillonId: number | null;
  profesionalId: number | null;
  inicio: string;
  fin: string;
  motivo?: string;
}

export interface FiltroBloqueos {
  desde?: string;
  hasta?: string;
}

/** Contrato de turnos de C-07 (knowledge-base/entrega/C-07.md, spec appointment-scheduling). */

export const ESTADOS_TURNO = ['PROGRAMADO', 'CONFIRMADO', 'CANCELADO', 'ASISTIO', 'AUSENTE'] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

export interface Turno {
  id: number;
  /** Instantes ISO-8601 UTC. */
  inicio: string;
  fin: string;
  estado: EstadoTurno;
  sobreturno: boolean;
  motivoCancelacion: string | null;
  notas: string | null;
  sillonId: number;
  profesionalId: number | null;
  paciente: { id: number; nombre: string; apellido: string };
  prestacion: { id: number; nombre: string };
}

export interface TurnoCreateRequest {
  pacienteId: number;
  prestacionId: number;
  sillonId: number;
  /** Omitido: el backend usa el único profesional activo. */
  profesionalId?: number;
  inicio: string;
  /** Omitido = falso. */
  sobreturno?: boolean;
  notas?: string;
}

export interface TurnoEstadoRequest {
  estado: EstadoTurno;
  /** Solo con `CANCELADO`. */
  motivoCancelacion?: string;
}

export interface TurnoReprogramarRequest {
  inicio: string;
  /** Omitido: se conserva el sillón. */
  sillonId?: number;
  profesionalId?: number;
  sobreturno?: boolean;
}

export interface FiltroTurnos {
  /** Rango `[desde, hasta)` en instantes UTC, máximo 42 días. */
  desde: string;
  hasta: string;
  sillonId?: number;
  profesionalId?: number;
  incluirCancelados?: boolean;
}

/** Detalle de un 409 de turno: solo ids e instantes, nunca datos del otro paciente. */
export interface ConflictoTurno {
  turnoId: number;
  inicio: string;
  fin: string;
  sillonId: number;
  profesionalId: number;
  motivo: 'SILLON' | 'PROFESIONAL';
}

/** Contrato de pacientes de C-05 (knowledge-base/entrega/C-05.md). */

export interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  /** `YYYY-MM-DD` o `null`. */
  fechaNacimiento: string | null;
  sexo: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  obraSocialTexto: string | null;
  activo: boolean;
}

/** Contrato de `GET /api/auditoria` (knowledge-base/entrega/C-06.md) y del export de C-15. */

export const ACCIONES_AUDITORIA = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN'] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

/** Valores del detalle: el backend solo admite números, booleanos y códigos (sin PII). */
export type ValorDetalle = string | number | boolean;

export interface EntradaAuditoria {
  id: number;
  /** Instant UTC ISO-8601. */
  fecha: string;
  usuarioId: number | null;
  accion: AccionAuditoria;
  entidad: string;
  entidadId: number | null;
  detalle: Readonly<Record<string, ValorDetalle>> | null;
  ip: string | null;
}

export interface Pagina<T> {
  contenido: T[];
  pagina: number;
  tamanio: number;
  totalElementos: number;
  totalPaginas: number;
}

export interface FiltroPacientes {
  q?: string;
  page?: number;
  size?: number;
  incluirInactivos?: boolean;
}

/**
 * Filtros de la consulta. `desde` inclusivo y `hasta` exclusivo, como instantes UTC. `entidadId` solo junto con
 * `entidad`: el backend no distingue entidades por id (design D8 de C-15).
 */
export interface FiltrosAuditoria {
  desde?: string;
  hasta?: string;
  accion?: AccionAuditoria;
  entidad?: string;
  entidadId?: number;
  usuarioId?: number;
  page: number;
}

/** Paquete del export: se descarga tal cual, sin mostrarlo (design D11 de C-15). */
export type ExportPaciente = Readonly<Record<string, unknown>>;
