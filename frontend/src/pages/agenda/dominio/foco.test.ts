import { afterEach, describe, expect, it } from 'vitest';
import { anuncioCambio, focoTrasCambio, sigueVisible, type EntradaGrilla, type EntradaLista, type VistaRenderizada } from './foco';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env['TZ'];
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete env['TZ'];
  else env['TZ'] = ORIGINAL_TZ;
});

const hm = (h: number, m = 0): number => h * 60 + m;
const g = (id: number, columna: number, inicioMin: number, carril = 0): EntradaGrilla => ({ id, columna, inicioMin, carril });
const l = (id: number, fecha = '2026-11-24'): EntradaLista => ({ id, fecha });
const vista = (grilla: readonly EntradaGrilla[] | null, lista: readonly EntradaLista[] = [], fechas: readonly string[] = ['2026-11-24']): VistaRenderizada => ({
  grilla,
  lista,
  fechas,
});

describe('focoTrasCambio con origen grilla (6.5)', () => {
  it('sigue renderizado (cambió de hora): el mismo turno', () => {
    const antes = vista([g(1, 0, hm(10))]);
    const despues = vista([g(1, 0, hm(11))]);
    expect(focoTrasCambio(antes, despues, 1, 'grilla')).toEqual({ tipo: 'turno', id: 1 });
  });

  it('sigue renderizado en otra columna (cambió de sillón): el mismo turno', () => {
    expect(focoTrasCambio(vista([g(1, 0, hm(10))]), vista([g(1, 1, hm(10))]), 1, 'grilla')).toEqual({ tipo: 'turno', id: 1 });
  });

  it('desaparece: el siguiente por inicio de su columna original', () => {
    const antes = vista([g(1, 0, hm(9)), g(2, 0, hm(10)), g(3, 0, hm(11))]);
    const despues = vista([g(1, 0, hm(9)), g(3, 0, hm(11))]);
    expect(focoTrasCambio(antes, despues, 2, 'grilla')).toEqual({ tipo: 'turno', id: 3 });
  });

  it('desaparece el último de la columna: el anterior', () => {
    const antes = vista([g(1, 0, hm(9)), g(2, 0, hm(10))]);
    const despues = vista([g(1, 0, hm(9))]);
    expect(focoTrasCambio(antes, despues, 2, 'grilla')).toEqual({ tipo: 'turno', id: 1 });
  });

  it('desaparece el primero con varios: el siguiente, no el último', () => {
    const antes = vista([g(1, 0, hm(9)), g(2, 0, hm(10)), g(3, 0, hm(11))]);
    const despues = vista([g(2, 0, hm(10)), g(3, 0, hm(11))]);
    expect(focoTrasCambio(antes, despues, 1, 'grilla')).toEqual({ tipo: 'turno', id: 2 });
  });

  it('con el mismo inicio decide el carril', () => {
    const antes = vista([g(1, 0, hm(10), 0), g(2, 0, hm(10), 1), g(3, 0, hm(11))]);
    const despues = vista([g(2, 0, hm(10), 1), g(3, 0, hm(11))]);
    expect(focoTrasCambio(antes, despues, 1, 'grilla')).toEqual({ tipo: 'turno', id: 2 });
  });

  it('columna vacía: el turno de inicio más cercano de la columna adyacente', () => {
    const antes = vista([g(1, 0, hm(10)), g(2, 1, hm(9)), g(3, 1, hm(10, 15))]);
    const despues = vista([g(2, 1, hm(9)), g(3, 1, hm(10, 15))]);
    expect(focoTrasCambio(antes, despues, 1, 'grilla')).toEqual({ tipo: 'turno', id: 3 });
  });

  it('empate de distancia entre columnas: la de la izquierda', () => {
    const antes = vista([g(10, 0, hm(9)), g(11, 1, hm(10)), g(12, 2, hm(11))]);
    const despues = vista([g(10, 0, hm(9)), g(12, 2, hm(11))]);
    expect(focoTrasCambio(antes, despues, 11, 'grilla')).toEqual({ tipo: 'turno', id: 10 });
  });

  it('salta las columnas vacías hasta la más cercana con turnos', () => {
    const antes = vista([g(1, 0, hm(10)), g(2, 3, hm(10))]);
    const despues = vista([g(2, 3, hm(10))]);
    expect(focoTrasCambio(antes, despues, 1, 'grilla')).toEqual({ tipo: 'turno', id: 2 });
  });

  it('en la columna adyacente, empate de inicio: el más temprano', () => {
    const antes = vista([g(1, 0, hm(10)), g(2, 1, hm(9, 30)), g(3, 1, hm(10, 30))]);
    const despues = vista([g(2, 1, hm(9, 30)), g(3, 1, hm(10, 30))]);
    expect(focoTrasCambio(antes, despues, 1, 'grilla')).toEqual({ tipo: 'turno', id: 2 });
  });

  it('vista vacía: el contenedor de la grilla', () => {
    expect(focoTrasCambio(vista([g(1, 0, hm(10))]), vista([]), 1, 'grilla')).toEqual({ tipo: 'grupo' });
  });

  it('sin grilla renderizada: el h1 como último recurso', () => {
    expect(focoTrasCambio(vista(null), vista(null), 1, 'grilla')).toEqual({ tipo: 'h1' });
  });

  it('un turno que no estaba en la vista anterior: el primero cronológico, o el grupo si no queda ninguno', () => {
    const despues = vista([g(5, 1, hm(8)), g(6, 0, hm(9))]);
    expect(focoTrasCambio(vista([]), despues, 99, 'grilla')).toEqual({ tipo: 'turno', id: 5 });
    expect(focoTrasCambio(vista([]), vista([]), 99, 'grilla')).toEqual({ tipo: 'grupo' });
  });
});

