/**
 * Clasificación de los errores de recordatorio (design D4 de C-14). Función pura: decide solo por `kind`, `status`
 * y los nombres de campo de `fieldErrors` (nunca por `title`/`detail`).
 */
import { ApiError } from '../../../api/errors';
import type { CanalRecordatorio } from '../../../api/types';

export type RechazoRecordatorio =
  | 'sinTelefono'
  | 'sinEmail'
  | 'noRecordable'
  | 'noExiste'
  | 'smtpFallo'
  | 'smtpNoDisponible'
  | 'emailIncierto'
  | 'whatsappIncierto'
  | 'prohibido'
  | 'conexion'
  | 'desconocido';

function clasificar422(error: ApiError): RechazoRecordatorio {
  const campos = error.fieldErrors.map((f) => f.campo);
  if (campos.includes('telefono')) return 'sinTelefono';
  if (campos.includes('email')) return 'sinEmail';
  return 'desconocido';
}

/**
 * El pedido de email pudo haber llegado al servidor y salir: `500`, timeout, red o una respuesta ilegible. Los
 * decoders lanzan `unexpected` SIN status (el cliente HTTP no lo completa): se trata como incierto; con un status
 * de error (4xx/5xx distintos) no. Un id inválido es un `Error` de programación (no `ApiError`) y no llega acá.
 */
function esIncierto(error: ApiError): boolean {
  if (error.kind === 'timeout' || error.kind === 'network') return true;
  if (error.status === 500) return true;
  if (error.kind !== 'unexpected') return false;
  return error.status === null || (error.status >= 200 && error.status < 300);
}

export function clasificarErrorRecordatorio(error: unknown, canal: CanalRecordatorio): RechazoRecordatorio {
  if (!(error instanceof ApiError)) return 'desconocido';
  if (error.status === 422) return clasificar422(error);
  if (error.status === 403) return 'prohibido';
  if (error.status === 409) return 'noRecordable';
  if (error.status === 404) return 'noExiste';
  if (canal === 'EMAIL') {
    if (error.status === 502) return 'smtpFallo';
    if (error.status === 503) return 'smtpNoDisponible';
    return esIncierto(error) ? 'emailIncierto' : 'desconocido';
  }
  if (error.kind === 'timeout') return 'whatsappIncierto';
  if (error.kind === 'network') return 'conexion';
  return 'desconocido';
}
