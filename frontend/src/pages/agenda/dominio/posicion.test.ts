import { afterEach, describe, expect, it } from 'vitest';
import { asignarCarriles, calcularPosicion, segmentarPorDia } from './posicion';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env['TZ'];

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete env['TZ'];
  else env['TZ'] = ORIGINAL_TZ;
});

const hm = (h: number, m = 0): number => h * 60 + m;

describe('calcularPosicion', () => {
  it('turno de 30 min 09:00–09:30 con franja desde 08:00 y grilla 15 → quinta fila, dos filas', () => {
    expect(calcularPosicion({ inicioMin: hm(9), finMin: hm(9, 30) }, { franjaInicioMin: hm(8), minutosGrilla: 15 })).toEqual({
      fila: 5,
      filas: 2,
    });
  });

  it('con grilla de 10 → séptima fila, tres filas', () => {
    expect(calcularPosicion({ inicioMin: hm(9), finMin: hm(9, 30) }, { franjaInicioMin: hm(8), minutosGrilla: 10 })).toEqual({
      fila: 7,
      filas: 3,
    });
  });

  it('el primer turno de la franja arranca en la fila 1', () => {
    expect(calcularPosicion({ inicioMin: hm(8), finMin: hm(8, 15) }, { franjaInicioMin: hm(8), minutosGrilla: 15 })).toEqual({
      fila: 1,
      filas: 1,
    });
  });

  it('no alineado (09:10–09:20): ocupa las dos filas que lo cubren', () => {
    expect(calcularPosicion({ inicioMin: hm(9, 10), finMin: hm(9, 20) }, { franjaInicioMin: hm(8), minutosGrilla: 15 })).toEqual({
      fila: 5,
      filas: 2,
    });
  });

  it('no alineado dentro de una sola fila (09:02–09:12) → una fila', () => {
    expect(calcularPosicion({ inicioMin: hm(9, 2), finMin: hm(9, 12) }, { franjaInicioMin: hm(8), minutosGrilla: 15 })).toEqual({
      fila: 5,
      filas: 1,
    });
  });

  it('duración menor que la grilla (5 min alineado) → una fila, nunca cero', () => {
    expect(calcularPosicion({ inicioMin: hm(9), finMin: hm(9, 5) }, { franjaInicioMin: hm(8), minutosGrilla: 15 })).toEqual({
      fila: 5,
      filas: 1,
    });
  });

  it('turno de 45 min alineado → tres filas', () => {
    expect(calcularPosicion({ inicioMin: hm(19), finMin: hm(19, 45) }, { franjaInicioMin: hm(9), minutosGrilla: 15 })).toEqual({
      fila: 41,
      filas: 3,
    });
  });
});

