import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from './__fixtures__/auth';
import {
  PROBLEM_409_CONFLICTO,
  TURNO_ASISTIO,
  TURNO_AUSENTE,
  TURNO_CANCELADO,
  TURNO_CONFIRMADO,
  TURNO_CRUCE_MEDIANOCHE,
  TURNO_MALICIOSO,
  TURNO_NOCTURNO,
  TURNO_PROGRAMADO,
  TURNO_SILLON_INACTIVO,
  TURNO_SOBRETURNO,
} from './__fixtures__/turnos';
import { ApiError } from './errors';
import { createHttpClient } from './http';
import { createTurnosApi } from './turnos';

function setup(response: Response | (() => Response)) {
  const fetchFn = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(typeof response === 'function' ? response() : response.clone()));
  const http = createHttpClient({ baseUrl: 'http://api.test/api', fetchFn, getToken: () => 't1', onUnauthorized: () => undefined });
  return { api: createTurnosApi(http), fetchFn };
}

function call(fetchFn: ReturnType<typeof vi.fn<typeof fetch>>, index = 0) {
  const c = fetchFn.mock.calls[index];
  if (c === undefined) throw new Error('sin llamada');
  const init = c[1] ?? {};
  const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
  return { url: String(c[0]), method: init.method, headers: new Headers(init.headers), body };
}

async function errorOf(p: Promise<unknown>): Promise<ApiError | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof ApiError ? e : null;
  }
}

const RANGO = { desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' };

describe('turnos.listar', () => {
  it('GET /turnos con desde y hasta, autenticado, y decodifica el listado', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, [TURNO_PROGRAMADO, TURNO_CONFIRMADO]));
    expect(await api.listar(RANGO)).toEqual([TURNO_PROGRAMADO, TURNO_CONFIRMADO]);
    const c = call(fetchFn);
    expect(c.method).toBe('GET');
    expect(c.url).toBe('http://api.test/api/turnos?desde=2026-11-24T03%3A00%3A00Z&hasta=2026-11-25T03%3A00%3A00Z');
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
    expect(c.body).toBeUndefined();
  });

  it('agrega sillonId, profesionalId e incluirCancelados=true solo cuando corresponden', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, []));
    await api.listar({ ...RANGO, sillonId: 2, profesionalId: 7, incluirCancelados: true });
    const params = new URL(call(fetchFn).url).searchParams;
    expect(params.get('sillonId')).toBe('2');
    expect(params.get('profesionalId')).toBe('7');
    expect(params.get('incluirCancelados')).toBe('true');
  });

  it('omite los opcionales sin valor e incluirCancelados=false', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, []));
    await api.listar({ ...RANGO, incluirCancelados: false });
    const params = new URL(call(fetchFn).url).searchParams;
    expect([...params.keys()].sort()).toEqual(['desde', 'hasta']);
  });

  it('sillonId inválido es error de programación sin request', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, []));
    await expect(api.listar({ ...RANGO, sillonId: 0 })).rejects.toThrow('Error de programación');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('un listado que no es arreglo es unexpected', async () => {
    const { api } = setup(jsonResponse(200, TURNO_PROGRAMADO));
    expect((await errorOf(api.listar(RANGO)))?.kind).toBe('unexpected');
  });
});

describe('turnos.obtener', () => {
  it('GET /turnos/{id}', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, TURNO_PROGRAMADO));
    expect(await api.obtener(100)).toEqual(TURNO_PROGRAMADO);
    expect(call(fetchFn)).toMatchObject({ method: 'GET', url: 'http://api.test/api/turnos/100' });
  });

  it.each([0, -1, 1.5, Number.NaN])('id %s inválido: error de programación sin request', async (id) => {
    const { api, fetchFn } = setup(jsonResponse(200, TURNO_PROGRAMADO));
    await expect(api.obtener(id)).rejects.toThrow('Error de programación');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('turnos.crear', () => {
  const request = { pacienteId: 5, prestacionId: 11, sillonId: 1, inicio: '2026-11-24T13:00:00Z' };

  it('POST /turnos con el cuerpo tal cual, sin opcionales ausentes', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, TURNO_PROGRAMADO));
    expect(await api.crear(request)).toEqual(TURNO_PROGRAMADO);
    const c = call(fetchFn);
    expect(c).toMatchObject({ method: 'POST', url: 'http://api.test/api/turnos', body: request });
    expect(Object.keys(c.body as object).sort()).toEqual(['inicio', 'pacienteId', 'prestacionId', 'sillonId']);
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
  });

  it('con opcionales: profesionalId, sobreturno y notas viajan', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, TURNO_SOBRETURNO));
    await api.crear({ ...request, profesionalId: 7, sobreturno: true, notas: 'Urgencia' });
    expect(call(fetchFn).body).toEqual({ ...request, profesionalId: 7, sobreturno: true, notas: 'Urgencia' });
  });

  it('un 409 con conflicto llega como ApiError con el detalle', async () => {
    const { api } = setup(jsonResponse(409, PROBLEM_409_CONFLICTO));
    const err = await errorOf(api.crear(request));
    expect(err?.kind).toBe('conflict');
    expect(err?.conflicto?.motivo).toBe('SILLON');
  });
});

