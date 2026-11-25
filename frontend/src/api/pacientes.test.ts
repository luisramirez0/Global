import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, problemResponse } from './__fixtures__/auth';
import { PACIENTE_ANA, PACIENTE_INACTIVO, PACIENTE_LUIS, pagina } from './__fixtures__/pacientes';
import { ApiError } from './errors';
import { createHttpClient } from './http';
import { createPacientesApi } from './pacientes';
import type { PacienteRequest } from './types';

function setup(response: Response | (() => Response)) {
  const fetchFn = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(typeof response === 'function' ? response() : response));
  const http = createHttpClient({ baseUrl: 'http://api.test/api', fetchFn, getToken: () => 't1', onUnauthorized: () => undefined });
  return { api: createPacientesApi(http), fetchFn };
}

function call(fetchFn: ReturnType<typeof vi.fn<typeof fetch>>, index = 0) {
  const c = fetchFn.mock.calls[index];
  if (c === undefined) throw new Error('sin llamada');
  const init = c[1] ?? {};
  const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
  return { url: String(c[0]), method: init.method, headers: new Headers(init.headers), body };
}

async function errorOf(p: Promise<unknown>): Promise<ApiError | string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e : 'otro';
  }
}

const noContent = (): Response => new Response(null, { status: 204 });

const REQUEST: PacienteRequest = {
  nombre: 'Ana',
  apellido: 'Pérez',
  dni: '30111222',
  fechaNacimiento: '1985-04-12',
  sexo: 'F',
  telefono: '+5491123456789',
  email: 'ana.perez@correo.test',
  direccion: null,
  obraSocialTexto: null,
};

describe('buscar', () => {
  it('GET /pacientes autenticado con page y size; sin q ni incluirInactivos si no hacen falta', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, pagina([PACIENTE_ANA, PACIENTE_LUIS])));
    const res = await api.buscar({ q: '', incluirInactivos: false, page: 0, size: 20 });
    expect(res.contenido).toEqual([PACIENTE_ANA, PACIENTE_LUIS]);
    expect(res.totalElementos).toBe(2);
    const c = call(fetchFn);
    expect(c.method).toBe('GET');
    expect(c.url).toBe('http://api.test/api/pacientes?page=0&size=20');
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
  });

  it('codifica q (acentos, espacios, comodines) e incluye incluirInactivos=true', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, pagina([PACIENTE_INACTIVO])));
    await api.buscar({ q: 'pér 50%&x=1', incluirInactivos: true, page: 1, size: 20 });
    const url = new URL(call(fetchFn).url);
    expect(url.pathname).toBe('/api/pacientes');
    expect(url.searchParams.get('q')).toBe('pér 50%&x=1');
    expect(url.searchParams.get('incluirInactivos')).toBe('true');
    expect(url.searchParams.get('page')).toBe('1');
    expect([...url.searchParams.keys()]).toEqual(['q', 'incluirInactivos', 'page', 'size']);
  });

  it('un q de solo espacios no se envía; uno con espacios alrededor se recorta', async () => {
    const { api, fetchFn } = setup(() => jsonResponse(200, pagina([])));
    await api.buscar({ q: '   ', incluirInactivos: false, page: 0, size: 20 });
    await api.buscar({ q: '  ana  ', incluirInactivos: false, page: 0, size: 20 });
    expect(new URL(call(fetchFn, 0).url).searchParams.has('q')).toBe(false);
    expect(new URL(call(fetchFn, 1).url).searchParams.get('q')).toBe('ana');
  });

  it.each([
    [{ page: -1, size: 20 }],
    [{ page: 1.5, size: 20 }],
    [{ page: 0, size: 0 }],
    [{ page: 0, size: 51 }],
  ])('paginación inválida %j es error de programación sin request', async (paginacion) => {
    const { api, fetchFn } = setup(jsonResponse(200, pagina([])));
    await expect(api.buscar({ q: '', incluirInactivos: false, ...paginacion })).rejects.toThrow(/programación/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('obtener, crear y editar', () => {
  it('obtener: GET /pacientes/{id}', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, PACIENTE_ANA));
    expect(await api.obtener(7)).toEqual(PACIENTE_ANA);
    expect(call(fetchFn).url).toBe('http://api.test/api/pacientes/7');
    expect(call(fetchFn).method).toBe('GET');
  });

  it('crear: POST /pacientes con el cuerpo completo', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, PACIENTE_ANA));
    expect(await api.crear(REQUEST)).toEqual(PACIENTE_ANA);
    const c = call(fetchFn);
    expect(c.method).toBe('POST');
    expect(c.url).toBe('http://api.test/api/pacientes');
    expect(c.body).toEqual(REQUEST);
    expect(c.headers.get('Content-Type')).toBe('application/json');
  });

  it('editar: PUT /pacientes/{id} con el cuerpo completo', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, PACIENTE_ANA));
    await api.editar(7, REQUEST);
    const c = call(fetchFn);
    expect(c.method).toBe('PUT');
    expect(c.url).toBe('http://api.test/api/pacientes/7');
    expect(c.body).toEqual(REQUEST);
  });

  it('el 409 de DNI duplicado llega con pacienteId', async () => {
    const { api } = setup(problemResponse(409, { pacienteId: 7 }));
    const err = await errorOf(api.crear(REQUEST));
    expect(err).toBeInstanceOf(ApiError);
    expect(err instanceof ApiError && err.kind).toBe('conflict');
    expect(err instanceof ApiError && err.pacienteId).toBe(7);
  });
});

