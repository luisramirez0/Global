/** Errores tipados de la API (design D1). El mensaje es fijo por tipo: nunca el detail del servidor ni datos del cliente. */
import { esInstanteIso } from './instante';
import type { ConflictoTurno } from './types';

export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'timeout'
  | 'unexpected';

export interface FieldError {
  readonly campo: string;
  readonly mensaje: string;
}

const MESSAGES: Readonly<Record<ApiErrorKind, string>> = {
  validation: 'Hay datos inválidos.',
  unauthorized: 'No autorizado.',
  forbidden: 'No tenés permiso para realizar esta acción.',
  conflict: 'La operación entra en conflicto con datos existentes.',
  rate_limited: 'Demasiados intentos.',
  server: 'Error del servidor.',
  network: 'No se pudo conectar con el servidor.',
  timeout: 'El servidor tardó demasiado en responder.',
  unexpected: 'Respuesta inesperada del servidor.',
};

export interface ApiErrorDetails {
  status?: number | null;
  title?: string | null;
  fieldErrors?: readonly FieldError[];
  retryAfterSeconds?: number | null;
  /** Detalle de un 409 de turno (C-13, D2). */
  conflicto?: ConflictoTurno | null;
  /** Id del bloqueo de un 422 de turno (C-13, D2). */
  bloqueoId?: number | null;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** Título del ProblemDetail (genérico, sin PII); solo para depurar. */
  readonly title: string | null;
  readonly fieldErrors: readonly FieldError[];
  readonly retryAfterSeconds: number | null;
  /** Solo ids e instantes del turno que choca; `null` si el 409 no lo trae o viene mal formado. */
  readonly conflicto: ConflictoTurno | null;
  /** Bloqueo que causó un 422; `null` si no viene o es inválido. */
  readonly bloqueoId: number | null;

  constructor(kind: ApiErrorKind, details: ApiErrorDetails = {}) {
    super(MESSAGES[kind]);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = details.status ?? null;
    this.title = details.title ?? null;
    this.fieldErrors = details.fieldErrors ?? [];
    this.retryAfterSeconds = details.retryAfterSeconds ?? null;
    this.conflicto = details.conflicto ?? null;
    this.bloqueoId = details.bloqueoId ?? null;
  }
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status >= 500 && status <= 599) return 'server';
  return 'unexpected';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFieldErrors(body: unknown): FieldError[] {
  if (!isRecord(body) || !Array.isArray(body['errores'])) {
    return [];
  }
  const result: FieldError[] = [];
  for (const item of body['errores'] as unknown[]) {
    if (isRecord(item) && typeof item['campo'] === 'string' && typeof item['mensaje'] === 'string') {
      result.push({ campo: item['campo'], mensaje: item['mensaje'] });
    }
  }
  return result;
}

function entero(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Decodificador tolerante: cualquier desvío da `null` sin afectar el `kind` (C-13, D2). */
function parseConflicto(body: unknown): ConflictoTurno | null {
  if (!isRecord(body) || !isRecord(body['conflicto'])) return null;
  const c = body['conflicto'];
  const turnoId = entero(c['turnoId']);
  const sillonId = entero(c['sillonId']);
  const profesionalId = entero(c['profesionalId']);
  const motivo = c['motivo'];
  const inicio = c['inicio'];
  const fin = c['fin'];
  if (turnoId === null || sillonId === null || profesionalId === null) return null;
  if (motivo !== 'SILLON' && motivo !== 'PROFESIONAL') return null;
  if (!esInstanteIso(inicio) || !esInstanteIso(fin)) return null;
  return { turnoId, inicio, fin, sillonId, profesionalId, motivo };
}

function parseRetryAfter(headers: Headers): number | null {
  const raw = headers.get('Retry-After');
  if (raw === null || !/^\d+$/.test(raw.trim())) {
    return null;
  }
  return Number(raw.trim());
}

/** Convierte una respuesta no exitosa en un ApiError. `body` es el JSON ya parseado o `undefined`. */
export function toApiError(status: number, headers: Headers, body: unknown): ApiError {
  const kind = kindForStatus(status);
  return new ApiError(kind, {
    status,
    title: isRecord(body) && typeof body['title'] === 'string' ? body['title'] : null,
    fieldErrors: kind === 'validation' ? parseFieldErrors(body) : [],
    retryAfterSeconds: kind === 'rate_limited' ? parseRetryAfter(headers) : null,
    conflicto: status === 409 ? parseConflicto(body) : null,
    bloqueoId: status === 422 && isRecord(body) ? entero(body['bloqueoId']) : null,
  });
}