describe('segmentarPorDia', () => {
  it('turno diurno: minutos del día en hora del consultorio, sin marcas', () => {
    expect(segmentarPorDia({ inicio: '2026-11-24T13:00:00Z', fin: '2026-11-24T13:30:00Z' }, '2026-11-24')).toEqual({
      inicioMin: hm(10),
      finMin: hm(10, 30),
      continua: false,
      vieneDeAntes: false,
    });
  });

  it('nocturno 22:30–23:00 AR (cae en el día siguiente en UTC) pertenece al día del consultorio', () => {
    const turno = { inicio: '2026-11-25T01:30:00Z', fin: '2026-11-25T02:00:00Z' };
    expect(segmentarPorDia(turno, '2026-11-24')).toEqual({ inicioMin: hm(22, 30), finMin: hm(23), continua: false, vieneDeAntes: false });
    expect(segmentarPorDia(turno, '2026-11-25')).toBeNull();
  });

  it('cruza la medianoche: 23:30 → 00:15 se parte en dos días con marcas', () => {
    const turno = { inicio: '2026-11-25T02:30:00Z', fin: '2026-11-25T03:15:00Z' };
    expect(segmentarPorDia(turno, '2026-11-24')).toEqual({ inicioMin: hm(23, 30), finMin: 1440, continua: true, vieneDeAntes: false });
    expect(segmentarPorDia(turno, '2026-11-25')).toEqual({ inicioMin: 0, finMin: 15, continua: false, vieneDeAntes: true });
  });

  it('un turno que termina justo a las 00:00 no toca el día siguiente', () => {
    const turno = { inicio: '2026-11-25T02:30:00Z', fin: '2026-11-25T03:00:00Z' };
    expect(segmentarPorDia(turno, '2026-11-24')).toEqual({ inicioMin: hm(23, 30), finMin: 1440, continua: false, vieneDeAntes: false });
    expect(segmentarPorDia(turno, '2026-11-25')).toBeNull();
  });

  it('un turno que abarca todo un día intermedio ocupa 00:00–24:00 con ambas marcas', () => {
    const turno = { inicio: '2026-11-24T15:00:00Z', fin: '2026-11-26T15:00:00Z' };
    expect(segmentarPorDia(turno, '2026-11-25')).toEqual({ inicioMin: 0, finMin: 1440, continua: true, vieneDeAntes: true });
  });

  it('instante inválido o fecha inválida → null', () => {
    expect(segmentarPorDia({ inicio: 'x', fin: '2026-11-24T13:30:00Z' }, '2026-11-24')).toBeNull();
    expect(segmentarPorDia({ inicio: '2026-11-24T13:00:00Z', fin: '2026-11-24T13:30:00Z' }, 'no')).toBeNull();
  });

  it.each(['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Europe/Madrid', 'America/Argentina/Buenos_Aires'])(
    'con TZ=%s el resultado es el mismo (V-D4)',
    (zona) => {
      env['TZ'] = zona;
      const turno = { inicio: '2026-11-25T02:30:00Z', fin: '2026-11-25T03:15:00Z' };
      expect(segmentarPorDia(turno, '2026-11-24')).toEqual({ inicioMin: hm(23, 30), finMin: 1440, continua: true, vieneDeAntes: false });
      expect(segmentarPorDia(turno, '2026-11-25')).toEqual({ inicioMin: 0, finMin: 15, continua: false, vieneDeAntes: true });
    },
  );
});

describe('asignarCarriles', () => {
  const seg = (inicio: number, fin: number) => ({ inicioMin: inicio, finMin: fin });

  it('sin solapes → un carril cada uno', () => {
    expect(asignarCarriles([seg(hm(9), hm(9, 30)), seg(hm(10), hm(10, 30))])).toEqual([
      { carril: 0, carriles: 1 },
      { carril: 0, carriles: 1 },
    ]);
  });

  it('dos solapados (cancelado y su reemplazo) → dos carriles, lado a lado', () => {
    expect(asignarCarriles([seg(hm(10), hm(10, 30)), seg(hm(10), hm(10, 30))])).toEqual([
      { carril: 0, carriles: 2 },
      { carril: 1, carriles: 2 },
    ]);
  });

  it('cadena adyacente [a,b) [b,c) → un carril (no se solapan)', () => {
    expect(asignarCarriles([seg(hm(9), hm(9, 30)), seg(hm(9, 30), hm(10))])).toEqual([
      { carril: 0, carriles: 1 },
      { carril: 0, carriles: 1 },
    ]);
  });

  it('respeta el orden de entrada aunque lleguen desordenados', () => {
    expect(asignarCarriles([seg(hm(10, 15), hm(10, 45)), seg(hm(10), hm(10, 30))])).toEqual([
      { carril: 1, carriles: 2 },
      { carril: 0, carriles: 2 },
    ]);
  });

  it('un grupo de tres solapados usa tres carriles; un turno aparte no se ensancha', () => {
    const r = asignarCarriles([
      seg(hm(9), hm(10)),
      seg(hm(9, 15), hm(9, 45)),
      seg(hm(9, 30), hm(10, 30)),
      seg(hm(11), hm(11, 30)),
    ]);
    expect(r).toEqual([
      { carril: 0, carriles: 3 },
      { carril: 1, carriles: 3 },
      { carril: 2, carriles: 3 },
      { carril: 0, carriles: 1 },
    ]);
  });

  it('reutiliza un carril libre: A(9–10) y C(9:45–10:15) comparten con B(10–10:30) en dos carriles', () => {
    const r = asignarCarriles([seg(hm(9), hm(10)), seg(hm(10), hm(10, 30)), seg(hm(9, 45), hm(10, 15))]);
    expect(r.map((x) => x.carriles)).toEqual([2, 2, 2]);
    expect(r[0]?.carril).toBe(0);
    expect(r[1]?.carril).toBe(0);
    expect(r[2]?.carril).toBe(1);
  });

  it('lista vacía → vacía', () => {
    expect(asignarCarriles([])).toEqual([]);
  });
});
