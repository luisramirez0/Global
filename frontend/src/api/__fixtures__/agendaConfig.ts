/**
 * Cuerpos del contrato real de C-04 (knowledge-base/entrega/C-04.md, spec agenda-configuration) para los tests.
 * Datos ficticios.
 */
import type { Bloqueo, Horario, Prestacion, Sillon } from '../types';

export const SILLON_1: Sillon = { id: 1, nombre: 'Sillón 1', activo: true };
export const SILLON_2: Sillon = { id: 2, nombre: 'Sillón 2', activo: true };
export const SILLON_INACTIVO: Sillon = { id: 3, nombre: 'Sillón viejo', activo: false };

export const PRESTACION_CONTROL: Prestacion = { id: 10, nombre: 'Control', duracionMinutos: 15, activo: true };
export const PRESTACION_LIMPIEZA: Prestacion = { id: 11, nombre: 'Limpieza', duracionMinutos: 30, activo: true };
export const PRESTACION_INACTIVA: Prestacion = { id: 12, nombre: 'Blanqueamiento', duracionMinutos: 60, activo: false };

export const HORARIO_LUNES: Horario = { id: 20, profesionalId: 7, diaSemana: 1, horaDesde: '09:00', horaHasta: '13:00' };
export const HORARIO_MARTES: Horario = { id: 21, profesionalId: 7, diaSemana: 2, horaDesde: '14:00', horaHasta: '18:30' };

/** Todo el consultorio, 24/12 de 09:00 a 20:00 en Argentina. */
export const BLOQUEO_CONSULTORIO: Bloqueo = {
  id: 30,
  sillonId: null,
  profesionalId: null,
  inicio: '2026-12-24T12:00:00Z',
  fin: '2026-12-24T23:00:00Z',
  motivo: 'Nochebuena',
};

/** Sillón 1, sin motivo: 26/11 de 12:00 a 13:00 en Argentina. */
export const BLOQUEO_SILLON: Bloqueo = {
  id: 31,
  sillonId: 1,
  profesionalId: null,
  inicio: '2026-11-26T15:00:00Z',
  fin: '2026-11-26T16:00:00Z',
  motivo: null,
};

/** Del profesional 7 (vacaciones). */
export const BLOQUEO_PROFESIONAL: Bloqueo = {
  id: 32,
  sillonId: null,
  profesionalId: 7,
  inicio: '2027-01-04T03:00:00Z',
  fin: '2027-01-11T03:00:00Z',
  motivo: 'Vacaciones',
};
