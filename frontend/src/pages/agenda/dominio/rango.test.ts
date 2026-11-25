import { afterEach, describe, expect, it } from 'vitest';
import { diasDeSemana, lunesDeSemana, rangoDia, rangoSemana, sumarDias } from './rango';

// Vitest corre en Node: `process.env.TZ` cambia la zona local del proceso en caliente (patrón de C-11).
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env['TZ'];

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete env['TZ'];
  else env['TZ'] = ORIGINAL_TZ;
});

const ZONAS = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Europe/Madrid', 'America/Argentina/Buenos_Aires'];

describe('rangoDia', () => {
  it('un día del consultorio va de 03:00Z a 03:00Z del siguiente', () => {
    expect(rangoDia('2026-11-24')).toEqual({ desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' });
  });

  it('cruza fin de mes y de año', () => {
    expect(rangoDia('2026-12-31')).toEqual({ desde: '2026-12-31T03:00:00Z', hasta: '2027-01-01T03:00:00Z' });
    expect(rangoDia('2028-02-29')).toEqual({ desde: '2028-02-29T03:00:00Z', hasta: '2028-03-01T03:00:00Z' });
  });

  it('fecha inválida → null', () => {
    expect(rangoDia('2026-13-01')).toBeNull();
    expect(rangoDia('')).toBeNull();
  });
});

describe('sumarDias', () => {
  it.each([
    ['2026-11-24', 1, '2026-11-25'],
    ['2026-11-24', -1, '2026-11-23'],
    ['2026-11-30', 1, '2026-12-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2026-11-24', 7, '2026-12-01'],
    ['2026-11-24', 0, '2026-11-24'],
  ])('%s %i → %s', (fecha, n, esperado) => {
    expect(sumarDias(fecha, n)).toBe(esperado);
  });

  it('fecha inválida → null', () => {
    expect(sumarDias('x', 1)).toBeNull();
  });
});

describe('lunesDeSemana y diasDeSemana', () => {
  it('un miércoles pertenece a la semana que empieza el lunes anterior', () => {
    // 2026-11-25 es miércoles.
    expect(lunesDeSemana('2026-11-25')).toBe('2026-11-23');
  });

  it('el lunes es su propio inicio y el domingo pertenece a la semana que termina en él', () => {
    expect(lunesDeSemana('2026-11-23')).toBe('2026-11-23');
    expect(lunesDeSemana('2026-11-29')).toBe('2026-11-23');
    expect(lunesDeSemana('2026-11-30')).toBe('2026-11-30');
  });

  it('diasDeSemana devuelve lunes a domingo', () => {
    expect(diasDeSemana('2026-11-25')).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ]);
  });

  it('una semana que cruza mes y año', () => {
    // 2026-12-31 es jueves.
    expect(diasDeSemana('2026-12-31')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });

  it('fecha inválida → null / arreglo vacío', () => {
    expect(lunesDeSemana('2026-02-30')).toBeNull();
    expect(diasDeSemana('2026-02-30')).toEqual([]);
  });
});

describe('rangoSemana', () => {
  it('un miércoles: del lunes 23 a las 00:00 al lunes 30 a las 00:00 (hora del consultorio)', () => {
    expect(rangoSemana('2026-11-25')).toEqual({ desde: '2026-11-23T03:00:00Z', hasta: '2026-11-30T03:00:00Z' });
  });

  it('cruza el año', () => {
    expect(rangoSemana('2026-12-31')).toEqual({ desde: '2026-12-28T03:00:00Z', hasta: '2027-01-04T03:00:00Z' });
  });

  it('cualquier día de la semana da el mismo rango', () => {
    const lunes = rangoSemana('2026-11-23');
    expect(rangoSemana('2026-11-29')).toEqual(lunes);
  });

  it('abarca 7 días (dentro del límite de 42 del backend)', () => {
    const r = rangoSemana('2026-11-25');
    if (r === null) throw new Error('rango nulo');
    expect((Date.parse(r.hasta) - Date.parse(r.desde)) / 86_400_000).toBe(7);
  });

  it('fecha inválida → null', () => {
    expect(rangoSemana('mañana')).toBeNull();
  });
});

describe('independencia de la zona del navegador (V-D4)', () => {
  function offsetDelProceso(): number {
    return new Date(Date.UTC(2026, 10, 24, 12, 0)).getTimezoneOffset();
  }

  it('cambiar process.env.TZ cambia efectivamente el offset del proceso', () => {
    const offsets = new Set<number>();
    for (const zona of ZONAS) {
      env['TZ'] = zona;
      offsets.add(offsetDelProceso());
    }
    expect(offsets.size).toBe(ZONAS.length);
  });

  it.each(ZONAS)('con TZ=%s día, semana y días dan el mismo resultado', (zona) => {
    env['TZ'] = zona;
    expect(rangoDia('2026-11-24')).toEqual({ desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' });
    expect(rangoSemana('2026-11-25')).toEqual({ desde: '2026-11-23T03:00:00Z', hasta: '2026-11-30T03:00:00Z' });
    expect(rangoSemana('2026-12-31')).toEqual({ desde: '2026-12-28T03:00:00Z', hasta: '2027-01-04T03:00:00Z' });
    expect(diasDeSemana('2026-11-24')[0]).toBe('2026-11-23');
    expect(lunesDeSemana('2026-11-29')).toBe('2026-11-23');
  });
});
