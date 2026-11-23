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
