/**
 * Mensajes fijos de la historia clínica (C-12b, D3/D4/D5/D6/D7/D8): nunca el title/detail del servidor, el codigo
 * crudo ni datos clínicos o del paciente.
 */
import { ApiError } from '../../api/errors';
import { messageForError } from '../auth/messages';

export const TITULO_FICHA = 'Ficha clínica';

export const MSG_CARGANDO = 'Cargando…';
export const MSG_SIN_PERMISO_FICHA = 'Sin permiso para ver la historia clínica.';
export const MSG_SIN_PERMISO = 'No tenés permiso para realizar esta acción.';
export const MSG_PACIENTE_NO_ENCONTRADO = 'Paciente no encontrado.';

export const MSG_SIN_TEXTO_VIGENTE = 'No hay un texto de consentimiento vigente. Consultá al administrador del consultorio.';
export const MSG_TEXTO_CAMBIO = 'El texto de consentimiento cambió; revisá la versión nueva antes de registrarlo.';
export const MSG_CONSENTIMIENTO_OK = 'Consentimiento registrado.';
export const MSG_CONSENTIMIENTO_REQUERIDO = 'Falta el consentimiento del paciente. Registralo para ver la historia clínica.';
export const MSG_SIN_CONSENTIMIENTO = 'Sin consentimiento registrado.';

export const MSG_INACTIVO = 'Paciente dado de baja: la historia clínica es de solo lectura.';
export const MSG_NO_SE_GUARDO = 'No se pudo guardar: el paciente fue dado de baja.';

export const MSG_FICHA_GUARDADA = 'Ficha guardada.';
export const MSG_FICHA_DESACTUALIZADA = 'Otra persona modificó la ficha. Tus cambios no se guardaron.';
export const MSG_CONFIRMAR_RECARGA = 'Se van a perder los cambios que no guardaste.';
export const MSG_FICHA_ACTUALIZADA = 'Se cargó la versión actual de la ficha.';
export const MSG_SIN_DATO = 'Sin dato';

export const MSG_NOTA_AGREGADA = 'Nota agregada.';
export const MSG_NOTAS_INMUTABLES = 'Las notas no se pueden editar; para corregir, agregá una nota nueva.';
export const MSG_SIN_NOTAS = 'Todavía no hay notas.';
export const MSG_PROFESIONAL_NO_VINCULADO =
  'Tu usuario no está vinculado a un profesional activo; no se puede firmar la nota.';

export const CODIGO_CONSENTIMIENTO_REQUERIDO = 'CONSENTIMIENTO_REQUERIDO';
export const CODIGO_PACIENTE_INACTIVO = 'PACIENTE_INACTIVO';
export const CODIGO_FICHA_DESACTUALIZADA = 'FICHA_DESACTUALIZADA';
export const CODIGO_PROFESIONAL_NO_VINCULADO = 'PROFESIONAL_NO_VINCULADO';

export function tieneCodigo(error: unknown, codigo: string): boolean {
  return error instanceof ApiError && error.codigo === codigo;
}

export function esNoEncontrado(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** 403 → sin permiso; el resto, el mensaje fijo por `kind` (A-D3: un codigo desconocido no cambia el mensaje). */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'forbidden') return MSG_SIN_PERMISO;
  return messageForError(error);
}

/** Autor de una nota. Deuda A-D7: por id hasta que exista un endpoint con nombres de profesionales. */
export function autorDeNota(profesionalId: number): string {
  return `Profesional #${profesionalId}`;
}