describe('focoTrasCambio con origen lista (6.5)', () => {
  const dias = ['2026-11-23', '2026-11-24', '2026-11-25'];

  it('sigue en la lista: el mismo ítem', () => {
    const antes = vista([], [l(1), l(2)], dias);
    const despues = vista([], [l(2), l(1)], dias);
    expect(focoTrasCambio(antes, despues, 1, 'lista')).toEqual({ tipo: 'turno', id: 1 });
  });

  it('desaparece: el siguiente ítem de su día', () => {
    const antes = vista([], [l(1), l(2), l(3)], dias);
    const despues = vista([], [l(1), l(3)], dias);
    expect(focoTrasCambio(antes, despues, 2, 'lista')).toEqual({ tipo: 'turno', id: 3 });
  });

  it('desaparece el último del día: el anterior', () => {
    const antes = vista([], [l(1), l(2)], dias);
    const despues = vista([], [l(1)], dias);
    expect(focoTrasCambio(antes, despues, 2, 'lista')).toEqual({ tipo: 'turno', id: 1 });
  });

  it('no salta a otro día: con un solo turno en su día va al encabezado del día', () => {
    const antes = vista([], [l(1, '2026-11-24'), l(2, '2026-11-25')], dias);
    const despues = vista([], [l(2, '2026-11-25')], dias);
    expect(focoTrasCambio(antes, despues, 1, 'lista')).toEqual({ tipo: 'diaLista', fecha: '2026-11-24' });
  });

  it('día vacío en la vista de un solo día', () => {
    expect(focoTrasCambio(vista([], [l(1)]), vista([], []), 1, 'lista')).toEqual({ tipo: 'diaLista', fecha: '2026-11-24' });
  });

  it('si el día ya no está en la vista: el h1', () => {
    expect(focoTrasCambio(vista([], [l(1)], ['2026-11-24']), vista([], [], []), 1, 'lista')).toEqual({ tipo: 'h1' });
  });

  it('un turno que no estaba en la lista anterior: el h1', () => {
    expect(focoTrasCambio(vista([], []), vista([], [], ['2026-11-24']), 9, 'lista')).toEqual({ tipo: 'h1' });
  });

  it('la lista ignora la grilla: el foco por lista no depende de las columnas', () => {
    const antes = vista([g(1, 0, hm(10)), g(7, 1, hm(10))], [l(1), l(2)]);
    const despues = vista([g(7, 1, hm(10))], [l(2)]);
    // Por grilla iría al 7 (columna adyacente); por lista, al siguiente ítem del día.
    expect(focoTrasCambio(antes, despues, 1, 'lista')).toEqual({ tipo: 'turno', id: 2 });
    expect(focoTrasCambio(antes, despues, 1, 'grilla')).toEqual({ tipo: 'turno', id: 7 });
  });
});

