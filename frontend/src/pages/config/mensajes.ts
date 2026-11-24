/** Mensajes fijos de la configuración (design D6 de C-11): nunca el title/detail del servidor ni datos del usuario. */
import { ApiError } from '../../api/errors';
import { messageForError } from '../auth/messages';

export const MSG_LIMITE_SILLONES = 'Ya hay 2 sillones activos, que es el máximo. Dá de baja uno antes.';
export const MSG_ULTIMO_SILLON = 'Debe quedar al menos un sillón activo.';
export const MSG_FRANJA_SUPERPUESTA = 'La franja se superpone con otra del mismo día.';
export const MSG_PROFESIONAL =
  'No se pudo asignar el profesional de la franja: el consultorio debe tener un único profesional activo.';
export const MSG_REFERENCIA = 'Alguno de los datos elegidos ya no es válido. Actualizá la página.';
export const MSG_NO_EXISTE = 'El registro ya no existe. Se actualizó la lista.';
export const MSG_SIN_PERMISO = 'No tenés permiso para realizar esta acción.';
export const MSG_SOLO_LECTURA = 'Tu rol puede consultar esta sección, pero no modificarla.';

/** Mensajes según dónde ocurrió el error (p. ej. un 409 significa cosas distintas en alta y en baja). */
export interface ContextoError {
  conflict?: string;
  unprocessable?: string;
}

export function mensajeDeError(error: unknown, contexto: ContextoError = {}): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return MSG_NO_EXISTE;
    if (error.status === 422) return contexto.unprocessable ?? MSG_REFERENCIA;
    if (error.kind === 'forbidden') return MSG_SIN_PERMISO;
    if (error.kind === 'conflict' && contexto.conflict !== undefined) return contexto.conflict;
  }
  return messageForError(error);
}

export function esNoEncontrado(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
