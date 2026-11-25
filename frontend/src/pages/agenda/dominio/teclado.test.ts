import { describe, expect, it } from 'vitest';
import { siguienteTurno, type EntradaTeclado } from './teclado';

const hm = (h: number, m = 0): number => h * 60 + m;
const e = (id: number, columna: number, inicioMin: number, carril = 0): EntradaTeclado => ({ id, columna, inicioMin, carril });

// Columna 0: turnos 1 (09:00), 2 (10:00), 3 (11:00). Columna 1: 4 (09:30), 5 (10:45). Columna 2 vacía. Columna 3: 6 (08:00), 7 (12:00).
const MAPA: readonly EntradaTeclado[] = [e(1, 0, hm(9)), e(2, 0, hm(10)), e(3, 0, hm(11)), e(4, 1, hm(9, 30)), e(5, 1, hm(10, 45)), e(6, 3, hm(8)), e(7, 3, hm(12))];

describe('siguienteTurno: Arriba y Abajo (misma columna)', () => {
  it('Abajo va al siguiente por hora de inicio', () => {
    expect(siguienteTurno(MAPA, 1, 'ArrowDown')).toBe(2);
    expect(siguienteTurno(MAPA, 2, 'ArrowDown')).toBe(3);
  });

  it('Arriba va al anterior', () => {
    expect(siguienteTurno(MAPA, 3, 'ArrowUp')).toBe(2);
    expect(siguienteTurno(MAPA, 2, 'ArrowUp')).toBe(1);
  });

  it('en los bordes no se mueve (no envuelve)', () => {
    expect(siguienteTurno(MAPA, 3, 'ArrowDown')).toBe(3);
    expect(siguienteTurno(MAPA, 1, 'ArrowUp')).toBe(1);
  });

  it('no depende del orden del mapa de entrada', () => {
    const desordenado = [...MAPA].reverse();
    expect(siguienteTurno(desordenado, 1, 'ArrowDown')).toBe(2);
    expect(siguienteTurno(desordenado, 3, 'ArrowUp')).toBe(2);
  });

  it('empate de inicio: se ordena por carril', () => {
    const mapa = [e(10, 0, hm(10), 1), e(11, 0, hm(10), 0), e(12, 0, hm(11))];
    expect(siguienteTurno(mapa, 11, 'ArrowDown')).toBe(10);
    expect(siguienteTurno(mapa, 10, 'ArrowDown')).toBe(12);
    expect(siguienteTurno(mapa, 10, 'ArrowUp')).toBe(11);
  });
});

describe('siguienteTurno: Inicio y Fin', () => {
  it('Inicio va al primero de la columna y Fin al último', () => {
    expect(siguienteTurno(MAPA, 2, 'Home')).toBe(1);
    expect(siguienteTurno(MAPA, 2, 'End')).toBe(3);
    expect(siguienteTurno(MAPA, 5, 'Home')).toBe(4);
    expect(siguienteTurno(MAPA, 6, 'End')).toBe(7);
  });

  it('ya en el primero/último: se queda', () => {
    expect(siguienteTurno(MAPA, 1, 'Home')).toBe(1);
    expect(siguienteTurno(MAPA, 3, 'End')).toBe(3);
  });
});

describe('siguienteTurno: Izquierda y Derecha (columna adyacente con turnos)', () => {
  it('Derecha va al inicio más cercano de la columna siguiente', () => {
    // El turno 2 empieza 10:00; en la columna 1 están 09:30 (30 min) y 10:45 (45 min).
    expect(siguienteTurno(MAPA, 2, 'ArrowRight')).toBe(4);
    // El turno 3 empieza 11:00; 10:45 está a 15 min.
    expect(siguienteTurno(MAPA, 3, 'ArrowRight')).toBe(5);
  });

  it('Izquierda va a la columna anterior', () => {
    expect(siguienteTurno(MAPA, 5, 'ArrowLeft')).toBe(3);
    expect(siguienteTurno(MAPA, 4, 'ArrowLeft')).toBe(1);
  });

  it('salta las columnas vacías (la 2 no tiene turnos)', () => {
    // Desde la columna 1, Derecha va a la 3: 10:45 → más cercano entre 08:00 (165) y 12:00 (75).
    expect(siguienteTurno(MAPA, 5, 'ArrowRight')).toBe(7);
    expect(siguienteTurno(MAPA, 6, 'ArrowLeft')).toBe(4);
  });

  it('en el borde izquierdo o derecho no se mueve', () => {
    expect(siguienteTurno(MAPA, 1, 'ArrowLeft')).toBe(1);
    expect(siguienteTurno(MAPA, 7, 'ArrowRight')).toBe(7);
  });

  it('empate de distancia: elige el más temprano', () => {
    // Turno a las 10:00; en la otra columna hay turnos a 09:30 y 10:30 (ambos a 30 min).
    const mapa = [e(1, 0, hm(10)), e(2, 1, hm(10, 30)), e(3, 1, hm(9, 30))];
    expect(siguienteTurno(mapa, 1, 'ArrowRight')).toBe(3);
  });

  it('columna única: Izquierda y Derecha no mueven', () => {
    const mapa = [e(1, 0, hm(9)), e(2, 0, hm(10))];
    expect(siguienteTurno(mapa, 1, 'ArrowLeft')).toBe(1);
    expect(siguienteTurno(mapa, 1, 'ArrowRight')).toBe(1);
  });

  it('las columnas pueden no ser contiguas ni empezar en cero', () => {
    const mapa = [e(1, 4, hm(9)), e(2, 9, hm(9, 10))];
    expect(siguienteTurno(mapa, 1, 'ArrowRight')).toBe(2);
    expect(siguienteTurno(mapa, 2, 'ArrowLeft')).toBe(1);
  });
});

describe('siguienteTurno: casos límite', () => {
  it('mapa vacío → null', () => {
    expect(siguienteTurno([], 1, 'ArrowDown')).toBeNull();
  });

  it('turno actual que no está en el mapa → null', () => {
    expect(siguienteTurno(MAPA, 99, 'ArrowDown')).toBeNull();
  });

  it('un solo turno: ninguna tecla lo mueve', () => {
    const mapa = [e(1, 0, hm(9))];
    for (const tecla of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'] as const) {
      expect(siguienteTurno(mapa, 1, tecla)).toBe(1);
    }
  });
});
