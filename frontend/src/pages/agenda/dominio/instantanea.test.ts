import { describe, expect, it } from 'vitest';
import { SILLON_1, SILLON_2 } from '../../../api/__fixtures__/agendaConfig';
import { TURNO_CRUCE_MEDIANOCHE, TURNO_PROGRAMADO } from '../../../api/__fixtures__/turnos';
import type { Turno } from '../../../api/types';
import { armarColumnas } from './columnas';
import { instantaneaVista } from './instantanea';

const t = (id: number, inicio: string, fin: string, sillonId = 1): Turno => ({ ...TURNO_PROGRAMADO, id, inicio, fin, sillonId });
// 24/11: 09:00 = 12:00Z, 10:00 = 13:00Z.
const A = t(1, '2026-11-24T13:00:00Z', '2026-11-24T13:30:00Z');
const B = t(2, '2026-11-24T12:00:00Z', '2026-11-24T12:30:00Z');
const C = t(3, '2026-11-24T13:00:00Z', '2026-11-24T13:30:00Z', 2);

function dia(turnos: readonly Turno[]) {
  const columnas = armarColumnas({ vista: 'dia', fecha: '2026-11-24', sillones: [SILLON_1, SILLON_2], turnos, bloqueos: [], filtroSillonId: null });
  return instantaneaVista({ columnas, turnos, fechas: ['2026-11-24'] });
}

describe('instantaneaVista', () => {
  it('la grilla lista cada bloque con su columna, inicio y carril', () => {
    expect([...(dia([A, B, C]).grilla ?? [])].sort((x, y) => x.id - y.id)).toEqual([
      { id: 1, columna: 0, inicioMin: 600, carril: 0 },
      { id: 2, columna: 0, inicioMin: 540, carril: 0 },
      { id: 3, columna: 1, inicioMin: 600, carril: 0 },
    ]);
  });

  it('turnos superpuestos en una columna reciben carriles distintos', () => {
    const reemplazo = t(9, '2026-11-24T13:00:00Z', '2026-11-24T13:30:00Z');
    const grilla = dia([A, reemplazo]).grilla ?? [];
    expect(grilla.map((e) => [e.id, e.carril]).sort()).toEqual([[1, 0], [9, 1]]);
  });

  it('la lista va ordenada por inicio dentro de cada día y lleva su fecha', () => {
    expect(dia([A, B, C]).lista).toEqual([
      { id: 2, fecha: '2026-11-24' },
      { id: 1, fecha: '2026-11-24' },
      { id: 3, fecha: '2026-11-24' },
    ]);
  });

  it('conserva todos los días de la vista aunque no tengan turnos', () => {
    const columnas = armarColumnas({ vista: 'semana', fecha: '2026-11-25', sillones: [SILLON_1], turnos: [A], bloqueos: [], filtroSillonId: null });
    const v = instantaneaVista({ columnas, turnos: [A], fechas: ['2026-11-23', '2026-11-24', '2026-11-25'] });
    expect(v.fechas).toEqual(['2026-11-23', '2026-11-24', '2026-11-25']);
    expect(v.lista).toEqual([{ id: 1, fecha: '2026-11-24' }]);
    expect(v.grilla?.map((e) => e.columna)).toEqual([1]);
  });

  it('un turno que cruza la medianoche está en dos columnas y en dos días de la lista', () => {
    const columnas = armarColumnas({ vista: 'semana', fecha: '2026-11-24', sillones: [SILLON_1], turnos: [TURNO_CRUCE_MEDIANOCHE], bloqueos: [], filtroSillonId: null });
    const v = instantaneaVista({ columnas, turnos: [TURNO_CRUCE_MEDIANOCHE], fechas: ['2026-11-24', '2026-11-25'] });
    expect(v.grilla?.filter((e) => e.id === 107)).toHaveLength(2);
    expect(v.lista.map((e) => e.fecha)).toEqual(['2026-11-24', '2026-11-25']);
  });

  it('sin turnos: grilla y lista vacías pero la vista sigue existiendo', () => {
    const v = dia([]);
    expect(v.grilla).toEqual([]);
    expect(v.lista).toEqual([]);
  });
});
