import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, problemResponse } from './__fixtures__/auth';
import { ApiError } from './errors';
import { createHttpClient, expectNoContent, type HttpClientConfig } from './http';

const BASE = 'http://localhost:8080/api';

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function setup(overrides: Partial<HttpClientConfig> = {}, token: string | null = 't1') {
  const fetchFn: FetchMock = vi.fn<typeof fetch>();
  const onUnauthorized = vi.fn<() => void>();
  const client = createHttpClient({
    baseUrl: BASE,
    fetchFn,
    getToken: () => token,
    onUnauthorized,
    ...overrides,
  });
  return { client, fetchFn, onUnauthorized };
}

function lastInit(fetchFn: FetchMock): RequestInit {
  const call = fetchFn.mock.calls.at(-1);
  if (call === undefined) throw new Error('fetch no fue invocado');
  return call[1] ?? {};
}

function lastHeaders(fetchFn: FetchMock): Headers {
  return new Headers(lastInit(fetchFn).headers);
}

const decodeAny = (u: unknown): unknown => u;

async function catchApiError(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('se esperaba un ApiError');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('URL', () => {
  it('concatena la base con la ruta relativa', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(jsonResponse(200, {}));
    await client.request('GET', '/auth/me', { decode: decodeAny });
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://localhost:8080/api/auth/me');
  });

  it.each(['https://evil.example/robar', '//evil.example/robar', 'auth/me', '/\\evil.example'])(
    'rechaza la ruta %j sin invocar fetch',
    async (path) => {
      const { client, fetchFn } = setup();
      await expect(client.request('GET', path, { decode: decodeAny })).rejects.toThrowError(/ruta/);
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );
});

describe('encabezados', () => {
  it('request autenticada: Bearer y Accept, sin Content-Type ni cookies', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(jsonResponse(200, {}));
    await client.request('GET', '/auth/me', { decode: decodeAny });
    const headers = lastHeaders(fetchFn);
    expect(headers.get('Authorization')).toBe('Bearer t1');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.has('Content-Type')).toBe(false);
    expect(lastInit(fetchFn).credentials).toBe('omit');
    expect(lastInit(fetchFn).method).toBe('GET');
  });

  it('request no autenticada con cuerpo: Content-Type JSON y sin Authorization', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(jsonResponse(200, {}));
    await client.request('POST', '/auth/login', { auth: false, body: { email: 'a@b.c' }, decode: decodeAny });
    const headers = lastHeaders(fetchFn);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(lastInit(fetchFn).body).toBe(JSON.stringify({ email: 'a@b.c' }));
  });

  it('sin sesión no envía Authorization', async () => {
    const { client, fetchFn } = setup({}, null);
    fetchFn.mockResolvedValue(jsonResponse(200, {}));
    await client.request('GET', '/auth/me', { decode: decodeAny });
    expect(lastHeaders(fetchFn).has('Authorization')).toBe(false);
  });
});

describe('respuestas exitosas', () => {
  it('entrega el JSON decodificado', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(jsonResponse(200, { n: 1 }));
    const result = await client.request('GET', '/x', {
      decode: (u) => {
        if (typeof u === 'object' && u !== null && 'n' in u && typeof u.n === 'number') return u.n;
        throw new ApiError('unexpected');
      },
    });
    expect(result).toBe(1);
  });

  it('204 se resuelve sin valor', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(client.request('DELETE', '/x', { decode: expectNoContent })).resolves.toBeUndefined();
  });

  it('JSON que no coincide con el decodificador falla con unexpected', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(jsonResponse(200, { otro: true }));
    const err = await catchApiError(
      client.request('GET', '/x', {
        decode: () => {
          throw new ApiError('unexpected');
        },
      }),
    );
    expect(err.kind).toBe('unexpected');
  });

  it('cuerpo 2xx que no es JSON falla con unexpected', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(new Response('<html>', { status: 200 }));
    expect((await catchApiError(client.request('GET', '/x', { decode: decodeAny }))).kind).toBe('unexpected');
  });

  it('un decodificador que lanza otro error se convierte en unexpected', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(jsonResponse(200, {}));
    const err = await catchApiError(
      client.request('GET', '/x', {
        decode: () => {
          throw new TypeError('x');
        },
      }),
    );
    expect(err.kind).toBe('unexpected');
  });
});

