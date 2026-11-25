/**
 * Cuerpos del contrato real de C-07 (knowledge-base/entrega/C-07.md, spec appointment-scheduling) para los tests.
 * Datos ficticios. Las horas del comentario son de Argentina (UTC−3); los instantes, UTC.
 */
import type { ConflictoTurno, Turno } from '../types';

const PACIENTE_ANA = { id: 5, nombre: 'Ana', apellido: 'Pérez' };
const LIMPIEZA = { id: 11, nombre: 'Limpieza' };
const CONTROL = { id: 10, nombre: 'Control' };

/** 24/11/2026 10:00–10:30, sillón 1. */
export const TURNO_PROGRAMADO: Turno = {
  id: 100,
  inicio: '2026-11-24T13:00:00Z',
  fin: '2026-11-24T13:30:00Z',
  estado: 'PROGRAMADO',
  sobreturno: false,
  motivoCancelacion: null,
  notas: null,
  sillonId: 1,
  profesionalId: 7,
  paciente: PACIENTE_ANA,
  prestacion: LIMPIEZA,
};

/** 24/11/2026 11:00–11:15, sillón 1. */
export const TURNO_CONFIRMADO: Turno = {
  ...TURNO_PROGRAMADO,
  id: 101,
  inicio: '2026-11-24T14:00:00Z',
  fin: '2026-11-24T14:15:00Z',
  estado: 'CONFIRMADO',
  notas: 'Trae radiografía',
  paciente: { id: 6, nombre: 'Luis', apellido: 'Gómez' },
  prestacion: CONTROL,
};

/** 24/11/2026 12:00–12:30, sillón 2. */
export const TURNO_CANCELADO: Turno = {
  ...TURNO_PROGRAMADO,
  id: 102,
  inicio: '2026-11-24T15:00:00Z',
  fin: '2026-11-24T15:30:00Z',
  estado: 'CANCELADO',
  motivoCancelacion: 'El paciente avisó que no llega',
  sillonId: 2,
};

/** 24/11/2026 15:00–15:30, sillón 1. */
export const TURNO_ASISTIO: Turno = {
  ...TURNO_PROGRAMADO,
  id: 103,
  inicio: '2026-11-24T18:00:00Z',
  fin: '2026-11-24T18:30:00Z',
  estado: 'ASISTIO',
};

/** 24/11/2026 16:00–16:30, sillón 1. */
export const TURNO_AUSENTE: Turno = {
  ...TURNO_PROGRAMADO,
  id: 104,
  inicio: '2026-11-24T19:00:00Z',
  fin: '2026-11-24T19:30:00Z',
  estado: 'AUSENTE',
};

/** Sobreturno fuera de horario: 24/11/2026 19:00–19:45. */
export const TURNO_SOBRETURNO: Turno = {
  ...TURNO_PROGRAMADO,
  id: 105,
  inicio: '2026-11-24T22:00:00Z',
  fin: '2026-11-24T22:45:00Z',
  sobreturno: true,
};

/** Nocturno: 24/11/2026 22:30–23:00 (en UTC cae el 25/11 de 01:30 a 02:00). */
export const TURNO_NOCTURNO: Turno = {
  ...TURNO_PROGRAMADO,
  id: 106,
  inicio: '2026-11-25T01:30:00Z',
  fin: '2026-11-25T02:00:00Z',
  sobreturno: true,
};

/** Cruza la medianoche: 24/11/2026 23:30 a 25/11/2026 00:15. */
export const TURNO_CRUCE_MEDIANOCHE: Turno = {
  ...TURNO_PROGRAMADO,
  id: 107,
  inicio: '2026-11-25T02:30:00Z',
  fin: '2026-11-25T03:15:00Z',
  sobreturno: true,
};

/** Sillón inactivo (3) y sin profesional: 24/11/2026 09:00–09:30. */
export const TURNO_SILLON_INACTIVO: Turno = {
  ...TURNO_PROGRAMADO,
  id: 108,
  inicio: '2026-11-24T12:00:00Z',
  fin: '2026-11-24T12:30:00Z',
  sillonId: 3,
  profesionalId: null,
};

export const XSS_IMG = '<img src=x onerror=alert(1)>';
export const XSS_SCRIPT = '<script>alert(1)</script>';

/** Nombres con marcado HTML: deben mostrarse como texto literal. */
export const TURNO_MALICIOSO: Turno = {
  ...TURNO_PROGRAMADO,
  id: 109,
  notas: XSS_SCRIPT,
  motivoCancelacion: XSS_IMG,
  paciente: { id: 9, nombre: XSS_IMG, apellido: XSS_SCRIPT },
  prestacion: { id: 13, nombre: XSS_IMG },
};

export const CONFLICTO_SILLON: ConflictoTurno = {
  turnoId: 9,
  inicio: '2026-11-24T13:00:00Z',
  fin: '2026-11-24T13:30:00Z',
  sillonId: 1,
  profesionalId: 7,
  motivo: 'SILLON',
};

export const CONFLICTO_PROFESIONAL: ConflictoTurno = { ...CONFLICTO_SILLON, sillonId: 2, motivo: 'PROFESIONAL' };

/** ProblemDetail reales de C-07 (ApiExceptionHandler). */
export const PROBLEM_409_CONFLICTO = {
  type: 'about:blank',
  title: 'Turno en conflicto',
  status: 409,
  detail: 'El sillón ya tiene un turno en ese horario.',
  conflicto: CONFLICTO_SILLON,
};

export const PROBLEM_409_GENERICO = { type: 'about:blank', title: 'Modificación concurrente', status: 409 };

export const PROBLEM_422_FUERA_DE_AGENDA = {
  type: 'about:blank',
  title: 'Turno fuera de agenda',
  status: 422,
  errores: [{ campo: 'inicio', mensaje: 'fuera del horario de atención' }],
};

export const PROBLEM_422_BLOQUEO = {
  type: 'about:blank',
  title: 'Turno fuera de agenda',
  status: 422,
  errores: [{ campo: 'inicio', mensaje: 'dentro de un bloqueo' }],
  bloqueoId: 4,
};

export const PROBLEM_422_REFERENCIA = {
  type: 'about:blank',
  title: 'Referencia inválida',
  status: 422,
  errores: [{ campo: 'pacienteId', mensaje: 'no existe' }],
};

export const PROBLEM_422_PROFESIONAL = {
  type: 'about:blank',
  title: 'Referencia inválida',
  status: 422,
  errores: [{ campo: 'profesionalId', mensaje: 'no existe' }],
};
