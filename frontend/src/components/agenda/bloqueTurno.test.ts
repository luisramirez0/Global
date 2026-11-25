import { describe, expect, it } from 'vitest';
import {
  TURNO_CANCELADO,
  TURNO_CONFIRMADO,
  TURNO_CRUCE_MEDIANOCHE,
  TURNO_MALICIOSO,
  TURNO_PROGRAMADO,
  TURNO_SOBRETURNO,
} from '../../api/__fixtures__/turnos';
import type { Turno } from '../../api/types';
import { segmentarPorDia } from '../../pages/agenda/dominio/posicion';
import { crearBloqueTurno } from './bloqueTurno';

function bloque(turno: Turno, fecha = '2026-11-24', extra: { nombreSillon?: string } = {}): HTMLButtonElement {
  const segmento = segmentarPorDia(turno, fecha);
  if (segmento === null) throw new Error('turno fuera del día');
  return crearBloqueTurno({ turno, segmento, posicion: { fila: 5, filas: 2 }, carril: { carril: 0, carriles: 1 }, ...extra });
}

describe('crearBloqueTurno', () => {
  it('es un button con paciente, prestación, horas y etiqueta de estado', () => {
    const el = bloque(TURNO_CONFIRMADO);
    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.textContent).toContain('Gómez, Luis');
    expect(el.textContent).toContain('Control');
    expect(el.textContent).toContain('11:00–11:15');
    expect(el.textContent).toContain('Confirmado');
  });

  it.each([
    ['PROGRAMADO', TURNO_PROGRAMADO, 'Programado'],
    ['CONFIRMADO', TURNO_CONFIRMADO, 'Confirmado'],
    ['CANCELADO', TURNO_CANCELADO, 'Cancelado'],
  ] as const)('estado %s: clase turno--<estado> y etiqueta visible', (estado, turno, etiqueta) => {
    const el = bloque(turno);
    expect(el.classList.contains(`turno--${estado.toLowerCase()}`)).toBe(true);
    expect(el.textContent).toContain(etiqueta);
  });

  it('tiene data-turno-id y nombre accesible con hora, paciente, prestación y estado', () => {
    const el = bloque(TURNO_CONFIRMADO);
    expect(el.dataset['turnoId']).toBe('101');
    expect(el.getAttribute('aria-label')).toBe('11:00–11:15, Gómez, Luis, Control, Confirmado');
  });

  it('posición: gridRow y gridColumn numéricos calculados', () => {
    const el = crearBloqueTurno({
      turno: TURNO_PROGRAMADO,
      segmento: { inicioMin: 600, finMin: 630, continua: false, vieneDeAntes: false },
      posicion: { fila: 9, filas: 2 },
      carril: { carril: 1, carriles: 2 },
    });
    expect(el.style.gridRow).toBe('9 / span 2');
    expect(el.style.gridColumn).toBe('2 / span 1');
  });

  it('un sobreturno muestra "Sobreturno" y lo incluye en el nombre accesible', () => {
    const el = bloque(TURNO_SOBRETURNO);
    expect(el.textContent).toContain('Sobreturno');
    expect(el.classList.contains('turno--sobreturno')).toBe(true);
    expect(el.getAttribute('aria-label')).toContain('Sobreturno');
  });

  it('un turno común no muestra "Sobreturno"', () => {
    expect(bloque(TURNO_PROGRAMADO).textContent).not.toContain('Sobreturno');
  });

  it('cruce de medianoche: "Continúa" el primer día y "Viene del día anterior" el segundo, con horas recortadas', () => {
    const primero = bloque(TURNO_CRUCE_MEDIANOCHE, '2026-11-24');
    expect(primero.textContent).toContain('Continúa');
    expect(primero.textContent).toContain('23:30–24:00');
    const segundo = bloque(TURNO_CRUCE_MEDIANOCHE, '2026-11-25');
    expect(segundo.textContent).toContain('Viene del día anterior');
    expect(segundo.textContent).toContain('00:00–00:15');
  });

  it('muestra el nombre del sillón solo si se pide (vista semanal)', () => {
    expect(bloque(TURNO_PROGRAMADO).textContent).not.toContain('Sillón 2');
    expect(bloque(TURNO_PROGRAMADO, '2026-11-24', { nombreSillon: 'Sillón 2' }).textContent).toContain('Sillón 2');
  });

  it('XSS: paciente y prestación con marcado HTML se ven como texto literal, sin img ni script', () => {
    const el = bloque(TURNO_MALICIOSO);
    document.body.replaceChildren(el);
    expect(el.querySelector('img')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>alert(1)</script>, <img src=x onerror=alert(1)>');
    expect(el.getAttribute('aria-label')).toContain('<img src=x onerror=alert(1)>');
    document.body.replaceChildren();
  });
});
