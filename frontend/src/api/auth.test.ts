import { describe, expect, it, vi } from 'vitest';
import { LOGIN_OK, ME_OK, REGISTRO_OK, jsonResponse } from './__fixtures__/auth';
import { createAuthApi } from './auth';
import { ApiError } from './errors';
import { createHttpClient } from './http';

function setup(response: Response) {
  const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(response);
  const http = createHttpClient({
    baseUrl: 'http://api.test/api',
    fetchFn,
    getToken: () => 't1',
    onUnauthorized: () => undefined,
  });
  return { api: createAuthApi(http), fetchFn };
}

function call(fetchFn: ReturnType<typeof vi.fn<typeof fetch>>) {
  const c = fetchFn.mock.calls[0];
  if (c === undefined) throw new Error('sin llamada');
  const init = c[1] ?? {};
  const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
  return { url: c[0], method: init.method, headers: new Headers(init.headers), body };
}

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.kind : 'otro';
  }
}

const REGISTRO = {
  consultorioNombre: 'Consultorio Sonrisas',
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@consultorio.test',
  password: 'Segura123!',
  matricula: 'MN 1234',
};

describe('register', () => {
  it('POST /auth/register sin token y devuelve los ids', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, REGISTRO_OK));
    await expect(api.register(REGISTRO)).resolves.toEqual(REGISTRO_OK);
    const c = call(fetchFn);
    expect(c.url).toBe('http://api.test/api/auth/register');
    expect(c.method).toBe('POST');
    expect(c.headers.has('Authorization')).toBe(false);
    expect(c.body).toEqual(REGISTRO);
  });

  it('omite la matrícula vacía', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, REGISTRO_OK));
    await api.register({ ...REGISTRO, matricula: '' });
    expect(call(fetchFn).body).not.toHaveProperty('matricula');
  });

  it('respuesta sin ids falla con unexpected', async () => {
    const { api } = setup(jsonResponse(201, { consultorioId: 2 }));
    expect(await kindOf(api.register(REGISTRO))).toBe('unexpected');
  });
});

describe('login', () => {
  it('POST /auth/login sin token y decodifica la respuesta', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, LOGIN_OK));
    await expect(api.login({ email: 'ana@consultorio.test', password: 'Segura123!' })).resolves.toEqual(LOGIN_OK);
    const c = call(fetchFn);
    expect(c.url).toBe('http://api.test/api/auth/login');
    expect(c.headers.has('Authorization')).toBe(false);
    expect(c.body).toEqual({ email: 'ana@consultorio.test', password: 'Segura123!' });
  });

  it.each([
    ['sin accessToken', { ...LOGIN_OK, accessToken: undefined }],
    ['accessToken vacío', { ...LOGIN_OK, accessToken: '' }],
    ['tokenType distinto de Bearer', { ...LOGIN_OK, tokenType: 'Basic' }],
    ['expiresIn no positivo', { ...LOGIN_OK, expiresIn: 0 }],
    ['usuario ausente', { ...LOGIN_OK, usuario: null }],
  ])('%s falla con unexpected', async (_n, body) => {
    const { api } = setup(jsonResponse(200, body));
    expect(await kindOf(api.login({ email: 'a@b.c', password: 'x' }))).toBe('unexpected');
  });
});

describe('me', () => {
  it('GET /auth/me con token', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, ME_OK));
    await expect(api.me()).resolves.toEqual(ME_OK);
    const c = call(fetchFn);
    expect(c.url).toBe('http://api.test/api/auth/me');
    expect(c.method).toBe('GET');
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
  });

  it.each(['RECEPCION', 'PROFESIONAL', 'ADMIN'])('acepta el rol %s', async (rol) => {
    const { api } = setup(jsonResponse(200, { ...ME_OK, usuario: { ...ME_OK.usuario, rol } }));
    expect(await kindOf(api.me())).toBe('ok');
  });

  it('rol desconocido falla con unexpected', async () => {
    const { api } = setup(jsonResponse(200, { ...ME_OK, usuario: { ...ME_OK.usuario, rol: 'SUPERADMIN' } }));
    expect(await kindOf(api.me())).toBe('unexpected');
  });

  it('consultorio sin nombre falla con unexpected', async () => {
    const { api } = setup(jsonResponse(200, { ...ME_OK, consultorio: { id: 2 } }));
    expect(await kindOf(api.me())).toBe('unexpected');
  });
});