describe('errores', () => {
  it('400 con errores por campo', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(problemResponse(400, { errores: [{ campo: 'email', mensaje: 'formato inválido' }] }));
    const err = await catchApiError(client.request('POST', '/x', { auth: false, body: {}, decode: decodeAny }));
    expect(err.kind).toBe('validation');
    expect(err.fieldErrors.map((f) => f.campo)).toEqual(['email']);
  });

  it('429 con Retry-After', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(problemResponse(429, {}, { 'Retry-After': '840' }));
    const err = await catchApiError(client.request('POST', '/auth/login', { auth: false, body: {}, decode: decodeAny }));
    expect(err.kind).toBe('rate_limited');
    expect(err.retryAfterSeconds).toBe(840);
  });

  it('409 con codigo de negocio llega al ApiError (C-12)', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(problemResponse(409, { codigo: 'FICHA_DESACTUALIZADA', detail: 'texto clínico' }));
    const err = await catchApiError(client.request('PUT', '/pacientes/1/ficha', { body: {}, decode: decodeAny }));
    expect(err.kind).toBe('conflict');
    expect(err.codigo).toBe('FICHA_DESACTUALIZADA');
    expect(err.pacienteId).toBeNull();
    expect(err.message).not.toContain('clínico');
  });

  it('409 de DNI duplicado con pacienteId llega al ApiError (C-12)', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(problemResponse(409, { pacienteId: 7 }));
    const err = await catchApiError(client.request('POST', '/pacientes', { body: {}, decode: decodeAny }));
    expect(err.pacienteId).toBe(7);
    expect(err.codigo).toBeNull();
  });

  it('500 con cuerpo HTML no propaga el cuerpo', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(new Response('<h1>Error ana@consultorio.test</h1>', { status: 500 }));
    const err = await catchApiError(client.request('GET', '/x', { decode: decodeAny }));
    expect(err.kind).toBe('server');
    expect(err.message).not.toContain('ana@');
  });

  it('red caída produce network', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await catchApiError(client.request('GET', '/x', { decode: decodeAny }))).kind).toBe('network');
  });

  it('aborta y produce timeout al superar el tiempo de espera', async () => {
    vi.useFakeTimers();
    const { client, fetchFn } = setup({ timeoutMs: 15000 });
    let signal: AbortSignal | undefined;
    fetchFn.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const pending = catchApiError(client.request('GET', '/x', { decode: decodeAny }));
    await vi.advanceTimersByTimeAsync(14999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const err = await pending;
    expect(err.kind).toBe('timeout');
    expect(signal?.aborted).toBe(true);
  });
});

describe('401', () => {
  it('en request autenticada notifica el cierre de sesión una vez', async () => {
    const { client, fetchFn, onUnauthorized } = setup();
    fetchFn.mockResolvedValue(problemResponse(401));
    const err = await catchApiError(client.request('GET', '/auth/me', { decode: decodeAny }));
    expect(err.kind).toBe('unauthorized');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('en request no autenticada (login) no cierra la sesión', async () => {
    const { client, fetchFn, onUnauthorized } = setup();
    fetchFn.mockResolvedValue(problemResponse(401));
    const err = await catchApiError(client.request('POST', '/auth/login', { auth: false, body: {}, decode: decodeAny }));
    expect(err.kind).toBe('unauthorized');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('403 no cierra la sesión', async () => {
    const { client, fetchFn, onUnauthorized } = setup();
    fetchFn.mockResolvedValue(problemResponse(403));
    expect((await catchApiError(client.request('GET', '/x', { decode: decodeAny }))).kind).toBe('forbidden');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('opción cache (C-14)', () => {
  it('con cache "no-store" el RequestInit la incluye', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(jsonResponse(200, {}));
    await client.request('GET', '/x', { decode: decodeAny, cache: 'no-store' });
    expect(lastInit(fetchFn).cache).toBe('no-store');
  });

  it('con otro valor (reload) también se copia', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(jsonResponse(200, {}));
    await client.request('POST', '/x', { decode: decodeAny, cache: 'reload' });
    expect(lastInit(fetchFn).cache).toBe('reload');
  });

  it('sin la opción el RequestInit no tiene la clave cache', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockResolvedValue(jsonResponse(200, {}));
    await client.request('GET', '/x', { decode: decodeAny });
    expect(Object.keys(lastInit(fetchFn))).not.toContain('cache');
  });
});
