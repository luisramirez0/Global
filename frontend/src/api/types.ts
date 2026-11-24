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
