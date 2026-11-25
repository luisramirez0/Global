/**
 * Validación del alta y la edición de pacientes con las mismas reglas que el backend de C-05 (C-12, design D9):
 * `PacienteRequest`, `Dni` y `TelefonoE164`. Solo evita viajes obvios: el servidor es la fuente de verdad (A-D9),
 * y sus errores por campo se muestran aunque esta validación los haya dejado pasar.
 */
import type { PacienteRequest } from '../../api/types';
import { MSG_REQUIRED } from '../auth/validation';

/** Lo que tipea la persona, tal cual (todo texto). */
export interface ValoresPaciente {
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: string;
  sexo: string;
  telefono: string;
  email: string;
  direccion: string;
  obraSocialTexto: string;
}

export type CampoPaciente = keyof ValoresPaciente;

export type Resultado = { ok: true; value: PacienteRequest } | { ok: false; errors: Partial<Record<CampoPaciente, string>> };

export const MSG_DNI = 'Ingresá un DNI de 7 u 8 dígitos (podés usar puntos o espacios).';
export const MSG_TELEFONO = 'Ingresá el teléfono con código de país, por ejemplo +54 9 11 2345 6789.';
export const MSG_EMAIL = 'Ingresá un email válido.';
export const MSG_FECHA = 'Ingresá una fecha válida.';
export const MSG_FECHA_FUTURA = 'La fecha de nacimiento no puede ser futura.';

/** Largos máximos de `PacienteRequest` (en caracteres, como `@Size` de Java). */
export const MAX = {
  nombre: 100,
  apellido: 100,
  sexo: 20,
  email: 254,
  direccion: 255,
  obraSocialTexto: 150,
} as const;

const maxMsg = (max: number): string => `Máximo ${max} caracteres.`;

/** Mismos separadores que `Dni.sinSeparadores` del backend. */
export function normalizarDni(raw: string): string {
  return raw.replace(/[.\s-]/g, '');
}

/** Mismos separadores que `TelefonoE164` del backend; vacío → `null`. No valida: ver `validarPaciente`. */
export function normalizarTelefono(raw: string): string | null {
  if (raw.trim() === '') return null;
  return raw.replace(/[\s.()-]/g, '');
}

function fechaValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function opcional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** `hoy` es la fecha de hoy en la zona del consultorio (`hoyEnZona`), en `YYYY-MM-DD`. */
export function validarPaciente(valores: ValoresPaciente, hoy: string): Resultado {
  const errors: Partial<Record<CampoPaciente, string>> = {};

  const nombre = valores.nombre.trim();
  if (nombre === '') errors.nombre = MSG_REQUIRED;
  else if (nombre.length > MAX.nombre) errors.nombre = maxMsg(MAX.nombre);

  const apellido = valores.apellido.trim();
  if (apellido === '') errors.apellido = MSG_REQUIRED;
  else if (apellido.length > MAX.apellido) errors.apellido = maxMsg(MAX.apellido);

  const dni = normalizarDni(valores.dni);
  if (dni === '') errors.dni = MSG_REQUIRED;
  else if (!/^[0-9]{7,8}$/.test(dni)) errors.dni = MSG_DNI;

  const fechaNacimiento = opcional(valores.fechaNacimiento);
  if (fechaNacimiento !== null) {
    if (!fechaValida(fechaNacimiento)) errors.fechaNacimiento = MSG_FECHA;
    else if (fechaNacimiento > hoy) errors.fechaNacimiento = MSG_FECHA_FUTURA;
  }

  const telefono = normalizarTelefono(valores.telefono);
  if (telefono !== null && !/^\+[1-9][0-9]{7,14}$/.test(telefono)) errors.telefono = MSG_TELEFONO;

  const email = opcional(valores.email);
  if (email !== null) {
    if (email.length > MAX.email) errors.email = maxMsg(MAX.email);
    else if (!/^[^\s@]+@[^\s@]+$/.test(email)) errors.email = MSG_EMAIL;
  }

  const sexo = opcional(valores.sexo);
  if (sexo !== null && sexo.length > MAX.sexo) errors.sexo = maxMsg(MAX.sexo);
  const direccion = opcional(valores.direccion);
  if (direccion !== null && direccion.length > MAX.direccion) errors.direccion = maxMsg(MAX.direccion);
  const obraSocialTexto = opcional(valores.obraSocialTexto);
  if (obraSocialTexto !== null && obraSocialTexto.length > MAX.obraSocialTexto) {
    errors.obraSocialTexto = maxMsg(MAX.obraSocialTexto);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { nombre, apellido, dni, fechaNacimiento, sexo, telefono, email, direccion, obraSocialTexto },
  };
}
