import { describe, expect, it } from 'vitest';
import { MSG_REQUIRED } from '../auth/validation';
import {
  MSG_DNI,
  MSG_EMAIL,
  MSG_FECHA,
  MSG_FECHA_FUTURA,
  MSG_TELEFONO,
  normalizarDni,
  normalizarTelefono,
  validarPaciente,
  type ValoresPaciente,
} from './validacion';

const HOY = '2026-11-24';

const VALIDO: ValoresPaciente = {
  nombre: 'Ana',
  apellido: 'Pérez',
  dni: '30111222',
  fechaNacimiento: '1985-04-12',
  sexo: 'F',
  telefono: '+5491123456789',
  email: 'ana@correo.test',
  direccion: 'Calle Falsa 123',
  obraSocialTexto: 'OSDE',
};

function errores(cambios: Partial<ValoresPaciente>): Partial<Record<keyof ValoresPaciente, string>> {
  const r = validarPaciente({ ...VALIDO, ...cambios }, HOY);
  return r.ok ? {} : r.errors;
}

function request(cambios: Partial<ValoresPaciente>) {
  const r = validarPaciente({ ...VALIDO, ...cambios }, HOY);
  if (!r.ok) throw new Error(`se esperaba válido: ${JSON.stringify(r.errors)}`);
  return r.value;
}

describe('nombre y apellido', () => {
  it.each(['', '   '])('nombre %j es obligatorio', (nombre) => {
    expect(errores({ nombre }).nombre).toBe(MSG_REQUIRED);
  });

  it.each(['', '\t'])('apellido %j es obligatorio', (apellido) => {
    expect(errores({ apellido }).apellido).toBe(MSG_REQUIRED);
  });

  it('máximo 100 caracteres, contados después de recortar', () => {
    expect(errores({ nombre: 'a'.repeat(100) }).nombre).toBeUndefined();
    expect(errores({ nombre: `  ${'a'.repeat(100)}  ` }).nombre).toBeUndefined();
    expect(errores({ nombre: 'a'.repeat(101) }).nombre).toMatch(/100/);
    expect(errores({ apellido: 'b'.repeat(101) }).apellido).toMatch(/100/);
  });

  it('se envían recortados', () => {
    expect(request({ nombre: '  Ana  ', apellido: ' Pérez ' })).toMatchObject({ nombre: 'Ana', apellido: 'Pérez' });
  });
});

describe('DNI', () => {
  it.each([
    ['30.111.222', '30111222'],
    ['30 111 222', '30111222'],
    ['30-111-222', '30111222'],
    ['4111222', '4111222'],
    [' 4.111.222 ', '4111222'],
  ])('%j se normaliza a %j', (dni, normalizado) => {
    expect(normalizarDni(dni)).toBe(normalizado);
    expect(request({ dni }).dni).toBe(normalizado);
  });

  it.each(['', '123', '123456', '123456789', '30.111.22a', '30/111/222', '３0111222'])('%j es inválido', (dni) => {
    expect(errores({ dni }).dni).toBe(dni === '' ? MSG_REQUIRED : MSG_DNI);
  });
});

describe('teléfono (E.164, opcional)', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['+54 9 11 2345 6789', '+5491123456789'],
    ['+54-9-11-2345-6789', '+5491123456789'],
    ['+54 (11) 2345.6789', '+541123456789'],
    ['+12345678', '+12345678'],
    [`+1${'2'.repeat(14)}`, `+1${'2'.repeat(14)}`],
  ])('%j → %j', (telefono, normalizado) => {
    expect(normalizarTelefono(telefono)).toBe(normalizado);
    expect(request({ telefono }).telefono).toBe(normalizado);
  });

  it.each(['1123456789', '+0123456789', '+1234567', `+1${'2'.repeat(15)}`, '+54 9 11 2345 678x', '++5491123456789'])(
    '%j es inválido',
    (telefono) => {
      expect(errores({ telefono }).telefono).toBe(MSG_TELEFONO);
    },
  );
});

describe('email (opcional)', () => {
  it('vacío queda en null y con espacios alrededor se recorta', () => {
    expect(request({ email: '' }).email).toBeNull();
    expect(request({ email: '  ana@correo.test ' }).email).toBe('ana@correo.test');
  });

  it.each(['ana', 'ana@', '@correo.test', 'ana @correo.test', 'ana@@correo.test'])('%j es inválido', (email) => {
    expect(errores({ email }).email).toBe(MSG_EMAIL);
  });

  it('máximo 254 caracteres', () => {
    const local = 'a'.repeat(64);
    const largo = `${local}@${'b'.repeat(254 - local.length - 1 - 5)}.test`;
    expect(largo).toHaveLength(254);
    expect(errores({ email: largo }).email).toBeUndefined();
    expect(errores({ email: `a${largo}` }).email).toMatch(/254/);
  });
});

describe('fecha de nacimiento (opcional, no futura)', () => {
  it('vacía queda en null; hoy y el pasado son válidos', () => {
    expect(request({ fechaNacimiento: '' }).fechaNacimiento).toBeNull();
    expect(request({ fechaNacimiento: HOY }).fechaNacimiento).toBe(HOY);
    expect(request({ fechaNacimiento: '1900-01-01' }).fechaNacimiento).toBe('1900-01-01');
  });

  it.each(['2026-11-25', '2030-01-01'])('%j es futura', (fechaNacimiento) => {
    expect(errores({ fechaNacimiento }).fechaNacimiento).toBe(MSG_FECHA_FUTURA);
  });

  it.each(['12/04/1985', '1985-02-30', '1985-13-01', 'ayer'])('%j es inválida', (fechaNacimiento) => {
    expect(errores({ fechaNacimiento }).fechaNacimiento).toBe(MSG_FECHA);
  });
});

describe('opcionales de texto', () => {
  it('vacíos quedan en null y se recortan', () => {
    expect(request({ sexo: '', direccion: '  ', obraSocialTexto: ' OSDE 210 ' })).toMatchObject({
      sexo: null,
      direccion: null,
      obraSocialTexto: 'OSDE 210',
    });
  });

  it.each([
    ['sexo', 20],
    ['direccion', 255],
    ['obraSocialTexto', 150],
  ] as const)('%s admite hasta %i caracteres', (campo, max) => {
    expect(errores({ [campo]: 'x'.repeat(max) })[campo]).toBeUndefined();
    expect(errores({ [campo]: 'x'.repeat(max + 1) })[campo]).toMatch(String(max));
  });
});

describe('resultado', () => {
  it('informa todos los errores juntos', () => {
    expect(Object.keys(errores({ nombre: '', dni: '1', telefono: 'x', email: 'y' })).sort()).toEqual([
      'dni',
      'email',
      'nombre',
      'telefono',
    ]);
  });

  it('un formulario válido arma el request completo', () => {
    expect(request({})).toEqual({
      nombre: 'Ana',
      apellido: 'Pérez',
      dni: '30111222',
      fechaNacimiento: '1985-04-12',
      sexo: 'F',
      telefono: '+5491123456789',
      email: 'ana@correo.test',
      direccion: 'Calle Falsa 123',
      obraSocialTexto: 'OSDE',
    });
  });
});
