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
