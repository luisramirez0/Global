import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from './__fixtures__/auth';
import { ENTRADA_FICHA, ENTRADA_LOGIN, EXPORT_PACIENTE_7, paginaDe } from './__fixtures__/auditoria';
import { createAuditoriaApi } from './auditoria';
import { ApiError } from './errors';
import { createHttpClient } from './http';

function setup(response: Response | (() => Response)) {
  const fetchFn = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(typeof response === 'function' ? response() : response));
  const http = createHttpClient({ baseUrl: 'http://api.test/api', fetchFn, getToken: () => 't1', onUnauthorized: () => undefined });
  return { api: createAuditoriaApi(http), fetchFn };
}

function url(fetchFn: ReturnType<typeof vi.fn<typeof fetch>>, index = 0): string {
  const c = fetchFn.mock.calls[index];
  if (c === undefined) throw new Error('sin llamada');
  return String(c[0]);
}

async function errorOf(p: Promise<unknown>): Promise<ApiError | Error | 'ok'> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    if (e instanceof Error) return e;
    throw e;
  }
}

describe('listar auditoría (contrato de C-06)', () => {
  it('sin filtros pide la página 0 autenticado y decodifica la página', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, paginaDe([ENTRADA_FICHA, ENTRADA_LOGIN])));

    const pagina = await api.listar({ page: 0 });

    expect(url(fetchFn)).toBe('http://api.test/api/auditoria?page=0');
    const init = fetchFn.mock.calls[0]?.[1] ?? {};
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer t1');
    expect(pagina.contenido).toEqual([ENTRADA_FICHA, ENTRADA_LOGIN]);
    expect(pagina).toMatchObject({ pagina: 0, tamanio: 20, totalElementos: 2, totalPaginas: 1 });
  });

  it('con filtros arma la query en orden estable y entidadId junto a la entidad', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, paginaDe([])));

    await api.listar({
      desde: '2026-11-24T03:00:00Z',
      hasta: '2026-11-25T03:00:00Z',
      accion: 'READ',
      entidad: 'FichaClinica',
      entidadId: 7,
      usuarioId: 3,
      page: 2,
    });

    expect(url(fetchFn)).toBe(
      'http://api.test/api/auditoria?desde=2026-11-24T03%3A00%3A00Z&hasta=2026-11-25T03%3A00%3A00Z&accion=READ&entidad=FichaClinica&entidadId=7&usuarioId=3&page=2',
    );
  });

  it('entidadId sin entidad es un error de programación y no hace la request (design D8)', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, paginaDe([])));

    const e = await errorOf(api.listar({ entidadId: 7, page: 0 }));

    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(ApiError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('detalle null y usuario o IP nulos se aceptan', async () => {
    const { api } = setup(jsonResponse(200, paginaDe([ENTRADA_LOGIN])));
    const pagina = await api.listar({ page: 0 });
    expect(pagina.contenido[0]).toMatchObject({ usuarioId: null, ip: null, detalle: null, entidadId: null });
  });

  it.each([
    ['acción desconocida', { ...ENTRADA_FICHA, accion: 'BORRAR' }],
    ['detalle no plano', { ...ENTRADA_FICHA, detalle: { a: { b: 1 } } }],
    ['detalle lista', { ...ENTRADA_FICHA, detalle: [1, 2] }],
    ['fecha sin zona', { ...ENTRADA_FICHA, fecha: '2026-11-24T10:00:00' }],
    ['entidad no texto', { ...ENTRADA_FICHA, entidad: 5 }],
  ])('rechaza una entrada con %s como unexpected', async (_caso, entrada) => {
    const { api } = setup(jsonResponse(200, paginaDe([entrada])));
    const e = await errorOf(api.listar({ page: 0 }));
    expect(e instanceof ApiError ? e.kind : e).toBe('unexpected');
  });

  it('rechaza una página sin contenido como unexpected', async () => {
    const { api } = setup(jsonResponse(200, { pagina: 0 }));
    const e = await errorOf(api.listar({ page: 0 }));
    expect(e instanceof ApiError ? e.kind : e).toBe('unexpected');
  });

  it.each([
    [400, 'validation'],
    [403, 'forbidden'],
  ])('un %i de la API llega como %s', async (status, kind) => {
    const { api } = setup(jsonResponse(status, { title: 'x', status }));
    const e = await errorOf(api.listar({ page: 0 }));
    expect(e instanceof ApiError ? e.kind : e).toBe(kind);
  });
});

describe('exportar paciente (C-15 design D1)', () => {
  it('pide GET /pacientes/{id}/export autenticado y devuelve el objeto', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, EXPORT_PACIENTE_7));

    const datos = await api.exportarPaciente(7);

    expect(url(fetchFn)).toBe('http://api.test/api/pacientes/7/export');
    expect(fetchFn.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(datos).toEqual(EXPORT_PACIENTE_7);
  });

  it('otro id va a su propia ruta', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, { ...EXPORT_PACIENTE_7, paciente: { id: 12 } }));
    await api.exportarPaciente(12);
    expect(url(fetchFn)).toBe('http://api.test/api/pacientes/12/export');
  });

  it.each([0, -1, 1.5, Number.NaN])('el id %s no hace la request', async (id) => {
    const { api, fetchFn } = setup(jsonResponse(200, EXPORT_PACIENTE_7));
    const e = await errorOf(api.exportarPaciente(id));
    expect(e).toBeInstanceOf(Error);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['una lista', [1]],
    ['un objeto sin paciente', { exportadoEn: '2026-11-24T13:00:00Z' }],
  ])('rechaza %s como unexpected', async (_caso, cuerpo) => {
    const { api } = setup(jsonResponse(200, cuerpo));
    const e = await errorOf(api.exportarPaciente(7));
    expect(e instanceof ApiError ? e.kind : e).toBe('unexpected');
  });

  it('un 404 conserva el status para el mensaje de la UI', async () => {
    const { api } = setup(jsonResponse(404, { title: 'No encontrado', status: 404 }));
    const e = await errorOf(api.exportarPaciente(7));
    expect(e instanceof ApiError ? e.status : e).toBe(404);
  });
});
