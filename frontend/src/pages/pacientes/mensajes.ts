/**
 * Mensajes fijos de pacientes (C-12, D3/D8/D10/D11): nunca el title/detail del servidor, el codigo crudo ni datos
 * del paciente.
 */
import { ApiError } from '../../api/errors';
import { messageForError } from '../auth/messages';

export const MSG_CARGANDO = 'Cargando…';
export const MSG_SIN_RESULTADOS = 'No se encontraron pacientes.';
export const MSG_NO_EXISTE = 'El paciente ya no existe. Se actualizó la lista.';
export const MSG_NO_ENCONTRADO = 'Paciente no encontrado.';
export const MSG_SIN_PERMISO = 'No tenés permiso para realizar esta acción.';
export const MSG_BAJA_OK = 'Paciente dado de baja.';
export const MSG_REACTIVADO = 'Paciente reactivado.';
export const MSG_CREADO = 'Paciente creado.';
export const MSG_GUARDADO = 'Cambios guardados.';
export const MSG_DNI_DUPLICADO = 'Ya existe un paciente con ese DNI.';
export const MSG_INACTIVO = 'Este paciente está dado de baja.';

/** 404 → no existe; 403 → sin permiso; el resto, el mensaje fijo por `kind` (A-D3). */
export function mensajeDeError(error: unknown, siNoExiste: string = MSG_NO_EXISTE): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return siNoExiste;
    if (error.kind === 'forbidden') return MSG_SIN_PERMISO;
  }
  return messageForError(error);
}

export function esNoEncontrado(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** "Apellido, Nombre" para mostrar y para etiquetas accesibles; siempre como texto. */
export function nombreCompleto(p: { nombre: string; apellido: string }): string {
  return `${p.apellido}, ${p.nombre}`;
}
