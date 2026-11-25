/**
 * Cuerpos del contrato real de C-08 (knowledge-base/entrega/C-08.md, spec clinical-record) para los tests.
 * Datos clínicos ficticios.
 */
import type { Consentimiento, Ficha, Nota, TextoConsentimiento } from '../types';

export const TEXTO_V1: TextoConsentimiento = {
  version: 'v1',
  contenido: 'Autorizo el tratamiento de mis datos de salud.\nPuedo revocarlo cuando quiera.',
  vigenteDesde: '2026-01-01T03:00:00Z',
};

export const CONSENTIMIENTO_V1: Consentimiento = {
  id: 40,
  versionTexto: 'v1',
  aceptadoEn: '2026-11-20T13:30:00Z',
  registradoPorUsuarioId: 2,
};

export const FICHA_VACIA: Ficha = {
  pacienteId: 7,
  alergias: null,
  medicacionActual: null,
  antecedentesMedicos: null,
  enfermedadesRelevantes: null,
  embarazo: null,
  motivoConsulta: null,
  observaciones: null,
  version: null,
  actualizadaEn: null,
};

export const FICHA_V3: Ficha = {
  pacienteId: 7,
  alergias: 'Penicilina',
  medicacionActual: 'Ibuprofeno 400',
  antecedentesMedicos: null,
  enfermedadesRelevantes: 'Hipertensión',
  embarazo: false,
  motivoConsulta: 'Control',
  observaciones: null,
  version: 3,
  actualizadaEn: '2026-11-21T15:00:00Z',
};

export const NOTA_1: Nota = { id: 50, fecha: '2026-11-21T15:10:00Z', profesionalId: 5, turnoId: null, texto: 'Control de rutina.' };
export const NOTA_2: Nota = { id: 49, fecha: '2026-11-10T14:00:00Z', profesionalId: 5, turnoId: 12, texto: 'Limpieza.\nSin novedades.' };
