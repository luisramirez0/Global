import { describe, expect, it } from 'vitest';
import {
  GRILLA_MINUTOS,
  MSG_DIA,
  MSG_DURACION,
  MSG_DURACION_GRILLA,
  MSG_FECHA,
  MSG_FECHA_HORA,
  MSG_FIN_ORDEN,
  MSG_HORA,
  MSG_HORA_GRILLA,
  MSG_HORA_ORDEN,
  MSG_MOTIVO_LARGO,
  MSG_RANGO,
  validarBloqueo,
  validarFiltroBloqueos,
  validarHorario,
  validarPrestacion,
  validarSillon,
} from './validacion';

const REQUERIDO = 'Este campo es obligatorio.';

describe('grilla', () => {
  it('es de 15 minutos (provisional, PA-03; igual a GrillaAgenda.MINUTOS del backend)', () => {
    expect(GRILLA_MINUTOS).toBe(15);
  });
});

describe('validarSillon', () => {
  it('recorta el nombre y lo acepta', () => {
    expect(validarSillon({ nombre: '  Sillón 1 ' })).toEqual({ ok: true, value: { nombre: 'Sillón 1' } });
  });

  it('nombre vacío o solo espacios → obligatorio', () => {
    expect(validarSillon({ nombre: '' })).toEqual({ ok: false, errors: { nombre: REQUERIDO } });
    expect(validarSillon({ nombre: '   ' })).toEqual({ ok: false, errors: { nombre: REQUERIDO } });
  });

  it('hasta 100 caracteres', () => {
    expect(validarSillon({ nombre: 'x'.repeat(100) }).ok).toBe(true);
    expect(validarSillon({ nombre: 'x'.repeat(101) })).toEqual({ ok: false, errors: { nombre: 'Máximo 100 caracteres.' } });
  });
});

describe('validarPrestacion', () => {
  it('acepta duración múltiplo de la grilla', () => {
    expect(validarPrestacion({ nombre: ' Limpieza ', duracion: '30' })).toEqual({
      ok: true,
      value: { nombre: 'Limpieza', duracionMinutos: 30 },
    });
    expect(validarPrestacion({ nombre: 'Implante', duracion: ' 240 ' }).ok).toBe(true);
  });

  it('nombre hasta 150 caracteres', () => {
    expect(validarPrestacion({ nombre: 'x'.repeat(150), duracion: '15' }).ok).toBe(true);
    expect(validarPrestacion({ nombre: 'x'.repeat(151), duracion: '15' })).toEqual({
      ok: false,
      errors: { nombre: 'Máximo 150 caracteres.' },
    });
  });

  it.each(['', 'abc', '1.5', '-15', '0', '15m', '99999999999'])('duración %j → no es una duración válida', (duracion) => {
    const r = validarPrestacion({ nombre: 'x', duracion });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.duracionMinutos).toBe(duracion === '' ? REQUERIDO : MSG_DURACION);
  });

  it.each(['10', '20', '25', '50'])('duración %s fuera de la grilla', (duracion) => {
    expect(validarPrestacion({ nombre: 'x', duracion })).toEqual({ ok: false, errors: { duracionMinutos: MSG_DURACION_GRILLA } });
  });

  it('informa ambos errores a la vez', () => {
    expect(validarPrestacion({ nombre: '', duracion: '20' })).toEqual({
      ok: false,
      errors: { nombre: REQUERIDO, duracionMinutos: MSG_DURACION_GRILLA },
    });
  });
});

describe('validarHorario', () => {
  it('acepta una franja válida', () => {
    expect(validarHorario({ diaSemana: '1', horaDesde: '09:00', horaHasta: '13:15' })).toEqual({
      ok: true,
      value: { diaSemana: 1, horaDesde: '09:00', horaHasta: '13:15' },
    });
    expect(validarHorario({ diaSemana: '7', horaDesde: '00:00', horaHasta: '23:45' }).ok).toBe(true);
  });

  it('acepta segundos en 00 (algunos navegadores los agregan) y los descarta', () => {
    expect(validarHorario({ diaSemana: '2', horaDesde: '09:00:00', horaHasta: '10:00:00' })).toEqual({
      ok: true,
      value: { diaSemana: 2, horaDesde: '09:00', horaHasta: '10:00' },
    });
  });

  it.each(['0', '8', '', 'lunes'])('día %j inválido', (diaSemana) => {
    const r = validarHorario({ diaSemana, horaDesde: '09:00', horaHasta: '10:00' });
    expect(r).toEqual({ ok: false, errors: { diaSemana: MSG_DIA } });
  });

  it('horas obligatorias y con formato', () => {
    expect(validarHorario({ diaSemana: '1', horaDesde: '', horaHasta: '25:00' })).toEqual({
      ok: false,
      errors: { horaDesde: REQUERIDO, horaHasta: MSG_HORA },
    });
  });

  it('horas fuera de la grilla', () => {
    expect(validarHorario({ diaSemana: '1', horaDesde: '09:10', horaHasta: '10:05' })).toEqual({
      ok: false,
      errors: { horaDesde: MSG_HORA_GRILLA, horaHasta: MSG_HORA_GRILLA },
    });
  });

  it('desde debe ser anterior a hasta (iguales o invertidas)', () => {
    expect(validarHorario({ diaSemana: '1', horaDesde: '12:00', horaHasta: '09:00' })).toEqual({
      ok: false,
      errors: { horaHasta: MSG_HORA_ORDEN },
    });
    expect(validarHorario({ diaSemana: '1', horaDesde: '09:00', horaHasta: '09:00' })).toEqual({
      ok: false,
      errors: { horaHasta: MSG_HORA_ORDEN },
    });
  });
});

