import { describe, expect, it } from 'vitest';
import { ESTADOS_TURNO } from '../../../api/types';
import { ETIQUETA_ESTADO, esReprogramable, puedeMarcarAsistencia, transicionesPermitidas } from './transiciones';

describe('transicionesPermitidas (RN-AG-05)', () => {
  it('PROGRAMADO → confirmar, cancelar, asistió, ausente', () => {
    expect(transicionesPermitidas('PROGRAMADO')).toEqual(['CONFIRMADO', 'CANCELADO', 'ASISTIO', 'AUSENTE']);
  });

  it('CONFIRMADO → cancelar, asistió, ausente (no vuelve a confirmar)', () => {
    expect(transicionesPermitidas('CONFIRMADO')).toEqual(['CANCELADO', 'ASISTIO', 'AUSENTE']);
  });

  it.each(['CANCELADO', 'ASISTIO', 'AUSENTE'] as const)('%s es final: sin transiciones', (estado) => {
    expect(transicionesPermitidas(estado)).toEqual([]);
  });

  it('ninguna transición lleva de vuelta a PROGRAMADO ni a sí misma', () => {
    for (const estado of ESTADOS_TURNO) {
      const destinos = transicionesPermitidas(estado);
      expect(destinos).not.toContain('PROGRAMADO');
      expect(destinos).not.toContain(estado);
    }
  });
});

describe('esReprogramable', () => {
  it.each([
    ['PROGRAMADO', true],
    ['CONFIRMADO', true],
    ['CANCELADO', false],
    ['ASISTIO', false],
    ['AUSENTE', false],
  ] as const)('%s → %s', (estado, esperado) => {
    expect(esReprogramable(estado)).toBe(esperado);
  });
});

describe('puedeMarcarAsistencia (instantes UTC, sin zona)', () => {
  const turno = { inicio: '2026-11-24T13:00:00Z' };
  const inicioMs = Date.parse('2026-11-24T13:00:00Z');

  it('turno que ya empezó → sí', () => {
    expect(puedeMarcarAsistencia(turno, inicioMs + 60_000)).toBe(true);
  });

  it('justo al inicio → sí', () => {
    expect(puedeMarcarAsistencia(turno, inicioMs)).toBe(true);
  });

  it('un milisegundo antes → no', () => {
    expect(puedeMarcarAsistencia(turno, inicioMs - 1)).toBe(false);
  });

  it('turno futuro → no', () => {
    expect(puedeMarcarAsistencia(turno, Date.parse('2026-11-23T13:00:00Z'))).toBe(false);
  });

  it('instante inválido → no', () => {
    expect(puedeMarcarAsistencia({ inicio: 'x' }, inicioMs)).toBe(false);
  });
});

describe('ETIQUETA_ESTADO', () => {
  it('tiene el texto visible de cada estado', () => {
    expect(ETIQUETA_ESTADO).toEqual({
      PROGRAMADO: 'Programado',
      CONFIRMADO: 'Confirmado',
      CANCELADO: 'Cancelado',
      ASISTIO: 'Asistió',
      AUSENTE: 'Ausente',
    });
  });

  it('cubre todos los estados y sin repetir etiquetas (el color no es la única señal)', () => {
    const etiquetas = ESTADOS_TURNO.map((e) => ETIQUETA_ESTADO[e]);
    expect(new Set(etiquetas).size).toBe(ESTADOS_TURNO.length);
  });
});
