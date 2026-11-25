import { describe, expect, it } from 'vitest';
import { MSG_REQUIRED } from '../auth/validation';
import {
  MAX_CAMPO_FICHA,
  MAX_NOTA,
  MSG_ACEPTACION,
  MSG_EMBARAZO,
  validarAceptacion,
  validarFicha,
  validarNota,
  type ValoresFicha,
} from './validacion';

const VACIA: ValoresFicha = {
  alergias: '',
  medicacionActual: '',
  antecedentesMedicos: '',
  enfermedadesRelevantes: '',
  embarazo: '',
  motivoConsulta: '',
  observaciones: '',
};

const CAMPOS_TEXTO = ['alergias', 'medicacionActual', 'antecedentesMedicos', 'enfermedadesRelevantes', 'motivoConsulta', 'observaciones'] as const;

describe('validarFicha', () => {
  it('todo en blanco: request con todos los campos en null y la version recibida', () => {
    const r = validarFicha({ ...VACIA, alergias: '   ', observaciones: '\n' }, 3);
    expect(r).toEqual({
      ok: true,
      value: {
        alergias: null,
        medicacionActual: null,
        antecedentesMedicos: null,
        enfermedadesRelevantes: null,
        embarazo: null,
        motivoConsulta: null,
        observaciones: null,
        version: 3,
      },
    });
  });

  it('primera carga: version null; los textos se envían tal cual, sin recortar', () => {
    const r = validarFicha({ ...VACIA, alergias: ' Penicilina\n', motivoConsulta: 'Control' }, null);
    expect(r.ok && r.value).toMatchObject({ alergias: ' Penicilina\n', motivoConsulta: 'Control', version: null });
  });

  it.each([
    ['', null],
    ['si', true],
    ['no', false],
  ] as const)('embarazo %j → %s', (embarazo, esperado) => {
    const r = validarFicha({ ...VACIA, embarazo }, 0);
    expect(r.ok && r.value.embarazo).toBe(esperado);
  });

  it.each(['true', 'Sí', 'x'])('embarazo con un valor desconocido %j es error', (embarazo) => {
    const r = validarFicha({ ...VACIA, embarazo }, 0);
    expect(r.ok ? null : r.errors.embarazo).toBe(MSG_EMBARAZO);
  });

  it.each(CAMPOS_TEXTO)('%s admite 4000 caracteres y rechaza 4001', (campo) => {
    expect(validarFicha({ ...VACIA, [campo]: 'x'.repeat(MAX_CAMPO_FICHA) }, 0).ok).toBe(true);
    const r = validarFicha({ ...VACIA, [campo]: 'x'.repeat(MAX_CAMPO_FICHA + 1) }, 0);
    expect(r.ok ? null : r.errors[campo]).toMatch('4000');
  });

  it('informa todos los errores juntos', () => {
    const r = validarFicha({ ...VACIA, alergias: 'x'.repeat(4001), observaciones: 'y'.repeat(4001), embarazo: '?' }, 0);
    expect(r.ok ? [] : Object.keys(r.errors).sort()).toEqual(['alergias', 'embarazo', 'observaciones']);
  });
});

describe('validarNota', () => {
  it.each(['', '   ', '\n\t'])('una nota en blanco %j es obligatoria', (texto) => {
    expect(validarNota(texto)).toEqual({ ok: false, errors: { texto: MSG_REQUIRED } });
  });

  it('se envía tal cual, sin recortar', () => {
    expect(validarNota('  Control.\n')).toEqual({ ok: true, value: '  Control.\n' });
  });

  it('admite 10000 caracteres y rechaza 10001', () => {
    expect(validarNota('x'.repeat(MAX_NOTA)).ok).toBe(true);
    const r = validarNota('x'.repeat(MAX_NOTA + 1));
    expect(r.ok ? null : r.errors.texto).toMatch('10000');
  });
});

describe('validarAceptacion', () => {
  it('sin marcar la casilla es error', () => {
    expect(validarAceptacion(false)).toBe(MSG_ACEPTACION);
  });

  it('marcada es válida', () => {
    expect(validarAceptacion(true)).toBeNull();
  });
});
