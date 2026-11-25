import { describe, expect, it } from 'vitest';
import {
  MSG_FECHA_INVALIDA,
  MSG_HORA_INVALIDA,
  MSG_MOTIVO_OBLIGATORIO,
  MSG_MOTIVO_LARGO_BYTES,
  MSG_NOTAS_LARGAS,
  validarAltaTurno,
  validarMotivoCancelacion,
  validarReprogramacion,
  type AltaTurnoInput,
} from './validacion';

describe('validarMotivoCancelacion', () => {
  it('recorta los espacios', () => {
    expect(validarMotivoCancelacion('  Paciente avisó  ')).toEqual({ ok: true, value: 'Paciente avisó' });
  });

  it.each(['', '   ', '\n\t '])('vacío o solo espacios (%j) → error de obligatorio', (texto) => {
    expect(validarMotivoCancelacion(texto)).toEqual({ ok: false, error: MSG_MOTIVO_OBLIGATORIO });
  });

  it('127 ñ + a (255 bytes) es válido', () => {
    const texto = 'ñ'.repeat(127) + 'a';
    expect(validarMotivoCancelacion(texto)).toEqual({ ok: true, value: texto });
  });

  it('128 ñ (128 caracteres, 256 bytes) es inválido', () => {
    expect(validarMotivoCancelacion('ñ'.repeat(128))).toEqual({ ok: false, error: MSG_MOTIVO_LARGO_BYTES });
  });

  it('252 a + emoji (256 bytes) es inválido', () => {
    expect(validarMotivoCancelacion('a'.repeat(252) + '😀')).toEqual({ ok: false, error: MSG_MOTIVO_LARGO_BYTES });
  });

  it('251 a + emoji (255 bytes) es válido', () => {
    const texto = 'a'.repeat(251) + '😀';
    expect(validarMotivoCancelacion(texto)).toEqual({ ok: true, value: texto });
  });

  it('255 a es válido y 256 a no', () => {
    expect(validarMotivoCancelacion('a'.repeat(255)).ok).toBe(true);
    expect(validarMotivoCancelacion('a'.repeat(256))).toEqual({ ok: false, error: MSG_MOTIVO_LARGO_BYTES });
  });

  it('el límite se mide después de recortar', () => {
    expect(validarMotivoCancelacion(`  ${'a'.repeat(255)}  `).ok).toBe(true);
  });

  it('el mensaje de largo explica que tildes, ñ y emojis ocupan más de un byte', () => {
    expect(MSG_MOTIVO_LARGO_BYTES).toBe('El motivo es demasiado largo (máximo 255 bytes; las letras con tilde, la ñ y los emojis ocupan más de uno).');
  });
});

const ALTA_VALIDA: AltaTurnoInput = {
  pacienteId: 7,
  prestacionId: '2',
  sillonId: '1',
  fecha: '2026-11-24',
  hora: '10:00',
  notas: '',
};

describe('validarAltaTurno', () => {
  it('alta válida: inicio en UTC desde la hora del consultorio y sin notas vacías', () => {
    expect(validarAltaTurno(ALTA_VALIDA)).toEqual({
      ok: true,
      value: { pacienteId: 7, prestacionId: 2, sillonId: 1, inicio: '2026-11-24T13:00:00Z' },
    });
  });

  it('22:30 del consultorio cae al día siguiente en UTC', () => {
    const r = validarAltaTurno({ ...ALTA_VALIDA, hora: '22:30' });
    expect(r).toMatchObject({ ok: true, value: { inicio: '2026-11-25T01:30:00Z' } });
  });

  it('las notas se recortan y viajan solo si no quedan vacías', () => {
    expect(validarAltaTurno({ ...ALTA_VALIDA, notas: '  Control  ' })).toMatchObject({ ok: true, value: { notas: 'Control' } });
    const sinNotas = validarAltaTurno({ ...ALTA_VALIDA, notas: '   ' });
    expect(sinNotas.ok && 'notas' in sinNotas.value).toBe(false);
  });

  it('sin paciente ni prestación: marca los dos campos', () => {
    const r = validarAltaTurno({ ...ALTA_VALIDA, pacienteId: null, prestacionId: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['pacienteId', 'prestacionId']);
    }
  });

  it('sin sillón, fecha ni hora: los marca como obligatorios', () => {
    const r = validarAltaTurno({ ...ALTA_VALIDA, sillonId: '', fecha: '', hora: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['fecha', 'hora', 'sillonId']);
    }
  });

  it.each(['2026-02-30', '24/11/2026', 'mañana', '2026-13-01'])('fecha inválida %j', (fecha) => {
    const r = validarAltaTurno({ ...ALTA_VALIDA, fecha });
    expect(r).toEqual({ ok: false, errors: { fecha: MSG_FECHA_INVALIDA } });
  });

  it.each(['25:00', '10:60', '10', '10:0', 'abc'])('hora inválida %j', (hora) => {
    const r = validarAltaTurno({ ...ALTA_VALIDA, hora });
    expect(r).toEqual({ ok: false, errors: { hora: MSG_HORA_INVALIDA } });
  });

  it('notas de 1000 caracteres son válidas y de 1001 no', () => {
    expect(validarAltaTurno({ ...ALTA_VALIDA, notas: 'a'.repeat(1000) }).ok).toBe(true);
    expect(validarAltaTurno({ ...ALTA_VALIDA, notas: 'a'.repeat(1001) })).toEqual({ ok: false, errors: { notas: MSG_NOTAS_LARGAS } });
  });

  it('los ids de los selectores deben ser enteros positivos', () => {
    for (const malo of ['0', '-1', '1.5', 'x', '1e3']) {
      const r = validarAltaTurno({ ...ALTA_VALIDA, sillonId: malo });
      expect(r.ok).toBe(false);
    }
  });

  it('reúne todos los errores a la vez', () => {
    const r = validarAltaTurno({ pacienteId: null, prestacionId: '', sillonId: '', fecha: 'x', hora: 'y', notas: 'a'.repeat(1001) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['fecha', 'hora', 'notas', 'pacienteId', 'prestacionId', 'sillonId']);
    }
  });
});

describe('validarReprogramacion', () => {
  const base = { fecha: '2026-11-24', hora: '11:00', sillonId: '1', sillonActualId: 1 };

  it('mismo sillón → solo inicio', () => {
    expect(validarReprogramacion(base)).toEqual({ ok: true, value: { inicio: '2026-11-24T14:00:00Z' } });
  });

  it('otro sillón → inicio y sillonId', () => {
    expect(validarReprogramacion({ ...base, sillonId: '2' })).toEqual({
      ok: true,
      value: { inicio: '2026-11-24T14:00:00Z', sillonId: 2 },
    });
  });

  it('fecha u hora inválidas → errores por campo', () => {
    expect(validarReprogramacion({ ...base, fecha: '' })).toEqual({ ok: false, errors: { fecha: expect.any(String) as string } });
    expect(validarReprogramacion({ ...base, hora: '99:99' })).toEqual({ ok: false, errors: { hora: MSG_HORA_INVALIDA } });
  });

  it('sillón vacío o inválido → error en sillonId', () => {
    const r = validarReprogramacion({ ...base, sillonId: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(['sillonId']);
  });
});
