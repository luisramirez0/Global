/**
 * Cuerpos del contrato real de C-03 (knowledge-base/entrega/C-03.md) para los tests.
 * Datos ficticios, sin personas reales.
 */
import type { LoginResponse, MeResponse, RegistroResponse } from '../types';

export const REGISTRO_OK: RegistroResponse = { consultorioId: 2, usuarioId: 2 };

export const LOGIN_OK: LoginResponse = {
  accessToken: 'token-de-prueba.abc.def',
  tokenType: 'Bearer',
  expiresIn: 1800,
  usuario: { id: 2, nombre: 'Ana', rol: 'ADMIN' },
  consultorioId: 2,
};

export const ME_OK: MeResponse = {
  usuario: { id: 2, nombre: 'Ana', email: 'ana@consultorio.test', rol: 'ADMIN' },
  consultorio: { id: 2, nombre: 'Consultorio Sonrisas' },
};

export const PROBLEM_401 = {
  type: 'about:blank',
  title: 'No autenticado',
  status: 401,
  detail: 'Credenciales inválidas',
};

export const PROBLEM_400 = {
  type: 'about:blank',
  title: 'Datos inválidos',
  status: 400,
  detail: 'La solicitud tiene campos inválidos',
  errores: [{ campo: 'email', mensaje: 'debe ser una dirección de correo electrónico con formato correcto' }],
};

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function problemResponse(status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Error', status, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  });
}
