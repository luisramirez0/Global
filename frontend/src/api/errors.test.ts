import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './errors';

const noHeaders = new Headers();

describe('toApiError', () => {
  it.each([
    [400, 'validation'],
    [422, 'validation'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [409, 'conflict'],
    [429, 'rate_limited'],
    [500, 'server'],
    [503, 'server'],
    [418, 'unexpected'],
    [404, 'unexpected'],
  ] as const)('mapea %i a %s', (status, kind) => {
    const err = toApiError(status, noHeaders, undefined);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.kind).toBe(kind);
    expect(err.status).toBe(status);
  });

  it('toma los errores por campo de errores del ProblemDetail', () => {
    const err = toApiError(400, noHeaders, {
      title: 'Datos inválidos',
      errores: [
        { campo: 'email', mensaje: 'formato inválido' },
        { campo: 'password', mensaje: 'muy corta' },
      ],
    });
    expect(err.fieldErrors).toEqual([
      { campo: 'email', mensaje: 'formato inválido' },
      { campo: 'password', mensaje: 'muy corta' },
    ]);
    expect(err.title).toBe('Datos inválidos');
  });

  it('descarta errores por campo mal formados y tolera un cuerpo sin errores o no JSON', () => {
    expect(toApiError(400, noHeaders, { errores: [{ campo: 1 }, 'x', { campo: 'email', mensaje: 'm' }] }).fieldErrors).toEqual([
      { campo: 'email', mensaje: 'm' },
    ]);
    expect(toApiError(400, noHeaders, { title: 'x' }).fieldErrors).toEqual([]);
    expect(toApiError(400, noHeaders, undefined).fieldErrors).toEqual([]);
    expect(toApiError(422, noHeaders, 'texto').fieldErrors).toEqual([]);
  });

  it('lee Retry-After en segundos', () => {
    const err = toApiError(429, new Headers({ 'Retry-After': '840' }), undefined);
    expect(err.retryAfterSeconds).toBe(840);
  });

  it.each([null, 'Wed, 21 Oct 2026 07:28:00 GMT', '-3', 'abc'])('Retry-After inválido o ausente %j da null', (value) => {
    const headers = value === null ? noHeaders : new Headers({ 'Retry-After': value });
    expect(toApiError(429, headers, undefined).retryAfterSeconds).toBeNull();
  });

  it('usa un mensaje fijo, sin el detail del servidor', () => {
    const err = toApiError(409, noHeaders, { detail: 'ana@consultorio.test ya existe' });
    expect(err.message).not.toContain('ana@consultorio.test');
    expect(err.message).toBe(toApiError(409, noHeaders, undefined).message);
  });
});

describe('ApiError sin respuesta', () => {
  it.each(['network', 'timeout', 'unexpected'] as const)('%s no tiene estado', (kind) => {
    const err = new ApiError(kind);
    expect(err.status).toBeNull();
    expect(err.fieldErrors).toEqual([]);
    expect(err.retryAfterSeconds).toBeNull();
    expect(err.message.length).toBeGreaterThan(0);
  });
});

describe('detalle de conflicto en errores (C-13, D2)', () => {
  const conflictoSillon = {
    turnoId: 9,
    inicio: '2026-11-24T13:00:00Z',
    fin: '2026-11-24T13:30:00Z',
    sillonId: 1,
    profesionalId: 1,
    motivo: 'SILLON',
  };

  it('409 con conflicto válido por SILLON: lo decodifica y mantiene el mensaje fijo de conflict', () => {
    const err = toApiError(409, noHeaders, { title: 'Turno en conflicto', detail: 'x', conflicto: conflictoSillon });
    expect(err.kind).toBe('conflict');
    expect(err.conflicto).toEqual(conflictoSillon);
    expect(err.message).toBe(toApiError(409, noHeaders, undefined).message);
  });

  it('409 con conflicto válido por PROFESIONAL', () => {
    const err = toApiError(409, noHeaders, { conflicto: { ...conflictoSillon, turnoId: 12, motivo: 'PROFESIONAL', inicio: '2026-11-24T14:00:00+00:00' } });
    expect(err.conflicto?.motivo).toBe('PROFESIONAL');
    expect(err.conflicto?.turnoId).toBe(12);
  });

  it('409 sin detalle o con título solamente: conflicto null', () => {
    expect(toApiError(409, noHeaders, { title: 'Modificación concurrente' }).conflicto).toBeNull();
    expect(toApiError(409, noHeaders, undefined).conflicto).toBeNull();
  });

  it.each([
    ['id no entero', { ...conflictoSillon, turnoId: 'x' }],
    ['id fraccionario', { ...conflictoSillon, sillonId: 1.5 }],
    ['motivo desconocido', { ...conflictoSillon, motivo: 'OTRO' }],
    ['instante no ISO', { ...conflictoSillon, inicio: 'mañana' }],
    ['fin ausente', { ...conflictoSillon, fin: undefined }],
    ['no es objeto', 'SILLON'],
  ])('conflicto mal formado (%s): null sin cambiar kind', (_caso, conflicto) => {
    const err = toApiError(409, noHeaders, { conflicto });
    expect(err.kind).toBe('conflict');
    expect(err.conflicto).toBeNull();
  });

  it('el conflicto solo se lee en un 409', () => {
    expect(toApiError(422, noHeaders, { conflicto: conflictoSillon }).conflicto).toBeNull();
  });

  it('422 con bloqueoId entero positivo lo expone junto a los errores por campo', () => {
    const err = toApiError(422, noHeaders, { errores: [{ campo: 'inicio', mensaje: 'dentro de un bloqueo' }], bloqueoId: 4 });
    expect(err.kind).toBe('validation');
    expect(err.bloqueoId).toBe(4);
    expect(err.fieldErrors.map((f) => f.campo)).toEqual(['inicio']);
  });

  it.each([['4'], [0], [-2], [1.5], [null]])('bloqueoId %j inválido: null', (bloqueoId) => {
    expect(toApiError(422, noHeaders, { bloqueoId }).bloqueoId).toBeNull();
  });

  it('bloqueoId solo se lee en un 422', () => {
    expect(toApiError(400, noHeaders, { bloqueoId: 4 }).bloqueoId).toBeNull();
  });

  it('un ApiError construido a mano arranca con ambos detalles en null', () => {
    const err = new ApiError('conflict', { status: 409 });
    expect(err.conflicto).toBeNull();
    expect(err.bloqueoId).toBeNull();
  });
});
