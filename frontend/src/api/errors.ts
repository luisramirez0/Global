/** Errores tipados de la API (design D1). El mensaje es fijo por tipo: nunca el detail del servidor ni datos del cliente. */

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
  codigo?: string | null;
  pacienteId?: number | null;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** Título del ProblemDetail (genérico, sin PII); solo para depurar. */
  readonly title: string | null;
  readonly fieldErrors: readonly FieldError[];
  readonly retryAfterSeconds: number | null;
  /**
   * Código de negocio del ProblemDetail (p. ej. `FICHA_DESACTUALIZADA`), solo si tiene la forma esperada. La UI lo
   * traduce a un mensaje fijo propio; nunca se muestra crudo (C-12, D3).
   */
  readonly codigo: string | null;
  /** Paciente existente informado por el 409 de DNI duplicado (C-05); `null` en cualquier otro caso. */
  readonly pacienteId: number | null;

  constructor(kind: ApiErrorKind, details: ApiErrorDetails = {}) {
    super(MESSAGES[kind]);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = details.status ?? null;
    this.title = details.title ?? null;
    this.fieldErrors = details.fieldErrors ?? [];
    this.retryAfterSeconds = details.retryAfterSeconds ?? null;
    this.codigo = details.codigo ?? null;
    this.pacienteId = details.pacienteId ?? null;
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

function parseRetryAfter(headers: Headers): number | null {
  const raw = headers.get('Retry-After');
  if (raw === null || !/^\d+$/.test(raw.trim())) {
    return null;
  }
  return Number(raw.trim());
}

/** Mayúsculas y guion bajo, empieza con letra, 1 a 40 caracteres: lo que emite el backend (C-08). */
const CODIGO = /^[A-Z][A-Z_]{0,39}$/;

function parseCodigo(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const codigo = body['codigo'];
  return typeof codigo === 'string' && CODIGO.test(codigo) ? codigo : null;
}

function parsePacienteId(status: number, body: unknown): number | null {
  if (status !== 409 || !isRecord(body)) return null;
  const pacienteId = body['pacienteId'];
  return typeof pacienteId === 'number' && Number.isSafeInteger(pacienteId) && pacienteId > 0 ? pacienteId : null;
}

/** Convierte una respuesta no exitosa en un ApiError. `body` es el JSON ya parseado o `undefined`. */
export function toApiError(status: number, headers: Headers, body: unknown): ApiError {
  const kind = kindForStatus(status);
  return new ApiError(kind, {
    status,
    title: isRecord(body) && typeof body['title'] === 'string' ? body['title'] : null,
    fieldErrors: kind === 'validation' ? parseFieldErrors(body) : [],
    retryAfterSeconds: kind === 'rate_limited' ? parseRetryAfter(headers) : null,
    codigo: parseCodigo(body),
    pacienteId: parsePacienteId(status, body),
  });
}
