import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from './__fixtures__/auth';
import { PACIENTE_ANA, PACIENTE_MINIMO, PAGINA_PACIENTES } from './__fixtures__/pacientes';
import { ApiError } from './errors';
import { createHttpClient } from './http';
import { createPacientesApi } from './pacientes';

function setup(response: Response) {
  const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(response.clone()));
  const http = createHttpClient({ baseUrl: 'http://api.test/api', fetchFn, getToken: () => 't1', onUnauthorized: () => undefined });
  return { api: createPacientesApi(http), fetchFn };
}

function call(fetchFn: ReturnType<typeof vi.fn<typeof fetch>>) {
  const c = fetchFn.mock.calls[0];
  if (c === undefined) throw new Error('sin llamada');
  return { url: String(c[0]), method: c[1]?.method, headers: new Headers(c[1]?.headers) };
}

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.kind : 'otro';
  }
}

describe('pacientes.buscar', () => {
  it('q codificado, page y size, con el token', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, PAGINA_PACIENTES));
    expect(await api.buscar({ q: 'pér', page: 0, size: 10 })).toEqual(PAGINA_PACIENTES);
    const c = call(fetchFn);
    expect(c.method).toBe('GET');
    expect(c.url).toBe('http://api.test/api/pacientes?q=p%C3%A9r&page=0&size=10');
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
  });

  it('sin q no envía el parámetro (ni ningún otro)', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, PAGINA_PACIENTES));
    await api.buscar({});
    expect(call(fetchFn).url).toBe('http://api.test/api/pacientes');
  });

  it('incluirInactivos=true solo cuando se pide; q con espacios y & queda codificado', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, PAGINA_PACIENTES));
    await api.buscar({ q: 'a b&c', page: 2, incluirInactivos: true });
    const params = new URL(call(fetchFn).url).searchParams;
    expect(params.get('q')).toBe('a b&c');
    expect(params.get('page')).toBe('2');
    expect(params.get('incluirInactivos')).toBe('true');
    expect(params.has('size')).toBe(false);
  });

  it('página mal formada → unexpected', async () => {
    const { api } = setup(jsonResponse(200, { contenido: 'x', pagina: 0, tamanio: 10, totalElementos: 0, totalPaginas: 0 }));
    expect(await kindOf(api.buscar({}))).toBe('unexpected');
  });

  it('página sin totalPaginas → unexpected', async () => {
    const { contenido, pagina, tamanio, totalElementos } = PAGINA_PACIENTES;
    const { api } = setup(jsonResponse(200, { contenido, pagina, tamanio, totalElementos }));
    expect(await kindOf(api.buscar({}))).toBe('unexpected');
  });

  it('un paciente sin apellido dentro de la página → unexpected', async () => {
    const sinApellido = { ...PACIENTE_ANA, apellido: undefined };
    const { api } = setup(jsonResponse(200, { ...PAGINA_PACIENTES, contenido: [sinApellido] }));
    expect(await kindOf(api.buscar({}))).toBe('unexpected');
  });
});

describe('pacientes.obtener', () => {
  it('GET /pacientes/{id}', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, PACIENTE_ANA));
    expect(await api.obtener(5)).toEqual(PACIENTE_ANA);
    expect(call(fetchFn)).toMatchObject({ method: 'GET', url: 'http://api.test/api/pacientes/5' });
  });

  it('acepta los campos opcionales en null', async () => {
    const { api } = setup(jsonResponse(200, PACIENTE_MINIMO));
    expect(await api.obtener(6)).toEqual(PACIENTE_MINIMO);
  });

  it('paciente sin apellido → unexpected', async () => {
    const sinApellido = { ...PACIENTE_ANA, apellido: undefined };
    const { api } = setup(jsonResponse(200, sinApellido));
    expect(await kindOf(api.obtener(5))).toBe('unexpected');
  });

  it('paciente sin dni → unexpected', async () => {
    const sinDni = { ...PACIENTE_ANA, dni: undefined };
    const { api } = setup(jsonResponse(200, sinDni));
    expect(await kindOf(api.obtener(5))).toBe('unexpected');
  });

  it.each([0, -4, 2.5])('id %s inválido: error de programación sin request', async (id) => {
    const { api, fetchFn } = setup(jsonResponse(200, PACIENTE_ANA));
    await expect(api.obtener(id)).rejects.toThrow('Error de programación');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
