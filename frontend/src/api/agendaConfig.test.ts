import { describe, expect, it, vi } from 'vitest';
import { BLOQUEO_CONSULTORIO, BLOQUEO_PROFESIONAL, HORARIO_LUNES, PRESTACION_CONTROL, SILLON_1, SILLON_INACTIVO } from './__fixtures__/agendaConfig';
import { jsonResponse } from './__fixtures__/auth';
import { createAgendaConfigApi } from './agendaConfig';
import { ApiError } from './errors';
import { createHttpClient } from './http';

function setup(response: Response | (() => Response)) {
  const fetchFn = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(typeof response === 'function' ? response() : response));
  const http = createHttpClient({ baseUrl: 'http://api.test/api', fetchFn, getToken: () => 't1', onUnauthorized: () => undefined });
  return { api: createAgendaConfigApi(http), fetchFn };
}

function call(fetchFn: ReturnType<typeof vi.fn<typeof fetch>>, index = 0) {
  const c = fetchFn.mock.calls[index];
  if (c === undefined) throw new Error('sin llamada');
  const init = c[1] ?? {};
  const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
  return { url: String(c[0]), method: init.method, headers: new Headers(init.headers), body };
}

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.kind : 'otro';
  }
}

const noContent = (): Response => new Response(null, { status: 204 });

describe('sillones', () => {
  it('listar sin inactivos: GET /sillones autenticado', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, [SILLON_1]));
    expect(await api.listarSillones(false)).toEqual([SILLON_1]);
    const c = call(fetchFn);
    expect(c.method).toBe('GET');
    expect(c.url).toBe('http://api.test/api/sillones');
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
  });

  it('listar con inactivos agrega incluirInactivos=true', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, [SILLON_1, SILLON_INACTIVO]));
    expect(await api.listarSillones(true)).toEqual([SILLON_1, SILLON_INACTIVO]);
    expect(call(fetchFn).url).toBe('http://api.test/api/sillones?incluirInactivos=true');
  });

  it('crear: POST con el cuerpo tal cual', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, SILLON_1));
    expect(await api.crearSillon({ nombre: 'Sillón 1' })).toEqual(SILLON_1);
    expect(call(fetchFn)).toMatchObject({ method: 'POST', url: 'http://api.test/api/sillones', body: { nombre: 'Sillón 1' } });
  });

  it('editar: PUT /sillones/{id}', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, SILLON_1));
    await api.editarSillon(1, { nombre: 'Sillón 1', activo: true });
    expect(call(fetchFn)).toMatchObject({
      method: 'PUT',
      url: 'http://api.test/api/sillones/1',
      body: { nombre: 'Sillón 1', activo: true },
    });
  });

  it('borrar: DELETE con 204 se resuelve sin valor', async () => {
    const { api, fetchFn } = setup(noContent);
    await expect(api.borrarSillon(2)).resolves.toBeUndefined();
    expect(call(fetchFn)).toMatchObject({ method: 'DELETE', url: 'http://api.test/api/sillones/2', body: undefined });
  });

  it('respuesta sin activo → unexpected', async () => {
    const { api } = setup(jsonResponse(200, [{ id: 1, nombre: 'x' }]));
    expect(await kindOf(api.listarSillones(false))).toBe('unexpected');
  });

  it('listado que no es arreglo → unexpected', async () => {
    const { api } = setup(jsonResponse(200, SILLON_1));
    expect(await kindOf(api.listarSillones(false))).toBe('unexpected');
  });
});

describe('prestaciones', () => {
  it('listar con inactivas usa incluirInactivas', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, [PRESTACION_CONTROL]));
    await api.listarPrestaciones(true);
    expect(call(fetchFn).url).toBe('http://api.test/api/prestaciones?incluirInactivas=true');
  });

  it('crear, editar y borrar usan /prestaciones', async () => {
    const { api, fetchFn } = setup(() => jsonResponse(200, PRESTACION_CONTROL));
    await api.crearPrestacion({ nombre: 'Control', duracionMinutos: 15 });
    await api.editarPrestacion(10, { nombre: 'Control', duracionMinutos: 30 });
    expect(call(fetchFn, 0)).toMatchObject({
      method: 'POST',
      url: 'http://api.test/api/prestaciones',
      body: { nombre: 'Control', duracionMinutos: 15 },
    });
    expect(call(fetchFn, 1)).toMatchObject({ method: 'PUT', url: 'http://api.test/api/prestaciones/10' });
    const borrar = setup(noContent);
    await borrar.api.borrarPrestacion(10);
    expect(call(borrar.fetchFn)).toMatchObject({ method: 'DELETE', url: 'http://api.test/api/prestaciones/10' });
  });

  it.each([0, 1.5, '30'])('duración %s → unexpected', async (duracionMinutos) => {
    const { api } = setup(jsonResponse(200, { ...PRESTACION_CONTROL, duracionMinutos }));
    expect(await kindOf(api.crearPrestacion({ nombre: 'x', duracionMinutos: 15 }))).toBe('unexpected');
  });
});

