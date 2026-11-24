import { afterEach, describe, expect, it } from 'vitest';
import { aFechaHoraLocal, aInstanteUtc, formatearFechaHora, hoyEnZona, siguienteDia, ZONA_CONSULTORIO } from './zonaHoraria';

// Vitest corre en Node: `process.env.TZ` cambia la zona local del proceso en caliente. Tipo mínimo explícito
// para no sumar @types/node al proyecto.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env['TZ'];

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete env['TZ'];
  else env['TZ'] = ORIGINAL_TZ;
});

describe('aInstanteUtc (hora de Argentina → UTC)', () => {
  it('la zona del consultorio es la de Buenos Aires', () => {
    expect(ZONA_CONSULTORIO).toBe('America/Argentina/Buenos_Aires');
  });

  it.each([
    ['2026-11-24', '00:00', '2026-11-24T03:00:00Z'],
    ['2026-11-24', '12:15', '2026-11-24T15:15:00Z'],
    ['2026-11-24', '20:59', '2026-11-24T23:59:00Z'],
    // 21:00–23:59 AR caen al día siguiente en UTC.
    ['2026-11-24', '21:00', '2026-11-25T00:00:00Z'],
    ['2026-11-24', '22:30', '2026-11-25T01:30:00Z'],
    ['2026-11-24', '23:59', '2026-11-25T02:59:00Z'],
    ['2026-12-31', '22:45', '2027-01-01T01:45:00Z'],
    ['2028-02-29', '23:00', '2028-03-01T02:00:00Z'],
  ])('%s %s → %s', (fecha, hora, esperado) => {
    expect(aInstanteUtc(fecha, hora)).toBe(esperado);
  });

  it.each([
    ['2026-02-30', '10:00'],
    ['2026-13-01', '10:00'],
    ['2026-11-24', '24:00'],
    ['2026-11-24', '10:60'],
    ['2026-11-24', '9:00'],
    ['', '10:00'],
    ['2026-11-24', ''],
    ['24/11/2026', '10:00'],
  ])('fecha u hora inválida (%s %s) → null', (fecha, hora) => {
    expect(aInstanteUtc(fecha, hora)).toBeNull();
  });
});

describe('aFechaHoraLocal (UTC → hora de Argentina)', () => {
  it.each([
    ['2026-11-25T00:00:00Z', '2026-11-24', '21:00'],
    ['2026-11-25T02:59:00Z', '2026-11-24', '23:59'],
    ['2026-11-25T03:00:00Z', '2026-11-25', '00:00'],
    ['2027-01-01T01:45:00Z', '2026-12-31', '22:45'],
    ['2026-11-24T15:15:30.500Z', '2026-11-24', '12:15'],
  ])('%s → %s %s', (iso, fecha, hora) => {
    expect(aFechaHoraLocal(iso)).toEqual({ fecha, hora });
  });

  it('instante inválido → null', () => {
    expect(aFechaHoraLocal('no-es-fecha')).toBeNull();
    expect(aFechaHoraLocal('')).toBeNull();
  });

  it('ida y vuelta conserva fecha y hora', () => {
    for (const hora of ['21:00', '21:15', '22:00', '23:45', '23:59', '00:00', '02:59']) {
      const iso = aInstanteUtc('2026-11-24', hora);
      expect(iso).not.toBeNull();
      expect(aFechaHoraLocal(iso ?? '')).toEqual({ fecha: '2026-11-24', hora });
    }
  });

  it('formatearFechaHora muestra dd/mm/aaaa HH:mm en hora de Argentina', () => {
    expect(formatearFechaHora('2026-11-25T02:30:00Z')).toBe('24/11/2026 23:30');
    expect(formatearFechaHora('2026-12-24T12:00:00Z')).toBe('24/12/2026 09:00');
    expect(formatearFechaHora('basura')).toBe('');
  });
});

describe('hoyEnZona y siguienteDia', () => {
  it('a las 23:30 AR (02:30 UTC del día siguiente) sigue siendo el día AR', () => {
    expect(hoyEnZona(Date.parse('2026-11-25T02:30:00Z'))).toBe('2026-11-24');
    expect(hoyEnZona(Date.parse('2026-11-25T02:59:59Z'))).toBe('2026-11-24');
  });

  it('desde las 00:00 AR (03:00 UTC) es el día siguiente', () => {
    expect(hoyEnZona(Date.parse('2026-11-25T03:00:00Z'))).toBe('2026-11-25');
    expect(hoyEnZona(Date.parse('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
  });

  it('siguienteDia cruza mes y año', () => {
    expect(siguienteDia('2026-11-30')).toBe('2026-12-01');
    expect(siguienteDia('2026-12-31')).toBe('2027-01-01');
    expect(siguienteDia('2028-02-28')).toBe('2028-02-29');
    expect(siguienteDia('2026-02-30')).toBeNull();
  });
});

describe('independencia de la zona horaria del entorno (V-D4)', () => {
  const ZONAS_ENTORNO = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Europe/Madrid', 'America/Argentina/Buenos_Aires'];

  function offsetLocalDelProceso(): number {
    // Offset del proceso para una fecha fija: prueba que cambiar TZ realmente afecta a Date.
    return new Date(Date.UTC(2026, 10, 24, 12, 0)).getTimezoneOffset();
  }

  it('cambiar process.env.TZ cambia efectivamente la zona local del proceso', () => {
    const offsets = new Set<number>();
    for (const zona of ZONAS_ENTORNO) {
      env['TZ'] = zona;
      offsets.add(offsetLocalDelProceso());
    }
    // UTC 0, Tokio -540, LA 480, Madrid -60, AR 180: cinco offsets distintos.
    expect(offsets.size).toBe(ZONAS_ENTORNO.length);
  });

  it.each(ZONAS_ENTORNO)('con TZ=%s las conversiones nocturnas dan el mismo resultado', (zona) => {
    env['TZ'] = zona;
    expect(aInstanteUtc('2026-11-24', '21:00')).toBe('2026-11-25T00:00:00Z');
    expect(aInstanteUtc('2026-11-24', '23:30')).toBe('2026-11-25T02:30:00Z');
    expect(aInstanteUtc('2026-11-24', '23:59')).toBe('2026-11-25T02:59:00Z');
    expect(aFechaHoraLocal('2026-11-25T02:59:00Z')).toEqual({ fecha: '2026-11-24', hora: '23:59' });
    expect(hoyEnZona(Date.parse('2026-11-25T02:30:00Z'))).toBe('2026-11-24');
    expect(formatearFechaHora('2026-11-25T00:00:00Z')).toBe('24/11/2026 21:00');
  });
});