describe('baja y reactivación', () => {
  it('darDeBaja: DELETE /pacientes/{id} con 204', async () => {
    const { api, fetchFn } = setup(noContent);
    await expect(api.darDeBaja(7)).resolves.toBeUndefined();
    expect(call(fetchFn).method).toBe('DELETE');
    expect(call(fetchFn).url).toBe('http://api.test/api/pacientes/7');
  });

  it('reactivar: POST /pacientes/{id}/reactivar con 204 y sin cuerpo', async () => {
    const { api, fetchFn } = setup(noContent);
    await expect(api.reactivar(9)).resolves.toBeUndefined();
    const c = call(fetchFn);
    expect(c.method).toBe('POST');
    expect(c.url).toBe('http://api.test/api/pacientes/9/reactivar');
    expect(c.body).toBeUndefined();
  });

  it('una baja que responde 200 con cuerpo es unexpected', async () => {
    const { api } = setup(jsonResponse(200, {}));
    const err = await errorOf(api.darDeBaja(7));
    expect(err instanceof ApiError && err.kind).toBe('unexpected');
  });
});

describe('ids inválidos', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('id %s rechaza sin request en todas las operaciones', async (id) => {
    const { api, fetchFn } = setup(jsonResponse(200, PACIENTE_ANA));
    await expect(api.obtener(id)).rejects.toThrow(/programación/);
    await expect(api.editar(id, REQUEST)).rejects.toThrow(/programación/);
    await expect(api.darDeBaja(id)).rejects.toThrow(/programación/);
    await expect(api.reactivar(id)).rejects.toThrow(/programación/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('decodificación', () => {
  const base = { ...PACIENTE_ANA };

  it.each([
    ['sin id', { ...base, id: undefined }],
    ['id 0', { ...base, id: 0 }],
    ['nombre no string', { ...base, nombre: 1 }],
    ['sin apellido', { ...base, apellido: undefined }],
    ['dni null', { ...base, dni: null }],
    ['activo no booleano', { ...base, activo: 'true' }],
    ['sin activo', { ...base, activo: undefined }],
    ['fecha con hora', { ...base, fechaNacimiento: '1985-04-12T00:00:00Z' }],
    ['fecha con otro formato', { ...base, fechaNacimiento: '12/04/1985' }],
    ['fecha inexistente', { ...base, fechaNacimiento: '1985-02-30' }],
    ['telefono número', { ...base, telefono: 5491123456789 }],
    ['email objeto', { ...base, email: {} }],
  ])('paciente con %s → unexpected', async (_caso, body) => {
    const { api } = setup(jsonResponse(200, body));
    const err = await errorOf(api.obtener(7));
    expect(err instanceof ApiError && err.kind).toBe('unexpected');
  });

  it('los opcionales en null o ausentes quedan en null', async () => {
    const { nombre, apellido, dni, id, activo } = PACIENTE_LUIS;
    const { api } = setup(jsonResponse(200, { id, nombre, apellido, dni, activo, telefono: null }));
    expect(await api.obtener(8)).toEqual(PACIENTE_LUIS);
  });

  it('ignora propiedades extra (p. ej. consultorioId) y no las expone', async () => {
    const { api } = setup(jsonResponse(200, { ...PACIENTE_ANA, consultorioId: 99 }));
    const p = await api.obtener(7);
    expect(Object.keys(p)).not.toContain('consultorioId');
  });

  it.each([
    ['contenido no arreglo', { ...pagina([]), contenido: {} }],
    ['un elemento inválido', pagina([{ ...PACIENTE_ANA, activo: 1 }])],
    ['totalPaginas negativo', { ...pagina([]), totalPaginas: -1 }],
    ['totalElementos decimal', { ...pagina([]), totalElementos: 1.5 }],
    ['pagina faltante', { contenido: [], tamanio: 20, totalElementos: 0, totalPaginas: 0 }],
    ['tamanio 0', { ...pagina([]), tamanio: 0 }],
    ['no es objeto', [PACIENTE_ANA]],
  ])('página con %s → unexpected', async (_caso, body) => {
    const { api } = setup(jsonResponse(200, body));
    const err = await errorOf(api.buscar({ q: '', incluirInactivos: false, page: 0, size: 20 }));
    expect(err instanceof ApiError && err.kind).toBe('unexpected');
  });
});