describe('turnos.cambiarEstado', () => {
  it('PATCH /turnos/{id}/estado con solo el estado', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, TURNO_CONFIRMADO));
    await api.cambiarEstado(100, { estado: 'CONFIRMADO' });
    expect(call(fetchFn)).toMatchObject({ method: 'PATCH', url: 'http://api.test/api/turnos/100/estado', body: { estado: 'CONFIRMADO' } });
  });

  it('CANCELADO lleva el motivo', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, TURNO_CANCELADO));
    await api.cambiarEstado(102, { estado: 'CANCELADO', motivoCancelacion: 'No llega' });
    expect(call(fetchFn).body).toEqual({ estado: 'CANCELADO', motivoCancelacion: 'No llega' });
  });

  it.each(['CONFIRMADO', 'ASISTIO', 'AUSENTE'] as const)('motivoCancelacion no viaja con %s', async (estado) => {
    const { api, fetchFn } = setup(jsonResponse(200, TURNO_CONFIRMADO));
    await api.cambiarEstado(100, { estado, motivoCancelacion: 'ignorado' });
    expect(call(fetchFn).body).toEqual({ estado });
  });

  it('id inválido: error de programación sin request', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, TURNO_CONFIRMADO));
    await expect(api.cambiarEstado(0, { estado: 'CONFIRMADO' })).rejects.toThrow('Error de programación');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('turnos.reprogramar', () => {
  it('PUT /turnos/{id} con solo inicio', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, TURNO_PROGRAMADO));
    await api.reprogramar(100, { inicio: '2026-11-24T14:00:00Z' });
    expect(call(fetchFn)).toMatchObject({ method: 'PUT', url: 'http://api.test/api/turnos/100', body: { inicio: '2026-11-24T14:00:00Z' } });
  });

  it('con sillonId y sobreturno', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, TURNO_SOBRETURNO));
    await api.reprogramar(100, { inicio: '2026-11-24T14:00:00Z', sillonId: 2, sobreturno: true });
    expect(call(fetchFn).body).toEqual({ inicio: '2026-11-24T14:00:00Z', sillonId: 2, sobreturno: true });
  });

  it('id inválido: error de programación sin request', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, TURNO_PROGRAMADO));
    await expect(api.reprogramar(-3, { inicio: '2026-11-24T14:00:00Z' })).rejects.toThrow('Error de programación');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('decodificación de turnos (1.3)', () => {
  it.each([
    ['programado', TURNO_PROGRAMADO],
    ['confirmado', TURNO_CONFIRMADO],
    ['cancelado', TURNO_CANCELADO],
    ['asistió', TURNO_ASISTIO],
    ['ausente', TURNO_AUSENTE],
    ['sobreturno', TURNO_SOBRETURNO],
    ['nocturno', TURNO_NOCTURNO],
    ['cruce de medianoche', TURNO_CRUCE_MEDIANOCHE],
    ['sillón inactivo sin profesional', TURNO_SILLON_INACTIVO],
    ['nombres con marcado HTML', TURNO_MALICIOSO],
  ])('turno %s se decodifica sin alterar', async (_nombre, turno) => {
    const { api } = setup(jsonResponse(200, turno));
    expect(await api.obtener(turno.id)).toEqual(turno);
  });

  it('acepta profesionalId, notas y motivoCancelacion nulos o ausentes', async () => {
    // `undefined` no se serializa: las claves quedan ausentes del JSON.
    const sinOpcionales = { ...TURNO_PROGRAMADO, profesionalId: undefined, notas: undefined, motivoCancelacion: undefined };
    const { api } = setup(jsonResponse(200, sinOpcionales));
    expect(await api.obtener(100)).toMatchObject({ profesionalId: null, notas: null, motivoCancelacion: null });
  });

  it.each([
    ['estado desconocido', { ...TURNO_PROGRAMADO, estado: 'REPROGRAMADO' }],
    ['estado en minúscula', { ...TURNO_PROGRAMADO, estado: 'programado' }],
    ['inicio no ISO', { ...TURNO_PROGRAMADO, inicio: '24/11/2026 10:00' }],
    ['fin sin zona', { ...TURNO_PROGRAMADO, fin: '2026-11-24T13:30:00' }],
    ['paciente faltante', { ...TURNO_PROGRAMADO, paciente: undefined }],
    ['paciente sin apellido', { ...TURNO_PROGRAMADO, paciente: { id: 5, nombre: 'Ana' } }],
    ['prestacion faltante', { ...TURNO_PROGRAMADO, prestacion: undefined }],
    ['prestacion sin nombre', { ...TURNO_PROGRAMADO, prestacion: { id: 11 } }],
    ['sillonId no entero', { ...TURNO_PROGRAMADO, sillonId: '1' }],
    ['sobreturno no booleano', { ...TURNO_PROGRAMADO, sobreturno: 'no' }],
    ['notas de tipo incorrecto', { ...TURNO_PROGRAMADO, notas: 5 }],
  ])('%s → unexpected', async (_caso, cuerpo) => {
    const { api } = setup(jsonResponse(200, cuerpo));
    expect((await errorOf(api.obtener(100)))?.kind).toBe('unexpected');
  });
});
