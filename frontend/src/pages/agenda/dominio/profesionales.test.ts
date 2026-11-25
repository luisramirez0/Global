import { describe, expect, it } from 'vitest';
import { HORARIO_LUNES, HORARIO_MARTES } from '../../../api/__fixtures__/agendaConfig';
import { hayVariosProfesionales } from './profesionales';

describe('hayVariosProfesionales (DP-1, opción A)', () => {
  it('sin horarios → falso', () => {
    expect(hayVariosProfesionales([])).toBe(false);
  });

  it('todos los horarios del mismo profesional → falso', () => {
    expect(hayVariosProfesionales([HORARIO_LUNES, HORARIO_MARTES])).toBe(false);
  });

  it('un solo horario → falso', () => {
    expect(hayVariosProfesionales([HORARIO_LUNES])).toBe(false);
  });

  it('horarios de los profesionales 1 y 2 → verdadero', () => {
    expect(hayVariosProfesionales([{ ...HORARIO_LUNES, profesionalId: 1 }, { ...HORARIO_MARTES, profesionalId: 2 }])).toBe(true);
  });

  it('el segundo profesional aparece al final de una lista larga → verdadero', () => {
    const horarios = [
      { ...HORARIO_LUNES, id: 1, profesionalId: 1 },
      { ...HORARIO_LUNES, id: 2, profesionalId: 1, diaSemana: 3 as const },
      { ...HORARIO_LUNES, id: 3, profesionalId: 1, diaSemana: 4 as const },
      { ...HORARIO_LUNES, id: 4, profesionalId: 5, diaSemana: 5 as const },
    ];
    expect(hayVariosProfesionales(horarios)).toBe(true);
  });

  it('repetir el mismo profesional en muchos horarios no cuenta como varios', () => {
    const horarios = [1, 2, 3, 4].map((id) => ({ ...HORARIO_LUNES, id, profesionalId: 7 }));
    expect(hayVariosProfesionales(horarios)).toBe(false);
  });
});
