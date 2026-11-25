import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from './__fixtures__/auth';
import { ENLACE_WHATSAPP, RECORDATORIO_EMAIL, TURNO_PENDIENTE_SIN_ULTIMO } from './__fixtures__/recordatorios';
import { ApiError } from './errors';
import { createHttpClient } from './http';
import { createRecordatoriosApi } from './recordatorios';

function setup(response: Response | (() => Response)) {
  const fetchFn = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(typeof response === 'function' ? response() : response.clone()));
  const http = createHttpClient({ baseUrl: 'http://api.test/api', fetchFn, getToken: () => 't1', onUnauthorized: () => undefined });
  return { api: createRecordatoriosApi(http), fetchFn };
}

function call(fetchFn: ReturnType<typeof vi.fn<typeof fetch>>, index = 0) {
  const c = fetchFn.mock.calls[index];
  if (c === undefined) throw new Error('sin llamada');
  const init = c[1] ?? {};
  return { url: String(c[0]), method: init.method, headers: new Headers(init.headers), body: init.body, cache: init.cache };
}

async function errorOf(p: Promise<unknown>): Promise<ApiError | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof ApiError ? e : null;
  }
}

describe('cliente de recordatorios: pedidos', () => {
  it('enlaceWhatsApp(7) -> GET autenticado, sin cuerpo y no-store', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, ENLACE_WHATSAPP));
    expect(await api.enlaceWhatsApp(7)).toEqual(ENLACE_WHATSAPP);
    const c = call(fetchFn);
    expect(c.method).toBe('GET');
    expect(c.url).toBe('http://api.test/api/turnos/7/recordatorio/whatsapp');
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
    expect(c.body).toBeUndefined();
    expect(c.cache).toBe('no-store');
  });

  it('enlaceWhatsApp con otro id usa ese id en la ruta', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, ENLACE_WHATSAPP));
    await api.enlaceWhatsApp(42);
    expect(call(fetchFn).url).toBe('http://api.test/api/turnos/42/recordatorio/whatsapp');
  });

  it('enviarEmail(7) -> POST autenticado, sin cuerpo ni Content-Type y no-store', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, RECORDATORIO_EMAIL));
    expect(await api.enviarEmail(7)).toEqual(RECORDATORIO_EMAIL);
    const c = call(fetchFn);
    expect(c.method).toBe('POST');
    expect(c.url).toBe('http://api.test/api/turnos/7/recordatorio/email');
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
    expect(c.headers.has('Content-Type')).toBe(false);
    expect(c.body).toBeUndefined();
    expect(c.cache).toBe('no-store');
  });

  it('pendientes("2026-11-26") -> GET con fecha y no-store', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, [TURNO_PENDIENTE_SIN_ULTIMO]));
    expect(await api.pendientes('2026-11-26')).toEqual([TURNO_PENDIENTE_SIN_ULTIMO]);
    const c = call(fetchFn);
    expect(c.method).toBe('GET');
    expect(c.url).toBe('http://api.test/api/turnos/pendientes-recordatorio?fecha=2026-11-26');
    expect(c.headers.get('Authorization')).toBe('Bearer t1');
    expect(c.cache).toBe('no-store');
  });

  it('pendientes con otra fecha la envía tal cual', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, []));
    expect(await api.pendientes('2026-12-01')).toEqual([]);
    expect(call(fetchFn).url).toBe('http://api.test/api/turnos/pendientes-recordatorio?fecha=2026-12-01');
  });

  it.each([0, -1, 1.5])('id %s rechaza la promesa sin enviar request (WhatsApp y email)', async (id) => {
    const { api, fetchFn } = setup(jsonResponse(200, ENLACE_WHATSAPP));
    await expect(api.enlaceWhatsApp(id)).rejects.toThrow('Error de programación');
    await expect(api.enviarEmail(id)).rejects.toThrow('Error de programación');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('un error de la API se propaga como ApiError', async () => {
    const { api } = setup(jsonResponse(502, { title: 'No se pudo enviar el email', status: 502 }));
    const e = await errorOf(api.enviarEmail(7));
    expect(e?.status).toBe(502);
    expect(e?.kind).toBe('server');
  });
});

