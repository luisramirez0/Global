import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, problemResponse } from './__fixtures__/auth';
import { CONSENTIMIENTO_V1, FICHA_V3, FICHA_VACIA, NOTA_1, NOTA_2, TEXTO_V1 } from './__fixtures__/ficha';
import { pagina } from './__fixtures__/pacientesAbm';
import { ApiError } from './errors';
import { createFichaApi } from './ficha';
import { createHttpClient } from './http';
import type { FichaRequest } from './types';

function setup(response: Response | (() => Response)) {
  const fetchFn = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(typeof response === 'function' ? response() : response));
  const http = createHttpClient({ baseUrl: 'http://api.test/api', fetchFn, getToken: () => 't1', onUnauthorized: () => undefined });
  return { api: createFichaApi(http), fetchFn };
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

const REQUEST: FichaRequest = {
  alergias: 'Penicilina',
  medicacionActual: null,
  antecedentesMedicos: null,
  enfermedadesRelevantes: null,
  embarazo: null,
  motivoConsulta: 'Control',
  observaciones: null,
  version: null,
};

describe('consentimiento', () => {
  it('listar: GET /pacientes/{id}/consentimientos autenticado', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, [CONSENTIMIENTO_V1]));
    expect(await api.listarConsentimientos(7)).toEqual([CONSENTIMIENTO_V1]);
    const c = call(fetchFn);
    expect(c.method).toBe('GET');
    expect(c.url).toBe('http://api.test/api/pacientes/7/consentimientos');
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
  });

  it('lista vacía', async () => {
    const { api } = setup(jsonResponse(200, []));
    expect(await api.listarConsentimientos(7)).toEqual([]);
  });

  it('texto vigente: GET /consentimientos/texto-vigente', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, TEXTO_V1));
    expect(await api.textoVigente()).toEqual(TEXTO_V1);
    expect(call(fetchFn).url).toBe('http://api.test/api/consentimientos/texto-vigente');
  });

  it('registrar: POST con solo la versión del texto', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, CONSENTIMIENTO_V1));
    expect(await api.registrarConsentimiento(7, 'v1')).toEqual(CONSENTIMIENTO_V1);
    const c = call(fetchFn);
    expect(c.method).toBe('POST');
    expect(c.url).toBe('http://api.test/api/pacientes/7/consentimientos');
    expect(c.body).toEqual({ versionTexto: 'v1' });
  });

  it.each([
    ['sin versionTexto', { ...CONSENTIMIENTO_V1, versionTexto: undefined }],
    ['aceptadoEn sin zona', { ...CONSENTIMIENTO_V1, aceptadoEn: '2026-11-20T13:30:00' }],
    ['registradoPorUsuarioId string', { ...CONSENTIMIENTO_V1, registradoPorUsuarioId: '2' }],
  ])('consentimiento con %s → unexpected', async (_caso, body) => {
    const { api } = setup(jsonResponse(200, [body]));
    const err = await errorOf(api.listarConsentimientos(7));
    expect(err instanceof ApiError && err.kind).toBe('unexpected');
  });

  it.each([
    ['contenido no string', { ...TEXTO_V1, contenido: 1 }],
    ['versión vacía', { ...TEXTO_V1, version: '' }],
  ])('texto con %s → unexpected', async (_caso, body) => {
    const { api } = setup(jsonResponse(200, body));
    const err = await errorOf(api.textoVigente());
    expect(err instanceof ApiError && err.kind).toBe('unexpected');
  });
});

