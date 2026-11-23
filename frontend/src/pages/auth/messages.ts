import { ApiError, type ApiErrorKind } from '../../api/errors';

/** Mensajes fijos por tipo de error (design D6): nunca repiten datos del usuario ni el detail del servidor. */

export const MSG_CONNECTION = 'No se pudo conectar con el servidor.';
export const MSG_GENERIC = 'Ocurrió un error. Intentá de nuevo.';
export const MSG_CHECK_FIELDS = 'Revisá los datos ingresados.';

export function rateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) {
    return 'Demasiados intentos. Probá de nuevo más tarde.';
  }
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Demasiados intentos. Probá de nuevo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`;
}

export function messageForError(error: unknown, overrides: Partial<Record<ApiErrorKind, string>> = {}): string {
  if (!(error instanceof ApiError)) {
    return MSG_GENERIC;
  }
  const override = overrides[error.kind];
  if (override !== undefined) return override;
  switch (error.kind) {
    case 'network':
    case 'timeout':
      return MSG_CONNECTION;
    case 'rate_limited':
      return rateLimitMessage(error.retryAfterSeconds);
    case 'validation':
      return MSG_CHECK_FIELDS;
    case 'unauthorized':
    case 'forbidden':
    case 'conflict':
    case 'server':
    case 'unexpected':
      return MSG_GENERIC;
    default: {
      const exhaustive: never = error.kind;
      return exhaustive;
    }
  }
}

/** Errores por campo de un 400 del servidor, indexados por nombre de campo. */
export function serverFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (error instanceof ApiError && error.kind === 'validation') {
    for (const { campo, mensaje } of error.fieldErrors) {
      result[campo] ??= mensaje;
    }
  }
  return result;
}
