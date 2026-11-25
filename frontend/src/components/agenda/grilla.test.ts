import { afterEach, describe, expect, it, vi } from 'vitest';
import { SILLON_1, SILLON_2, SILLON_INACTIVO } from '../../api/__fixtures__/agendaConfig';
import { TURNO_CRUCE_MEDIANOCHE, TURNO_MALICIOSO, TURNO_PROGRAMADO, TURNO_SILLON_INACTIVO } from '../../api/__fixtures__/turnos';
import type { Bloqueo, Turno } from '../../api/types';
import { armarColumnas } from '../../pages/agenda/dominio/columnas';
import { nombreSillon } from '../../pages/agenda/dominio/columnas';
import { FRANJA_POR_DEFECTO } from '../../pages/agenda/dominio/franja';
import { crearGrilla, type DatosGrilla, type Grilla } from './grilla';

afterEach(() => {
  document.body.replaceChildren();
});

const at = (id: number, inicio: string, fin: string, sillonId = 1, extra: Partial<Turno> = {}): Turno => ({
  ...TURNO_PROGRAMADO,
  id,
  inicio,
  fin,
  sillonId,
  ...extra,
});
// 24/11/2026 (AR = UTC−3): 09:00 = 12:00Z.
const T9 = at(1, '2026-11-24T12:00:00Z', '2026-11-24T12:30:00Z');
const T10 = at(2, '2026-11-24T13:00:00Z', '2026-11-24T13:30:00Z');
const T11 = at(3, '2026-11-24T14:00:00Z', '2026-11-24T14:30:00Z');
const S2_9 = at(4, '2026-11-24T12:00:00Z', '2026-11-24T12:30:00Z', 2);
const S2_1015 = at(5, '2026-11-24T13:15:00Z', '2026-11-24T13:45:00Z', 2);

function datos(turnos: readonly Turno[], over: { vista?: 'dia' | 'semana'; fecha?: string; bloqueos?: Bloqueo[]; filtro?: number | null } = {}): DatosGrilla {
  const sillones = [SILLON_1, SILLON_2, SILLON_INACTIVO];
  const vista = over.vista ?? 'dia';
  return {
    etiqueta: vista === 'dia' ? 'Agenda del 24/11' : 'Agenda de la semana del 23/11',
    columnas: armarColumnas({
      vista,
      fecha: over.fecha ?? '2026-11-24',
      sillones,
      turnos,
      bloqueos: over.bloqueos ?? [],
      filtroSillonId: over.filtro ?? null,
    }),
    franja: { inicioMin: 8 * 60, finMin: 14 * 60 },
    minutosGrilla: 15,
    mostrarSillon: vista === 'semana',
    nombreSillon: (id) => nombreSillon(id, sillones),
  };
}

function montar(d: DatosGrilla) {
  const alAbrirAcciones = vi.fn<(id: number, opener: HTMLElement) => void>();
  const alElegirHueco = vi.fn<(h: { fecha: string; hora: string; sillonId: number | null }) => void>();
  const alEnfocarTurno = vi.fn<(id: number) => void>();
  const grilla = crearGrilla({ alAbrirAcciones, alElegirHueco, alEnfocarTurno });
  grilla.renderizar(d);
  document.body.replaceChildren(grilla.element);
  return { grilla, alAbrirAcciones, alElegirHueco, alEnfocarTurno };
}

const bloques = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-turno-id]')];
const bloque = (id: number): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`[data-turno-id="${id}"]`);
  if (el === null) throw new Error(`sin bloque ${id}`);
  return el;
};
const paradasDeTab = (): string[] => bloques().filter((b) => b.getAttribute('tabindex') === '0').map((b) => b.dataset['turnoId'] ?? '');
const tecla = (el: Element, key: string): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

