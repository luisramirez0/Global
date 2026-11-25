import { describe, expect, it } from 'vitest';
import { calcularFranja, FRANJA_POR_DEFECTO } from './franja';

const hm = (h: number, m = 0): number => h * 60 + m;
const horario = (horaDesde: string, horaHasta: string) => ({ horaDesde, horaHasta });

describe('calcularFranja', () => {
  it('horarios 09–13 y 14–18 sin turnos fuera → 09:00 a 18:00', () => {
    const franja = calcularFranja([horario('09:00', '13:00'), horario('14:00', '18:00')], [{ inicioMin: hm(10), finMin: hm(10, 30) }], 15);
    expect(franja).toEqual({ inicioMin: hm(9), finMin: hm(18) });
  });

  it('usa el menor inicio y el mayor fin entre todos los horarios, sin importar el orden', () => {
    expect(calcularFranja([horario('14:00', '19:30'), horario('08:30', '12:00')], [], 15)).toEqual({ inicioMin: hm(8, 30), finMin: hm(19, 30) });
  });

  it('sin horarios → 08:00 a 20:00', () => {
    expect(FRANJA_POR_DEFECTO).toEqual({ inicioMin: hm(8), finMin: hm(20) });
    expect(calcularFranja([], [], 15)).toEqual({ inicioMin: hm(8), finMin: hm(20) });
  });

  it('sobreturno 19:00–19:45 con horarios hasta las 18:00 → la franja termina a las 19:45', () => {
    const franja = calcularFranja([horario('09:00', '18:00')], [{ inicioMin: hm(19), finMin: hm(19, 45) }], 15);
    expect(franja).toEqual({ inicioMin: hm(9), finMin: hm(19, 45) });
  });

  it('turno que empieza a las 07:10 → el inicio se redondea hacia afuera a 07:00', () => {
    const franja = calcularFranja([horario('09:00', '18:00')], [{ inicioMin: hm(7, 10), finMin: hm(7, 40) }], 15);
    expect(franja).toEqual({ inicioMin: hm(7), finMin: hm(18) });
  });

  it('el fin también se redondea hacia afuera (19:50 → 20:00)', () => {
    const franja = calcularFranja([horario('09:00', '18:00')], [{ inicioMin: hm(19), finMin: hm(19, 50) }], 15);
    expect(franja.finMin).toBe(hm(20));
  });

  it('un segmento que llega a las 24:00 deja el fin en 24:00', () => {
    const franja = calcularFranja([horario('09:00', '18:00')], [{ inicioMin: hm(23, 30), finMin: 1440 }], 15);
    expect(franja).toEqual({ inicioMin: hm(9), finMin: 1440 });
  });

  it('un segmento desde las 00:00 deja el inicio en 00:00', () => {
    const franja = calcularFranja([horario('09:00', '18:00')], [{ inicioMin: 0, finMin: 15 }], 15);
    expect(franja.inicioMin).toBe(0);
  });

  it('usa el parámetro minutosGrilla: con grilla de 20 el 19:45 sube a 20:00 y el 07:10 baja a 07:00', () => {
    expect(calcularFranja([horario('09:00', '18:00')], [{ inicioMin: hm(19), finMin: hm(19, 45) }], 20).finMin).toBe(hm(20));
    expect(calcularFranja([horario('09:00', '18:00')], [{ inicioMin: hm(7, 10), finMin: hm(7, 40) }], 20).inicioMin).toBe(hm(7));
  });

  it('con grilla de 15 el mismo 19:45 queda en 19:45 (la grilla cambia el resultado)', () => {
    expect(calcularFranja([horario('09:00', '18:00')], [{ inicioMin: hm(19), finMin: hm(19, 45) }], 15).finMin).toBe(hm(19, 45));
  });

  it('un horario no alineado se redondea hacia afuera (09:10–17:50 → 09:00–18:00)', () => {
    expect(calcularFranja([horario('09:10', '17:50')], [], 15)).toEqual({ inicioMin: hm(9), finMin: hm(18) });
  });

  it('ignora horarios con hora mal formada', () => {
    expect(calcularFranja([horario('xx', 'yy')], [], 15)).toEqual({ inicioMin: hm(8), finMin: hm(20) });
  });

  it('turnos dentro del horario no cambian la franja', () => {
    const franja = calcularFranja([horario('09:00', '18:00')], [{ inicioMin: hm(9), finMin: hm(9, 30) }, { inicioMin: hm(17, 30), finMin: hm(18) }], 15);
    expect(franja).toEqual({ inicioMin: hm(9), finMin: hm(18) });
  });
});
