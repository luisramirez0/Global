import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TURNO_CANCELADO,
  TURNO_CRUCE_MEDIANOCHE,
  TURNO_MALICIOSO,
  TURNO_NOCTURNO,
  TURNO_PROGRAMADO,
  TURNO_SOBRETURNO,
} from '../../api/__fixtures__/turnos';
import type { Turno } from '../../api/types';
import { crearLista } from './listaTurnos';

afterEach(() => {
  document.body.replaceChildren();
});

const nombreSillon = (id: number): string => `Sillón ${id}`;
const T9: Turno = { ...TURNO_PROGRAMADO, id: 1, inicio: '2026-11-24T12:00:00Z', fin: '2026-11-24T12:30:00Z' };
const T10: Turno = { ...TURNO_PROGRAMADO, id: 2 };
const T7: Turno = { ...TURNO_PROGRAMADO, id: 3, inicio: '2026-11-24T10:10:00Z', fin: '2026-11-24T10:40:00Z' };

function montar(turnos: readonly Turno[], fechas: readonly string[] = ['2026-11-24']) {
  const alAbrirAcciones = vi.fn<(id: number, opener: HTMLElement) => void>();
  const alEnfocarTurno = vi.fn<(id: number) => void>();
  const lista = crearLista({ alAbrirAcciones, alEnfocarTurno });
  lista.renderizar({ fechas, turnos, nombreSillon });
  document.body.replaceChildren(lista.element);
  return { lista, alAbrirAcciones, alEnfocarTurno };
}

const items = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('li')];
const orden = (): string[] => [...document.querySelectorAll<HTMLElement>('li button')].map((b) => b.dataset['turnoId'] ?? '');

describe('listaTurnos', () => {
  it('agrupa por día con un h2 y ordena por inicio dentro del día', () => {
    montar([T10, T9, T7]);
    const titulos = [...document.querySelectorAll('h2')].map((h2) => h2.textContent);
    expect(titulos).toEqual(['martes 24/11']);
    expect(orden()).toEqual(['3', '1', '2']);
  });

  it('incluye todos los turnos: fuera de horario, nocturno y sobreturno', () => {
    montar([T9, T10, TURNO_SOBRETURNO, TURNO_NOCTURNO, T7]);
    expect(items()).toHaveLength(5);
  });

  it('cada entrada muestra hora, paciente, prestación, sillón, estado y marcas', () => {
    montar([TURNO_SOBRETURNO]);
    const texto = items()[0]?.textContent ?? '';
    expect(texto).toContain('19:00–19:45');
    expect(texto).toContain('Pérez, Ana');
    expect(texto).toContain('Limpieza');
    expect(texto).toContain('Sillón 1');
    expect(texto).toContain('Programado');
    expect(texto).toContain('Sobreturno');
  });

  it('un botón "Acciones" por entrada con data-turno-id y nombre accesible; abre las acciones del turno', () => {
    const { alAbrirAcciones } = montar([T9]);
    const boton = document.querySelector<HTMLButtonElement>('li button');
    expect(boton?.textContent).toBe('Acciones');
    expect(boton?.dataset['turnoId']).toBe('1');
    expect(boton?.getAttribute('aria-label')).toBe('Acciones de 09:00–09:30, Pérez, Ana');
    boton?.click();
    expect(alAbrirAcciones).toHaveBeenCalledWith(1, boton);
  });

  it('el orden de Tab es el cronológico: los botones están en el mismo orden que la lista y ninguno tiene tabindex', () => {
    montar([T10, T9, T7]);
    expect(orden()).toEqual(['3', '1', '2']);
    for (const b of document.querySelectorAll('li button')) expect(b.hasAttribute('tabindex')).toBe(false);
  });

  it('cada día de la vista tiene su h2 con tabindex -1 aunque no tenga turnos ("Sin turnos.")', () => {
    montar([T9], ['2026-11-23', '2026-11-24', '2026-11-25']);
    const h2s = [...document.querySelectorAll('h2')];
    expect(h2s.map((h) => h.textContent)).toEqual(['lunes 23/11', 'martes 24/11', 'miércoles 25/11']);
    expect(h2s.every((h) => h.getAttribute('tabindex') === '-1')).toBe(true);
    const sin = [...document.querySelectorAll('section.lista-dia')].filter((s) => s.textContent?.includes('Sin turnos.'));
    expect(sin).toHaveLength(2);
  });

  it('el turno que cruza la medianoche aparece en los dos días con su marca', () => {
    montar([TURNO_CRUCE_MEDIANOCHE], ['2026-11-24', '2026-11-25']);
    const dias = [...document.querySelectorAll('section.lista-dia')];
    expect(dias[0]?.textContent).toContain('Continúa');
    expect(dias[1]?.textContent).toContain('Viene del día anterior');
  });

  it('el turno nocturno (22:30 AR) cae en su día del consultorio, no en el día UTC', () => {
    montar([TURNO_NOCTURNO], ['2026-11-24', '2026-11-25']);
    const dias = [...document.querySelectorAll('section.lista-dia')];
    expect(dias[0]?.textContent).toContain('22:30');
    expect(dias[1]?.textContent).toContain('Sin turnos.');
  });

  it('un cancelado visible muestra su estado', () => {
    montar([TURNO_CANCELADO]);
    expect(items()[0]?.textContent).toContain('Cancelado');
  });

  it('enfocar un botón "Acciones" avisa a la página', () => {
    const { alEnfocarTurno } = montar([T9, T10]);
    document.querySelectorAll<HTMLButtonElement>('li button')[1]?.focus();
    expect(alEnfocarTurno).toHaveBeenCalledWith(2);
  });

  it('enfocarTurno y enfocarDia mueven el foco real', () => {
    const { lista } = montar([T9], ['2026-11-24', '2026-11-25']);
    expect(lista.enfocarTurno(1)).toBe(true);
    expect(document.activeElement?.getAttribute('data-turno-id')).toBe('1');
    expect(lista.enfocarDia('2026-11-25')).toBe(true);
    expect(document.activeElement?.tagName).toBe('H2');
    expect(lista.enfocarTurno(99)).toBe(false);
    expect(lista.enfocarDia('2030-01-01')).toBe(false);
  });

  it('XSS: paciente, prestación y notas se ven como texto y no se agregan img ni script', () => {
    montar([TURNO_MALICIOSO]);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(items()[0]?.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