describe('columnas y filas (3.3)', () => {
  it('una columna por sillón con su encabezado, incluido un sillón inactivo o desconocido referido por un turno', () => {
    montar(datos([T9, S2_9, TURNO_SILLON_INACTIVO]));
    const titulos = [...document.querySelectorAll('.grilla-titulo')].map((t) => t.textContent);
    expect(titulos).toEqual(['Sillón 1', 'Sillón 2', 'Sillón viejo (inactivo)']);
  });

  it('en la vista semanal, una columna por día', () => {
    montar(datos([T9], { vista: 'semana', fecha: '2026-11-25' }));
    expect([...document.querySelectorAll('.grilla-titulo')].map((t) => t.textContent)).toEqual([
      'lunes 23/11',
      'martes 24/11',
      'miércoles 25/11',
      'jueves 26/11',
      'viernes 27/11',
      'sábado 28/11',
      'domingo 29/11',
    ]);
    expect(bloque(1).textContent).toContain('Sillón 1');
  });

  it('filas según la franja: de 08:00 a 14:00 con grilla 15 son 24 filas por columna', () => {
    montar(datos([]));
    const primera = document.querySelector('.grilla-columna');
    expect(primera?.querySelectorAll('.celda')).toHaveLength(24);
  });

  it('el turno ocupa fila y filas según su hora (09:00–09:30 con franja 08:00 → fila 5, dos filas)', () => {
    montar(datos([T9]));
    expect(bloque(1).style.gridRow).toBe('5 / span 2');
  });

  it('turnos superpuestos en una columna van lado a lado en carriles distintos', () => {
    const reemplazo = at(9, '2026-11-24T13:00:00Z', '2026-11-24T13:30:00Z');
    montar(datos([T10, reemplazo]));
    expect(bloque(2).style.gridColumn).toBe('1 / span 1');
    expect(bloque(9).style.gridColumn).toBe('2 / span 1');
    expect(document.querySelector('.grilla-columna .grilla-cuerpo')?.getAttribute('style') ?? '').toContain('repeat(2');
  });

  it('bloqueos: sombreados con "Bloqueado" solo en la columna afectada', () => {
    const bloqueo: Bloqueo = { id: 7, sillonId: 2, profesionalId: null, inicio: '2026-11-24T15:00:00Z', fin: '2026-11-24T16:00:00Z', motivo: 'Secreto' };
    montar(datos([], { bloqueos: [bloqueo] }));
    const columnas = [...document.querySelectorAll('.grilla-columna')];
    expect(columnas[0]?.querySelector('.bloqueo')).toBeNull();
    const b = columnas[1]?.querySelector<HTMLElement>('.bloqueo');
    expect(b?.textContent).toContain('Bloqueado');
    // 12:00–13:00 con franja desde 08:00: fila 17, 4 filas.
    expect(b?.style.gridRow).toBe('17 / span 4');
    expect(document.body.textContent).not.toContain('Secreto');
  });

  it('un bloqueo fuera de la franja se recorta y no la expande', () => {
    const bloqueo: Bloqueo = { id: 7, sillonId: null, profesionalId: null, inicio: '2026-11-24T10:00:00Z', fin: '2026-11-24T12:30:00Z', motivo: null };
    montar(datos([], { bloqueos: [bloqueo] }));
    const b = document.querySelector<HTMLElement>('.grilla-columna .bloqueo');
    // 07:00–09:30 recortado a 08:00–09:30: fila 1, 6 filas.
    expect(b?.style.gridRow).toBe('1 / span 6');
    expect(document.querySelector('.grilla-columna')?.querySelectorAll('.celda')).toHaveLength(24);
  });

  it('un bloqueo totalmente fuera de la franja no se dibuja', () => {
    const bloqueo: Bloqueo = { id: 7, sillonId: null, profesionalId: null, inicio: '2026-11-24T22:00:00Z', fin: '2026-11-24T23:00:00Z', motivo: null };
    montar(datos([], { bloqueos: [bloqueo] }));
    expect(document.querySelector('.bloqueo')).toBeNull();
  });

  it('clic en un hueco emite fecha, hora y sillón de esa celda', () => {
    const { alElegirHueco } = montar(datos([]));
    document.querySelector<HTMLElement>('.grilla-columna[data-clave="sillon-2"] .celda[data-hora="11:15"]')?.click();
    expect(alElegirHueco).toHaveBeenCalledWith({ fecha: '2026-11-24', hora: '11:15', sillonId: 2 });
  });

  it('en la vista semanal el hueco lleva la fecha de la columna y el sillón filtrado', () => {
    const { alElegirHueco } = montar(datos([], { vista: 'semana', fecha: '2026-11-25', filtro: 2 }));
    document.querySelector<HTMLElement>('.celda[data-fecha="2026-11-27"][data-hora="09:00"]')?.click();
    expect(alElegirHueco).toHaveBeenCalledWith({ fecha: '2026-11-27', hora: '09:00', sillonId: 2 });
  });

  it('las celdas vacías no son enfocables', () => {
    montar(datos([T9]));
    for (const celda of document.querySelectorAll('.celda')) {
      expect(celda.tagName).toBe('DIV');
      expect(celda.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('clic en un bloque pide abrir sus acciones con el bloque como opener', () => {
    const { alAbrirAcciones } = montar(datos([T9]));
    bloque(1).click();
    expect(alAbrirAcciones).toHaveBeenCalledWith(1, bloque(1));
  });

  it('el cruce de medianoche aparece en dos columnas de la semana', () => {
    montar(datos([TURNO_CRUCE_MEDIANOCHE], { vista: 'semana', fecha: '2026-11-25' }));
    expect(bloques().map((b) => b.dataset['turnoId'])).toEqual(['107', '107']);
  });

  it('XSS: paciente y prestación se ven como texto y el documento no gana img ni script', () => {
    montar(datos([TURNO_MALICIOSO]));
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(bloque(109).textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('una franja por defecto de 08:00 a 20:00 produce 48 filas', () => {
    montar({ ...datos([]), franja: FRANJA_POR_DEFECTO });
    expect(document.querySelector('.grilla-columna')?.querySelectorAll('.celda')).toHaveLength(48);
  });
});

describe('teclado y roving tabindex (3.4)', () => {
  it('es un role="group" con aria-label, instrucción asociada por aria-describedby y tabindex -1', () => {
    const { grilla } = montar(datos([T9]));
    const el = grilla.element;
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-label')).toBe('Agenda del 24/11');
    expect(el.getAttribute('tabindex')).toBe('-1');
    const instr = document.getElementById(el.getAttribute('aria-describedby') ?? '');
    expect(instr?.textContent).toBe('Usá las flechas para moverte entre turnos y Enter para ver sus acciones.');
  });

  it('un solo bloque con tabindex 0: el primero cronológico; el resto -1', () => {
    montar(datos([T11, T9, S2_9, T10]));
    // 09:00 empata entre sillones: gana la columna de más a la izquierda.
    expect(paradasDeTab()).toEqual(['1']);
    expect(bloques().filter((b) => b.getAttribute('tabindex') === '-1')).toHaveLength(3);
  });

  it('Abajo, Abajo (borde) e Inicio en una columna', () => {
    montar(datos([T9, T10, T11]));
    bloque(2).focus();
    tecla(bloque(2), 'ArrowDown');
    expect(document.activeElement).toBe(bloque(3));
    expect(tecla(bloque(3), 'ArrowDown').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(bloque(3));
    tecla(bloque(3), 'Home');
    expect(document.activeElement).toBe(bloque(1));
    expect(paradasDeTab()).toEqual(['1']);
  });

  it('Arriba y Fin', () => {
    montar(datos([T9, T10, T11]));
    bloque(2).focus();
    tecla(bloque(2), 'ArrowUp');
    expect(document.activeElement).toBe(bloque(1));
    tecla(bloque(1), 'End');
    expect(document.activeElement).toBe(bloque(3));
  });

  it('Derecha va al turno de inicio más cercano de la columna adyacente; Izquierda vuelve', () => {
    montar(datos([T9, T10, S2_9, S2_1015]));
    bloque(2).focus();
    tecla(bloque(2), 'ArrowRight');
    expect(document.activeElement).toBe(bloque(5));
    tecla(bloque(5), 'ArrowLeft');
    expect(document.activeElement).toBe(bloque(2));
  });

  it('en el borde izquierdo/derecho el foco no se mueve', () => {
    montar(datos([T9, S2_9]));
    bloque(1).focus();
    tecla(bloque(1), 'ArrowLeft');
    expect(document.activeElement).toBe(bloque(1));
    bloque(4).focus();
    tecla(bloque(4), 'ArrowRight');
    expect(document.activeElement).toBe(bloque(4));
  });

  it('otras teclas no se interceptan', () => {
    montar(datos([T9]));
    bloque(1).focus();
    expect(tecla(bloque(1), 'a').defaultPrevented).toBe(false);
    expect(tecla(bloque(1), 'Tab').defaultPrevented).toBe(false);
  });

  it('enfocar un bloque lo vuelve la parada de Tab y avisa a la página', () => {
    const { alEnfocarTurno } = montar(datos([T9, T10]));
    bloque(2).focus();
    expect(paradasDeTab()).toEqual(['2']);
    expect(alEnfocarTurno).toHaveBeenCalledWith(2);
  });

  it('la parada activa se conserva tras re-renderizar si el turno sigue', () => {
    const { grilla } = montar(datos([T9, T10, T11]));
    bloque(3).focus();
    grilla.renderizar(datos([T9, T10, T11]));
    expect(paradasDeTab()).toEqual(['3']);
  });

  it('pasa al primero cronológico si el turno ya no está', () => {
    const { grilla } = montar(datos([T9, T10, T11]));
    bloque(3).focus();
    grilla.renderizar(datos([T10, T11].filter((t) => t.id !== 3)));
    expect(paradasDeTab()).toEqual(['2']);
  });

  it('activoId (destino de focoTrasCambio) recibe el tabindex 0', () => {
    const { grilla } = montar(datos([T9, T10]));
    grilla.renderizar(datos([T9, T10]), { activoId: 2 });
    expect(paradasDeTab()).toEqual(['2']);
  });

  it('enfocar(id) mueve el foco real y devuelve si existía', () => {
    const { grilla } = montar(datos([T9, T10]));
    expect(grilla.enfocar(2)).toBe(true);
    expect(document.activeElement).toBe(bloque(2));
    expect(grilla.enfocar(99)).toBe(false);
  });

  it('grilla vacía: sin parada de Tab en bloques y el grupo es destino de foco programático', () => {
    const { grilla } = montar(datos([]));
    expect(bloques()).toHaveLength(0);
    grilla.element.focus();
    expect(document.activeElement).toBe(grilla.element);
  });

  it('turnoActivoId refleja la parada actual y es null sin turnos', () => {
    const { grilla } = montar(datos([T9, T10]));
    expect(grilla.turnoActivoId()).toBe(1);
    const vacia = montar(datos([]));
    expect(vacia.grilla.turnoActivoId()).toBeNull();
  });
});

describe('tipo exportado', () => {
  it('Grilla expone element y renderizar', () => {
    const g: Grilla = crearGrilla({ alAbrirAcciones: () => undefined, alElegirHueco: () => undefined, alEnfocarTurno: () => undefined });
    expect(g.element).toBeInstanceOf(HTMLElement);
  });
});