describe('sigueVisible', () => {
  it('mira la grilla o la lista', () => {
    const v = vista([g(1, 0, hm(9))], [l(2)]);
    expect(sigueVisible(v, 1)).toBe(true);
    expect(sigueVisible(v, 2)).toBe(true);
    expect(sigueVisible(v, 3)).toBe(false);
    expect(sigueVisible(vista(null), 1)).toBe(false);
  });
});

describe('anuncioCambio (6.5)', () => {
  it.each([
    ['CONFIRMADO', 'Turno confirmado.'],
    ['CANCELADO', 'Turno cancelado.'],
    ['ASISTIO', 'Asistencia registrada.'],
    ['AUSENTE', 'Ausencia registrada.'],
  ] as const)('estado %s → %s', (estado, texto) => {
    expect(anuncioCambio({ tipo: 'estado', estado })).toBe(texto);
  });

  it('reprogramado dentro de la vista: día, hora del consultorio', () => {
    expect(anuncioCambio({ tipo: 'reprogramado', inicio: '2026-11-24T14:00:00Z', sillonNombre: null, fueraDeVista: false })).toBe(
      'Turno reprogramado al martes 24/11 a las 11:00.',
    );
  });

  it('con cambio de sillón agrega " en {sillón}"', () => {
    expect(anuncioCambio({ tipo: 'reprogramado', inicio: '2026-11-24T14:00:00Z', sillonNombre: 'Sillón 2', fueraDeVista: false })).toBe(
      'Turno reprogramado al martes 24/11 a las 11:00 en Sillón 2.',
    );
  });

  it('fuera de la vista agrega "; quedó fuera de esta vista."', () => {
    expect(anuncioCambio({ tipo: 'reprogramado', inicio: '2026-11-26T13:00:00Z', sillonNombre: null, fueraDeVista: true })).toBe(
      'Turno reprogramado al jueves 26/11 a las 10:00; quedó fuera de esta vista.',
    );
    expect(anuncioCambio({ tipo: 'reprogramado', inicio: '2026-11-26T13:00:00Z', sillonNombre: 'Sillón 2', fueraDeVista: true })).toBe(
      'Turno reprogramado al jueves 26/11 a las 10:00 en Sillón 2; quedó fuera de esta vista.',
    );
  });

  it('un turno nocturno se anuncia en el día del consultorio, no el de UTC', () => {
    expect(anuncioCambio({ tipo: 'reprogramado', inicio: '2026-11-25T01:30:00Z', sillonNombre: null, fueraDeVista: false })).toBe(
      'Turno reprogramado al martes 24/11 a las 22:30.',
    );
  });

  it.each(['Asia/Tokyo', 'America/Los_Angeles'])('con TZ=%s el anuncio es el mismo', (zona) => {
    env['TZ'] = zona;
    expect(anuncioCambio({ tipo: 'reprogramado', inicio: '2026-11-26T13:00:00Z', sillonNombre: null, fueraDeVista: true })).toBe(
      'Turno reprogramado al jueves 26/11 a las 10:00; quedó fuera de esta vista.',
    );
  });

  it('un instante inválido no rompe: anuncio genérico de reprogramación', () => {
    expect(anuncioCambio({ tipo: 'reprogramado', inicio: 'nada', sillonNombre: null, fueraDeVista: false })).toBe('Turno reprogramado.');
  });
});
