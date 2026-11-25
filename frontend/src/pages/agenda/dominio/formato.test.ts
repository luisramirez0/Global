import { describe, expect, it } from 'vitest';
import { diaSemanaIso } from './rango';
import { etiquetaDia, etiquetaRango, fechaCompleta, horaLocal, minutosAHora, nombrePaciente } from './formato';

describe('minutosAHora', () => {
  it.each([
    [0, '00:00'],
    [545, '09:05'],
    [1350, '22:30'],
    [1439, '23:59'],
    [1440, '24:00'],
  ])('%i → %s', (min, esperado) => {
    expect(minutosAHora(min)).toBe(esperado);
  });
});

describe('etiquetaDia', () => {
  it.each([
    ['2026-11-24', 'martes 24/11'],
    ['2026-11-23', 'lunes 23/11'],
    ['2026-11-29', 'domingo 29/11'],
    ['2027-01-01', 'viernes 01/01'],
  ])('%s → %s', (fecha, esperado) => {
    expect(etiquetaDia(fecha)).toBe(esperado);
  });

  it('fecha inválida → cadena vacía', () => {
    expect(etiquetaDia('x')).toBe('');
  });
});

describe('fechaCompleta y etiquetaRango', () => {
  it('fechaCompleta incluye el año', () => {
    expect(fechaCompleta('2026-11-24')).toBe('martes 24/11/2026');
  });

  it('un día: su fecha completa; una semana: lunes al domingo', () => {
    expect(etiquetaRango('dia', '2026-11-24')).toBe('martes 24/11/2026');
    expect(etiquetaRango('semana', '2026-11-25')).toBe('Semana del 23/11/2026 al 29/11/2026');
  });
});

describe('horaLocal', () => {
  it('hora del consultorio de un instante UTC', () => {
    expect(horaLocal('2026-11-24T13:00:00Z')).toBe('10:00');
    expect(horaLocal('2026-11-25T01:30:00Z')).toBe('22:30');
  });

  it('instante inválido → vacío', () => {
    expect(horaLocal('nada')).toBe('');
  });
});

describe('nombrePaciente', () => {
  it('Apellido, Nombre', () => {
    expect(nombrePaciente({ nombre: 'Ana', apellido: 'Pérez' })).toBe('Pérez, Ana');
  });
});

describe('diaSemanaIso', () => {
  it('lunes = 1, domingo = 7', () => {
    expect(diaSemanaIso('2026-11-23')).toBe(1);
    expect(diaSemanaIso('2026-11-29')).toBe(7);
    expect(diaSemanaIso('2026-02-30')).toBeNull();
  });
});
