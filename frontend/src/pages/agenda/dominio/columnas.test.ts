import { describe, expect, it } from 'vitest';
import { BLOQUEO_CONSULTORIO, BLOQUEO_SILLON, SILLON_1, SILLON_2, SILLON_INACTIVO } from '../../../api/__fixtures__/agendaConfig';
import {
  TURNO_CRUCE_MEDIANOCHE,
  TURNO_NOCTURNO,
  TURNO_PROGRAMADO,
  TURNO_SILLON_INACTIVO,
} from '../../../api/__fixtures__/turnos';
import type { Bloqueo, Turno } from '../../../api/types';
import { armarColumnas } from './columnas';

const BLOQUEO_SILLON_2: Bloqueo = { ...BLOQUEO_SILLON, id: 40, sillonId: 2, inicio: '2026-11-24T15:00:00Z', fin: '2026-11-24T16:00:00Z' };
const BLOQUEO_TODO: Bloqueo = { ...BLOQUEO_CONSULTORIO, id: 41, sillonId: null, inicio: '2026-11-24T15:00:00Z', fin: '2026-11-24T16:00:00Z' };
const T2: Turno = { ...TURNO_PROGRAMADO, id: 200, sillonId: 2 };

function dia(over: Partial<Parameters<typeof armarColumnas>[0]> = {}) {
  return armarColumnas({
    vista: 'dia',
    fecha: '2026-11-24',
    sillones: [SILLON_1, SILLON_2, SILLON_INACTIVO],
    turnos: [],
    bloqueos: [],
    filtroSillonId: null,
    ...over,
  });
}

describe('armarColumnas: vista diaria', () => {
  it('una columna por sillón activo, en orden', () => {
    expect(dia().map((c) => c.titulo)).toEqual(['Sillón 1', 'Sillón 2']);
    expect(dia().map((c) => c.sillonId)).toEqual([1, 2]);
  });

  it('cada turno va a la columna de su sillón con su segmento del día', () => {
    const cols = dia({ turnos: [TURNO_PROGRAMADO, T2] });
    expect(cols[0]?.turnos.map((t) => t.turno.id)).toEqual([100]);
    expect(cols[1]?.turnos.map((t) => t.turno.id)).toEqual([200]);
    expect(cols[0]?.turnos[0]?.segmento).toMatchObject({ inicioMin: 600, finMin: 630 });
  });

  it('un sillón inactivo referido por un turno agrega su columna (nombre conocido, marcado inactivo)', () => {
    const cols = dia({ turnos: [TURNO_SILLON_INACTIVO] });
    expect(cols.map((c) => c.titulo)).toEqual(['Sillón 1', 'Sillón 2', 'Sillón viejo (inactivo)']);
    expect(cols[2]?.turnos).toHaveLength(1);
  });

  it('un sillón desconocido se llama "Sillón {id}"', () => {
    const cols = dia({ sillones: [SILLON_1], turnos: [{ ...TURNO_PROGRAMADO, sillonId: 9 }] });
    expect(cols.map((c) => c.titulo)).toEqual(['Sillón 1', 'Sillón 9']);
  });

  it('el filtro deja solo ese sillón', () => {
    expect(dia({ filtroSillonId: 2 }).map((c) => c.titulo)).toEqual(['Sillón 2']);
  });

  it('el nocturno (22:30 AR, en UTC del día siguiente) cae en el día del consultorio', () => {
    expect(dia({ turnos: [TURNO_NOCTURNO] })[0]?.turnos[0]?.segmento).toMatchObject({ inicioMin: 1350, finMin: 1380 });
    expect(dia({ fecha: '2026-11-25', turnos: [TURNO_NOCTURNO] })[0]?.turnos).toHaveLength(0);
  });

  it('el cruce de medianoche aparece en ambos días con sus marcas', () => {
    expect(dia({ turnos: [TURNO_CRUCE_MEDIANOCHE] })[0]?.turnos[0]?.segmento.continua).toBe(true);
    expect(dia({ fecha: '2026-11-25', turnos: [TURNO_CRUCE_MEDIANOCHE] })[0]?.turnos[0]?.segmento.vieneDeAntes).toBe(true);
  });

  it('bloqueo de un sillón: solo en su columna; bloqueo del consultorio: en todas', () => {
    const solo = dia({ bloqueos: [BLOQUEO_SILLON_2] });
    expect(solo[0]?.bloqueos).toEqual([]);
    expect(solo[1]?.bloqueos).toEqual([{ inicioMin: 720, finMin: 780 }]);
    const todos = dia({ bloqueos: [BLOQUEO_TODO] });
    expect(todos.map((c) => c.bloqueos.length)).toEqual([1, 1]);
  });

  it('un bloqueo de otro día no aparece', () => {
    expect(dia({ bloqueos: [BLOQUEO_CONSULTORIO] }).every((c) => c.bloqueos.length === 0)).toBe(true);
  });
});

describe('armarColumnas: vista semanal', () => {
  const semana = (over: Partial<Parameters<typeof armarColumnas>[0]> = {}) =>
    armarColumnas({
      vista: 'semana',
      fecha: '2026-11-25',
      sillones: [SILLON_1, SILLON_2],
      turnos: [],
      bloqueos: [],
      filtroSillonId: null,
      ...over,
    });

  it('siete columnas, lunes 23/11 a domingo 29/11', () => {
    const cols = semana();
    expect(cols.map((c) => c.fecha)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
    expect(cols[0]?.titulo).toBe('lunes 23/11');
    expect(cols[6]?.titulo).toBe('domingo 29/11');
  });

  it('con "Todos" conviven los turnos de distintos sillones en la columna del día', () => {
    const cols = semana({ turnos: [TURNO_PROGRAMADO, T2] });
    expect(cols[1]?.turnos.map((t) => t.turno.id)).toEqual([100, 200]);
    expect(cols[1]?.sillonId).toBeNull();
  });

  it('el filtro de sillón queda en cada columna', () => {
    expect(semana({ filtroSillonId: 2 }).every((c) => c.sillonId === 2)).toBe(true);
  });

  it('con "Todos" solo se sombrean los bloqueos de todo el consultorio; con filtro, también los del sillón', () => {
    expect(semana({ bloqueos: [BLOQUEO_SILLON_2] })[1]?.bloqueos).toEqual([]);
    expect(semana({ bloqueos: [BLOQUEO_TODO] })[1]?.bloqueos).toEqual([{ inicioMin: 720, finMin: 780 }]);
    expect(semana({ bloqueos: [BLOQUEO_SILLON_2], filtroSillonId: 2 })[1]?.bloqueos).toEqual([{ inicioMin: 720, finMin: 780 }]);
    expect(semana({ bloqueos: [BLOQUEO_SILLON_2], filtroSillonId: 1 })[1]?.bloqueos).toEqual([]);
  });

  it('el turno que cruza la medianoche está en dos columnas', () => {
    const cols = semana({ turnos: [TURNO_CRUCE_MEDIANOCHE] });
    expect(cols.filter((c) => c.turnos.length > 0).map((c) => c.fecha)).toEqual(['2026-11-24', '2026-11-25']);
  });
});