describe('ficha', () => {
  it('obtener: GET /pacientes/{id}/ficha', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, FICHA_V3));
    expect(await api.obtenerFicha(7)).toEqual(FICHA_V3);
    expect(call(fetchFn).url).toBe('http://api.test/api/pacientes/7/ficha');
  });

  it('ficha no cargada: todos los campos, version y actualizadaEn en null', async () => {
    const { api } = setup(jsonResponse(200, FICHA_VACIA));
    expect(await api.obtenerFicha(7)).toEqual(FICHA_VACIA);
  });

  it('guardar: PUT con el reemplazo completo y la version', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, { ...FICHA_V3, version: 4 }));
    const ficha = await api.guardarFicha(7, { ...REQUEST, version: 3 });
    expect(ficha.version).toBe(4);
    const c = call(fetchFn);
    expect(c.method).toBe('PUT');
    expect(c.url).toBe('http://api.test/api/pacientes/7/ficha');
    expect(c.body).toEqual({ ...REQUEST, version: 3 });
  });

  it('guardar en la primera carga envía version: null explícito', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, { ...FICHA_V3, version: 0 }));
    await api.guardarFicha(7, REQUEST);
    const body = call(fetchFn).body;
    expect(body).toHaveProperty('version', null);
    expect(body).toHaveProperty('embarazo', null);
  });

  it('el 409 FICHA_DESACTUALIZADA llega con su código', async () => {
    const { api } = setup(problemResponse(409, { codigo: 'FICHA_DESACTUALIZADA' }));
    const err = await errorOf(api.guardarFicha(7, REQUEST));
    expect(err instanceof ApiError && err.codigo).toBe('FICHA_DESACTUALIZADA');
  });

  it.each([
    ['embarazo "si"', { ...FICHA_V3, embarazo: 'si' }],
    ['embarazo 0', { ...FICHA_V3, embarazo: 0 }],
    ['version negativa', { ...FICHA_V3, version: -1 }],
    ['version decimal', { ...FICHA_V3, version: 1.5 }],
    ['alergias número', { ...FICHA_V3, alergias: 1 }],
    ['actualizadaEn no ISO', { ...FICHA_V3, actualizadaEn: 'ayer' }],
    ['sin pacienteId', { ...FICHA_V3, pacienteId: undefined }],
  ])('ficha con %s → unexpected', async (_caso, body) => {
    const { api } = setup(jsonResponse(200, body));
    const err = await errorOf(api.obtenerFicha(7));
    expect(err instanceof ApiError && err.kind).toBe('unexpected');
  });

  it('version 0 es válida', async () => {
    const { api } = setup(jsonResponse(200, { ...FICHA_V3, version: 0 }));
    expect((await api.obtenerFicha(7)).version).toBe(0);
  });
});

describe('notas', () => {
  it('listar: GET /pacientes/{id}/notas?page&size', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, pagina([NOTA_1, NOTA_2])));
    const res = await api.listarNotas(7, 1, 20);
    expect(res.contenido).toEqual([NOTA_1, NOTA_2]);
    expect(call(fetchFn).url).toBe('http://api.test/api/pacientes/7/notas?page=1&size=20');
  });

  it('crear: POST con solo el texto, sin turnoId', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, NOTA_1));
    expect(await api.crearNota(7, 'Control de rutina.')).toEqual(NOTA_1);
    const c = call(fetchFn);
    expect(c.method).toBe('POST');
    expect(c.url).toBe('http://api.test/api/pacientes/7/notas');
    expect(c.body).toEqual({ texto: 'Control de rutina.' });
  });

  it('el 422 PROFESIONAL_NO_VINCULADO llega como validation con código', async () => {
    const { api } = setup(problemResponse(422, { codigo: 'PROFESIONAL_NO_VINCULADO' }));
    const err = await errorOf(api.crearNota(7, 'x'));
    expect(err instanceof ApiError && err.kind).toBe('validation');
    expect(err instanceof ApiError && err.codigo).toBe('PROFESIONAL_NO_VINCULADO');
  });

  it.each([
    [{ page: -1, size: 20 }],
    [{ page: 0, size: 0 }],
    [{ page: 0, size: 101 }],
  ])('paginación inválida %j sin request', async ({ page, size }) => {
    const { api, fetchFn } = setup(jsonResponse(200, pagina([])));
    await expect(api.listarNotas(7, page, size)).rejects.toThrow(/programación/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['sin texto', { ...NOTA_1, texto: undefined }],
    ['turnoId 0', { ...NOTA_1, turnoId: 0 }],
    ['fecha no ISO', { ...NOTA_1, fecha: '21/11/2026' }],
    ['profesionalId null', { ...NOTA_1, profesionalId: null }],
  ])('nota con %s → unexpected', async (_caso, body) => {
    const { api } = setup(jsonResponse(201, body));
    const err = await errorOf(api.crearNota(7, 'x'));
    expect(err instanceof ApiError && err.kind).toBe('unexpected');
  });
});

describe('ids inválidos', () => {
  it.each([0, -1, 1.5, Number.NaN])('pacienteId %s rechaza sin request en las 6 operaciones por paciente', async (id) => {
    const { api, fetchFn } = setup(jsonResponse(200, {}));
    await expect(api.listarConsentimientos(id)).rejects.toThrow(/programación/);
    await expect(api.registrarConsentimiento(id, 'v1')).rejects.toThrow(/programación/);
    await expect(api.obtenerFicha(id)).rejects.toThrow(/programación/);
    await expect(api.guardarFicha(id, REQUEST)).rejects.toThrow(/programación/);
    await expect(api.listarNotas(id, 0, 20)).rejects.toThrow(/programación/);
    await expect(api.crearNota(id, 'x')).rejects.toThrow(/programación/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
