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

describe('codigo de negocio (C-12, D3)', () => {
  it.each([
    [409, 'FICHA_DESACTUALIZADA', 'conflict'],
    [409, 'CONSENTIMIENTO_REQUERIDO', 'conflict'],
    [409, 'PACIENTE_INACTIVO', 'conflict'],
    [422, 'PROFESIONAL_NO_VINCULADO', 'validation'],
  ] as const)('toma codigo de un %i (%s) sin cambiar el kind', (status, codigo, kind) => {
    const err = toApiError(status, noHeaders, { title: 'x', codigo });
    expect(err.codigo).toBe(codigo);
    expect(err.kind).toBe(kind);
    expect(err.message).toBe(toApiError(status, noHeaders, undefined).message);
  });

  it('acepta el largo máximo de 40 caracteres y una sola letra', () => {
    const cuarenta = `A${'_'.repeat(38)}Z`;
    expect(cuarenta).toHaveLength(40);
    expect(toApiError(409, noHeaders, { codigo: cuarenta }).codigo).toBe(cuarenta);
    expect(toApiError(409, noHeaders, { codigo: 'X' }).codigo).toBe('X');
  });

  it.each([
    ['<b>x</b>'],
    ['ficha_desactualizada'],
    ['FICHA DESACTUALIZADA'],
    ['_FICHA'],
    ['FICHA-1'],
    [''],
    [`A${'B'.repeat(40)}`],
    [42],
    [null],
    [true],
    [{ codigo: 'X' }],
    [['FICHA_DESACTUALIZADA']],
  ])('codigo con forma inválida %j da null', (codigo) => {
    const err = toApiError(409, noHeaders, { codigo });
    expect(err.codigo).toBeNull();
    expect(err.kind).toBe('conflict');
  });

  it('sin cuerpo, cuerpo no objeto o sin la propiedad, codigo es null', () => {
    expect(toApiError(409, noHeaders, undefined).codigo).toBeNull();
    expect(toApiError(409, noHeaders, 'CONSENTIMIENTO_REQUERIDO').codigo).toBeNull();
    expect(toApiError(409, noHeaders, ['CONSENTIMIENTO_REQUERIDO']).codigo).toBeNull();
    expect(toApiError(409, noHeaders, { title: 'Conflicto' }).codigo).toBeNull();
  });

  it('el mensaje nunca incluye el codigo ni el detail', () => {
    const err = toApiError(409, noHeaders, { codigo: 'FICHA_DESACTUALIZADA', detail: 'alergia a la penicilina' });
    expect(err.message).not.toContain('FICHA_DESACTUALIZADA');
    expect(err.message).not.toContain('penicilina');
  });
});

describe('pacienteId del 409 de DNI duplicado (C-12, D3)', () => {
  it.each([7, 1, Number.MAX_SAFE_INTEGER])('toma pacienteId %i de un 409', (pacienteId) => {
    expect(toApiError(409, noHeaders, { title: 'DNI duplicado', pacienteId }).pacienteId).toBe(pacienteId);
  });

  it.each([['7'], [-1], [0], [1.5], [Number.MAX_SAFE_INTEGER + 2], [Number.NaN], [null], [true]])(
    'pacienteId inválido %j da null',
    (pacienteId) => {
      expect(toApiError(409, noHeaders, { pacienteId }).pacienteId).toBeNull();
    },
  );

  it.each([400, 404, 422, 500])('ignora pacienteId fuera de un 409 (%i)', (status) => {
    expect(toApiError(status, noHeaders, { pacienteId: 7 }).pacienteId).toBeNull();
  });

  it('sin cuerpo o sin la propiedad, pacienteId es null', () => {
    expect(toApiError(409, noHeaders, undefined).pacienteId).toBeNull();
    expect(toApiError(409, noHeaders, { title: 'x' }).pacienteId).toBeNull();
  });
});

describe('ApiError construido a mano (C-12)', () => {
  it('codigo y pacienteId son null por defecto', () => {
    const err = new ApiError('conflict', { status: 409 });
    expect(err.codigo).toBeNull();
    expect(err.pacienteId).toBeNull();
  });

  it('acepta codigo y pacienteId en los detalles (fixtures de tests de páginas)', () => {
    const err = new ApiError('conflict', { status: 409, codigo: 'FICHA_DESACTUALIZADA', pacienteId: 3 });
    expect(err.codigo).toBe('FICHA_DESACTUALIZADA');
    expect(err.pacienteId).toBe(3);
  });
});