describe('decoders de recordatorios', () => {
  async function enlace(value: unknown) {
    const { api } = setup(jsonResponse(200, value));
    return api.enlaceWhatsApp(7);
  }

  it('acepta un enlace https://wa.me/... tal cual', async () => {
    const r = await enlace({ recordatorioId: 31, enlace: 'https://wa.me/5491122334455?text=Recordatorio%3A', generadoEn: '2026-11-25T14:00:00Z' });
    expect(r.enlace).toBe('https://wa.me/5491122334455?text=Recordatorio%3A');
    expect(r.recordatorioId).toBe(31);
  });

  it.each([
    'javascript:alert(1)',
    'http://wa.me/54911',
    'https://wa.me.evil.com/54911',
    'https://evil.com/wa.me/54911',
    'https://usuario@wa.me.evil.com/x',
    'https://api.whatsapp.com/send?phone=54911',
    'no es una url',
    '',
  ])('rechaza el enlace %j como unexpected', async (valor) => {
    const e = await errorOf(enlace({ recordatorioId: 31, enlace: valor, generadoEn: '2026-11-25T14:00:00Z' }));
    expect(e?.kind).toBe('unexpected');
  });

  it.each([42, null, undefined, { href: 'https://wa.me/1' }])('rechaza un enlace no string (%j)', async (valor) => {
    const e = await errorOf(enlace({ recordatorioId: 31, enlace: valor, generadoEn: '2026-11-25T14:00:00Z' }));
    expect(e?.kind).toBe('unexpected');
  });

  it('rechaza un generadoEn no ISO o un recordatorioId inválido', async () => {
    expect((await errorOf(enlace({ ...ENLACE_WHATSAPP, generadoEn: '25/11/2026' })))?.kind).toBe('unexpected');
    expect((await errorOf(enlace({ ...ENLACE_WHATSAPP, recordatorioId: 0 })))?.kind).toBe('unexpected');
  });

  it('email 201 con estado ENVIADO e instante ISO', async () => {
    const { api } = setup(jsonResponse(201, { recordatorioId: 5, estado: 'ENVIADO', enviadoEn: '2026-11-25T14:00:05Z' }));
    expect(await api.enviarEmail(7)).toEqual({ recordatorioId: 5, estado: 'ENVIADO', enviadoEn: '2026-11-25T14:00:05Z' });
  });

  it.each([
    { recordatorioId: 5, estado: 'ENVIADO', enviadoEn: 'ayer' },
    { recordatorioId: 5, estado: 'DESCONOCIDO', enviadoEn: '2026-11-25T14:00:05Z' },
    { estado: 'ENVIADO', enviadoEn: '2026-11-25T14:00:05Z' },
  ])('email mal formado %j es unexpected', async (cuerpo) => {
    const { api } = setup(jsonResponse(201, cuerpo));
    expect((await errorOf(api.enviarEmail(7)))?.kind).toBe('unexpected');
  });

  async function pendientes(items: unknown) {
    const { api } = setup(jsonResponse(200, items));
    return api.pendientes('2026-11-26');
  }

  it('pendiente sin ultimoRecordatorio queda null; con EMAIL/ERROR se decodifica', async () => {
    const sinUltimo = { ...TURNO_PENDIENTE_SIN_ULTIMO };
    const conError = { ...TURNO_PENDIENTE_SIN_ULTIMO, turnoId: 9, ultimoRecordatorio: { canal: 'EMAIL', estado: 'ERROR', generadoEn: '2026-11-25T13:00:00Z' } };
    const sinClave: Record<string, unknown> = { ...TURNO_PENDIENTE_SIN_ULTIMO, turnoId: 10 };
    delete sinClave['ultimoRecordatorio'];
    const lista = await pendientes([sinUltimo, conError, sinClave]);
    expect(lista[0]?.ultimoRecordatorio).toBeNull();
    expect(lista[1]?.ultimoRecordatorio).toEqual({ canal: 'EMAIL', estado: 'ERROR', generadoEn: '2026-11-25T13:00:00Z' });
    expect(lista[2]?.ultimoRecordatorio).toBeNull();
  });

  it('un pendiente con tieneTelefono ausente es unexpected', async () => {
    const roto: Record<string, unknown> = { ...TURNO_PENDIENTE_SIN_ULTIMO };
    delete roto['tieneTelefono'];
    expect((await errorOf(pendientes([roto])))?.kind).toBe('unexpected');
  });

  it.each([
    ['estado de turno desconocido', { estado: 'DESCONOCIDO' }],
    ['canal desconocido', { ultimoRecordatorio: { canal: 'SMS', estado: 'ERROR', generadoEn: '2026-11-25T13:00:00Z' } }],
    ['estado de recordatorio desconocido', { ultimoRecordatorio: { canal: 'EMAIL', estado: 'X', generadoEn: '2026-11-25T13:00:00Z' } }],
    ['instante no ISO en ultimoRecordatorio', { ultimoRecordatorio: { canal: 'EMAIL', estado: 'ERROR', generadoEn: 'ayer' } }],
    ['inicio no ISO', { inicio: '2026-11-26 10:00' }],
    ['tieneEmail no booleano', { tieneEmail: 'si' }],
  ])('pendiente con %s es unexpected', async (_nombre, cambio) => {
    expect((await errorOf(pendientes([{ ...TURNO_PENDIENTE_SIN_ULTIMO, ...cambio }])))?.kind).toBe('unexpected');
  });

  it('una respuesta que no es arreglo es unexpected', async () => {
    expect((await errorOf(pendientes({ turnos: [] })))?.kind).toBe('unexpected');
  });
});