describe('horarios de atención', () => {
  it('listar, crear, editar y borrar usan /horarios-atencion', async () => {
    const listar = setup(jsonResponse(200, [HORARIO_LUNES]));
    expect(await listar.api.listarHorarios()).toEqual([HORARIO_LUNES]);
    expect(call(listar.fetchFn)).toMatchObject({ method: 'GET', url: 'http://api.test/api/horarios-atencion' });

    const crear = setup(jsonResponse(201, HORARIO_LUNES));
    await crear.api.crearHorario({ diaSemana: 1, horaDesde: '09:00', horaHasta: '13:00' });
    expect(call(crear.fetchFn)).toMatchObject({ method: 'POST', body: { diaSemana: 1, horaDesde: '09:00', horaHasta: '13:00' } });

    const editar = setup(jsonResponse(200, HORARIO_LUNES));
    await editar.api.editarHorario(20, { profesionalId: 7, diaSemana: 1, horaDesde: '09:00', horaHasta: '12:00' });
    expect(call(editar.fetchFn)).toMatchObject({ method: 'PUT', url: 'http://api.test/api/horarios-atencion/20' });

    const borrar = setup(noContent);
    await borrar.api.borrarHorario(20);
    expect(call(borrar.fetchFn)).toMatchObject({ method: 'DELETE', url: 'http://api.test/api/horarios-atencion/20' });
  });

  it.each([
    ['día 0', { ...HORARIO_LUNES, diaSemana: 0 }],
    ['día 8', { ...HORARIO_LUNES, diaSemana: 8 }],
    ['hora con segundos', { ...HORARIO_LUNES, horaDesde: '09:00:00' }],
    ['hora 24:00', { ...HORARIO_LUNES, horaHasta: '24:00' }],
    ['sin profesional', { ...HORARIO_LUNES, profesionalId: null }],
  ])('%s → unexpected', async (_caso, body) => {
    expect(await kindOf(setup(jsonResponse(200, [body])).api.listarHorarios())).toBe('unexpected');
  });
});

describe('bloqueos', () => {
  it('listar sin filtro: GET /bloqueos', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, [BLOQUEO_CONSULTORIO, BLOQUEO_PROFESIONAL]));
    expect(await api.listarBloqueos({})).toEqual([BLOQUEO_CONSULTORIO, BLOQUEO_PROFESIONAL]);
    expect(call(fetchFn).url).toBe('http://api.test/api/bloqueos');
  });

  it('listar con desde y hasta los codifica en la query', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, []));
    await api.listarBloqueos({ desde: '2026-11-24T03:00:00Z', hasta: '2026-12-01T03:00:00Z' });
    const url = new URL(call(fetchFn).url);
    expect(url.pathname).toBe('/api/bloqueos');
    expect(url.searchParams.get('desde')).toBe('2026-11-24T03:00:00Z');
    expect(url.searchParams.get('hasta')).toBe('2026-12-01T03:00:00Z');
  });

  it('crear, editar y borrar', async () => {
    const body = {
      sillonId: null,
      profesionalId: null,
      inicio: '2026-12-24T12:00:00Z',
      fin: '2026-12-24T23:00:00Z',
      motivo: 'Nochebuena',
    };
    const crear = setup(jsonResponse(201, BLOQUEO_CONSULTORIO));
    await crear.api.crearBloqueo(body);
    expect(call(crear.fetchFn)).toMatchObject({ method: 'POST', url: 'http://api.test/api/bloqueos', body });
    const editar = setup(jsonResponse(200, BLOQUEO_CONSULTORIO));
    await editar.api.editarBloqueo(30, body);
    expect(call(editar.fetchFn)).toMatchObject({ method: 'PUT', url: 'http://api.test/api/bloqueos/30', body });
    const borrar = setup(noContent);
    await borrar.api.borrarBloqueo(30);
    expect(call(borrar.fetchFn)).toMatchObject({ method: 'DELETE', url: 'http://api.test/api/bloqueos/30' });
  });

  it('motivo y referencias nulos u omitidos se decodifican como null', async () => {
    const { api } = setup(jsonResponse(200, [{ id: 5, inicio: '2026-12-24T12:00:00Z', fin: '2026-12-24T13:00:00.123Z' }]));
    expect(await api.listarBloqueos({})).toEqual([
      { id: 5, sillonId: null, profesionalId: null, inicio: '2026-12-24T12:00:00Z', fin: '2026-12-24T13:00:00.123Z', motivo: null },
    ]);
  });

  it.each([
    ['inicio sin zona', { ...BLOQUEO_CONSULTORIO, inicio: '2026-12-24T12:00:00' }],
    ['inicio no ISO', { ...BLOQUEO_CONSULTORIO, inicio: '24/12/2026' }],
    ['sillonId 0', { ...BLOQUEO_CONSULTORIO, sillonId: 0 }],
    ['motivo numérico', { ...BLOQUEO_CONSULTORIO, motivo: 3 }],
  ])('%s → unexpected', async (_caso, body) => {
    expect(await kindOf(setup(jsonResponse(200, [body])).api.listarBloqueos({}))).toBe('unexpected');
  });
});

describe('ids de ruta', () => {
  it.each([0, -1, 1.5, Number.NaN])('id %s es un error de programación y no hay request', async (bad) => {
    const { api, fetchFn } = setup(noContent);
    await expect(api.borrarSillon(bad)).rejects.toThrow('id');
    await expect(api.editarBloqueo(bad, { sillonId: null, profesionalId: null, inicio: 'a', fin: 'b' })).rejects.toThrow('id');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