describe('validarBloqueo (hora de Argentina → UTC)', () => {
  it('convierte 21:00–23:59 AR al día siguiente en UTC', () => {
    expect(validarBloqueo({ inicio: '2026-11-24T21:00', fin: '2026-11-24T23:59', motivo: '' })).toEqual({
      ok: true,
      value: { inicio: '2026-11-25T00:00:00Z', fin: '2026-11-25T02:59:00Z' },
    });
  });

  it('recorta el motivo y lo envía si no queda vacío', () => {
    expect(validarBloqueo({ inicio: '2026-12-24T09:00', fin: '2026-12-24T20:00', motivo: '  Nochebuena ' })).toEqual({
      ok: true,
      value: { inicio: '2026-12-24T12:00:00Z', fin: '2026-12-24T23:00:00Z', motivo: 'Nochebuena' },
    });
  });

  it('inicio y fin obligatorios y válidos', () => {
    expect(validarBloqueo({ inicio: '', fin: '2026-02-30T10:00', motivo: '' })).toEqual({
      ok: false,
      errors: { inicio: REQUERIDO, fin: MSG_FECHA_HORA },
    });
  });

  it('fin igual o anterior al inicio → error en fin', () => {
    expect(validarBloqueo({ inicio: '2026-11-24T10:00', fin: '2026-11-24T10:00', motivo: '' })).toEqual({
      ok: false,
      errors: { fin: MSG_FIN_ORDEN },
    });
    expect(validarBloqueo({ inicio: '2026-11-24T23:00', fin: '2026-11-24T22:00', motivo: '' })).toEqual({
      ok: false,
      errors: { fin: MSG_FIN_ORDEN },
    });
  });

  it('motivo hasta 255 bytes UTF-8 (las tildes ocupan 2)', () => {
    const base = { inicio: '2026-11-24T10:00', fin: '2026-11-24T11:00' };
    expect(validarBloqueo({ ...base, motivo: 'a'.repeat(255) }).ok).toBe(true);
    expect(validarBloqueo({ ...base, motivo: 'a'.repeat(256) })).toEqual({ ok: false, errors: { motivo: MSG_MOTIVO_LARGO } });
    // 128 "á" = 256 bytes aunque sean 128 caracteres.
    expect(validarBloqueo({ ...base, motivo: 'á'.repeat(128) })).toEqual({ ok: false, errors: { motivo: MSG_MOTIVO_LARGO } });
    expect(validarBloqueo({ ...base, motivo: 'á'.repeat(127) }).ok).toBe(true);
  });
});

describe('validarFiltroBloqueos', () => {
  it('desde a las 00:00 AR; hasta inclusivo = 00:00 AR del día siguiente', () => {
    expect(validarFiltroBloqueos({ desde: '2026-11-24', hasta: '2026-11-30' })).toEqual({
      ok: true,
      value: { desde: '2026-11-24T03:00:00Z', hasta: '2026-12-01T03:00:00Z' },
    });
  });

  it('ambos opcionales', () => {
    expect(validarFiltroBloqueos({ desde: '', hasta: '' })).toEqual({ ok: true, value: {} });
    expect(validarFiltroBloqueos({ desde: '', hasta: '2026-12-31' })).toEqual({ ok: true, value: { hasta: '2027-01-01T03:00:00Z' } });
  });

  it('fechas inválidas y rango invertido', () => {
    expect(validarFiltroBloqueos({ desde: '2026-02-30', hasta: 'x' })).toEqual({
      ok: false,
      errors: { desde: MSG_FECHA, hasta: MSG_FECHA },
    });
    expect(validarFiltroBloqueos({ desde: '2026-11-25', hasta: '2026-11-24' })).toEqual({ ok: false, errors: { hasta: MSG_RANGO } });
    expect(validarFiltroBloqueos({ desde: '2026-11-24', hasta: '2026-11-24' }).ok).toBe(true);
  });
});
