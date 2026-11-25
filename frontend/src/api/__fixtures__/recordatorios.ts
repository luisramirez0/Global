/**
 * Cuerpos del contrato real de C-09 (knowledge-base/entrega/C-09.md, RecordatorioController) para los tests.
 * Datos ficticios. En pendientes, `ultimoRecordatorio` solo puede ser `null` o `ERROR`.
 */
import type { EnlaceWhatsApp, RecordatorioEmail, TurnoPendiente } from '../types';

export const ENLACE_WHATSAPP: EnlaceWhatsApp = {
  recordatorioId: 31,
  enlace: 'https://wa.me/5491122334455?text=Recordatorio%3A',
  generadoEn: '2026-11-25T14:00:00Z',
};

export const RECORDATORIO_EMAIL: RecordatorioEmail = {
  recordatorioId: 32,
  estado: 'ENVIADO',
  enviadoEn: '2026-11-25T14:00:05Z',
};

const ANA = { id: 5, nombre: 'Ana', apellido: 'Pérez' };
const PROFESIONAL = { id: 7, nombre: 'Marta', apellido: 'Ríos' };

/** 26/11/2026 10:00 (Argentina). */
export const TURNO_PENDIENTE_SIN_ULTIMO: TurnoPendiente = {
  turnoId: 7,
  inicio: '2026-11-26T13:00:00Z',
  fin: '2026-11-26T13:30:00Z',
  estado: 'PROGRAMADO',
  paciente: ANA,
  profesional: PROFESIONAL,
  tieneTelefono: true,
  tieneEmail: true,
  ultimoRecordatorio: null,
};

/** Sin teléfono ni email cargados. */
export const TURNO_PENDIENTE_SIN_CONTACTO: TurnoPendiente = {
  ...TURNO_PENDIENTE_SIN_ULTIMO,
  turnoId: 8,
  inicio: '2026-11-26T15:30:00Z',
  fin: '2026-11-26T16:00:00Z',
  estado: 'CONFIRMADO',
  paciente: { id: 6, nombre: 'Luis', apellido: 'Gómez' },
  tieneTelefono: false,
  tieneEmail: false,
};

/** Último intento por email fallido. */
export const TURNO_PENDIENTE_CON_ERROR: TurnoPendiente = {
  ...TURNO_PENDIENTE_SIN_ULTIMO,
  turnoId: 9,
  inicio: '2026-11-26T17:00:00Z',
  fin: '2026-11-26T17:30:00Z',
  ultimoRecordatorio: { canal: 'EMAIL', estado: 'ERROR', generadoEn: '2026-11-25T13:00:00Z' },
};

/** Nombre hostil: se debe mostrar como texto literal. */
export const TURNO_PENDIENTE_MALICIOSO: TurnoPendiente = {
  ...TURNO_PENDIENTE_SIN_ULTIMO,
  turnoId: 10,
  inicio: '2026-11-26T18:00:00Z',
  fin: '2026-11-26T18:30:00Z',
  paciente: { id: 9, nombre: '<img src=x onerror=alert(1)>', apellido: '<b>Malo</b>' },
  profesional: { id: 7, nombre: '<img src=y onerror=alert(2)>', apellido: 'Ríos' },
};

function problema(status: number, title: string, extra: Record<string, unknown> = {}) {
  return { type: 'about:blank', title, status, ...extra };
}

export const PROBLEM_422_TELEFONO = problema(422, 'Referencia inválida', {
  errores: [{ campo: 'telefono', mensaje: 'referencia inválida' }],
});
export const PROBLEM_422_EMAIL = problema(422, 'Referencia inválida', {
  errores: [{ campo: 'email', mensaje: 'referencia inválida' }],
});
export const PROBLEM_502 = problema(502, 'No se pudo enviar el email');
export const PROBLEM_503 = problema(503, 'Envío de email no disponible');
