import { ApiError, toApiError } from './errors';

/** Cliente HTTP único hacia la API (design D1). */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Valida un JSON desconocido y lo devuelve tipado; lanza `ApiError('unexpected')` si no coincide. */
export type Decoder<T> = (value: unknown) => T;

export interface RequestOptions<T> {
  decode: Decoder<T>;
  body?: unknown;
  /** Si es `true` (por defecto) envía el token de la sesión y un 401 cierra la sesión. */
  auth?: boolean;
  /** Política de caché del navegador; solo se copia al `RequestInit` si viene definida (C-14, D1). */
  cache?: RequestCache;
}

export interface HttpClient {
  request<T>(method: HttpMethod, path: string, options: RequestOptions<T>): Promise<T>;
}

export interface HttpClientConfig {
  baseUrl: string;
  fetchFn: typeof fetch;
  getToken: () => string | null;
  onUnauthorized: () => void;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

/** Decodificador para respuestas sin cuerpo (204). */
export const expectNoContent: Decoder<void> = (value) => {
  if (value !== undefined) {
    throw new ApiError('unexpected');
  }
};

function assertRelativePath(path: string): void {
  // Solo rutas relativas a la API: el token nunca sale hacia otro origen.
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    throw new Error('Error de programación: la ruta debe ser relativa a la API y empezar con "/"');
  }
}

async function readJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await response.text();
  if (text === '') {
    return { ok: true, value: undefined };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(method: HttpMethod, path: string, options: RequestOptions<T>): Promise<T> {
    assertRelativePath(path);
    const auth = options.auth ?? true;

    const headers = new Headers({ Accept: 'application/json' });
    const token = auth ? config.getToken() : null;
    if (token !== null) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const init: RequestInit = { method, headers, credentials: 'omit' };
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(options.body);
    }

    if (options.cache !== undefined) {
      init.cache = options.cache;
    }

    const controller = new AbortController();
    init.signal = controller.signal;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let response: Response;
    let parsed: { ok: true; value: unknown } | { ok: false };
    try {
      response = await config.fetchFn(config.baseUrl + path, init);
      parsed = await readJson(response);
    } catch {
      throw new ApiError(timedOut ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const error = toApiError(response.status, response.headers, parsed.ok ? parsed.value : undefined);
      if (error.kind === 'unauthorized' && token !== null) {
        config.onUnauthorized();
      }
      throw error;
    }
    if (!parsed.ok) {
      throw new ApiError('unexpected', { status: response.status });
    }
    try {
      return options.decode(parsed.value);
    } catch (e) {
      throw e instanceof ApiError ? e : new ApiError('unexpected', { status: response.status });
    }
  }

  return { request };
}
