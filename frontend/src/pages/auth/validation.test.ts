import { describe, expect, it } from 'vitest';
import { utf8Length, validateLogin, validateRegistro, type RegistroInput } from './validation';

const VALIDO: RegistroInput = {
  consultorioNombre: 'Consultorio Sonrisas',
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@consultorio.test',
  password: 'Segura123!',
  matricula: '',
};

describe('utf8Length', () => {
  it.each([
    ['abc', 3],
    ['ñ', 2],
    ['😀', 4],
  ])('%j ocupa %i bytes', (s, n) => {
    expect(utf8Length(s)).toBe(n);
  });
});

describe('validateLogin', () => {
  it('acepta credenciales completas', () => {
    expect(validateLogin({ email: 'ana@consultorio.test', password: 'x' })).toEqual({});
  });

  it.each([
    ['', 'Este campo es obligatorio.'],
    ['   ', 'Este campo es obligatorio.'],
    ['ana', 'Ingresá un email válido.'],
    ['ana@', 'Ingresá un email válido.'],
    ['ana @x.test', 'Ingresá un email válido.'],
    [`${'a'.repeat(250)}@x.test`, 'Máximo 254 caracteres.'],
  ])('email %j → %s', (email, msg) => {
    expect(validateLogin({ email, password: 'x' }).email).toBe(msg);
  });

  it('contraseña obligatoria y hasta 200 caracteres', () => {
    expect(validateLogin({ email: 'a@b.c', password: '' }).password).toBe('Este campo es obligatorio.');
    expect(validateLogin({ email: 'a@b.c', password: 'x'.repeat(201) }).password).toBe('Máximo 200 caracteres.');
  });
});

describe('validateRegistro', () => {
  it('acepta datos válidos sin matrícula', () => {
    expect(validateRegistro(VALIDO)).toEqual({});
  });

  it('contraseña de 7 caracteres', () => {
    expect(validateRegistro({ ...VALIDO, password: '1234567' }).password).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });

  it('contraseña de 40 ñ (80 bytes) supera los 72 bytes', () => {
    expect(validateRegistro({ ...VALIDO, password: 'ñ'.repeat(40) }).password).toBe('La contraseña es demasiado larga.');
  });

  it('contraseña de 36 ñ (72 bytes) es válida', () => {
    expect(validateRegistro({ ...VALIDO, password: 'ñ'.repeat(36) }).password).toBeUndefined();
  });

  it('contraseña con emojis se mide en bytes', () => {
    expect(validateRegistro({ ...VALIDO, password: '😀'.repeat(19) }).password).toBe('La contraseña es demasiado larga.');
    expect(validateRegistro({ ...VALIDO, password: '😀'.repeat(18) }).password).toBeUndefined();
  });

  it.each([
    ['consultorioNombre', 150],
    ['nombre', 100],
    ['apellido', 100],
    ['matricula', 50],
  ] as const)('%s admite hasta %i caracteres', (campo, max) => {
    expect(validateRegistro({ ...VALIDO, [campo]: 'x'.repeat(max) })[campo]).toBeUndefined();
    expect(validateRegistro({ ...VALIDO, [campo]: 'x'.repeat(max + 1) })[campo]).toBe(`Máximo ${max} caracteres.`);
  });

  it.each(['consultorioNombre', 'nombre', 'apellido', 'email', 'password'] as const)('%s es obligatorio', (campo) => {
    expect(validateRegistro({ ...VALIDO, [campo]: '  ' })[campo]).toBeDefined();
  });

  it('la matrícula es opcional', () => {
    expect(validateRegistro({ ...VALIDO, matricula: '   ' }).matricula).toBeUndefined();
  });
});
