/** Mensajes fijos de la agenda (design D2 de C-13): nunca el title/detail del servidor ni datos del paciente. */
import { MSG_CHECK_FIELDS, MSG_CONNECTION } from '../auth/messages';
import { MSG_SIN_PERMISO } from '../config/mensajes';
import { aFechaHoraLocal } from '../../utils/zonaHoraria';
import type { AvisoHora } from './dominio/precarga';
import type { Rechazo } from './dominio/rechazos';

export const MSG_SOBRETURNO_ROL = 'El sobreturno requiere un usuario profesional o administrador.';

const MSG_SILLON = 'El sillón ya tiene un turno en ese horario.';
const MSG_PROFESIONAL = 'El profesional ya tiene un turno en ese horario.';
const MSG_BLOQUEO = 'El horario está bloqueado.';
const MSG_FUERA_DE_AGENDA = 'El horario no está disponible según las reglas de la agenda. Revisá el horario de atención y la grilla.';
const MSG_REFERENCIA = 'Alguno de los datos elegidos ya no existe; actualizá la agenda.';
const MSG_PROFESIONAL_NO_RESUELTO = 'No se pudo asignar el profesional del consultorio. Contactá al administrador.';
const MSG_VALIDACION_GENERICA = 'No se pudo validar el turno. Revisá los datos e intentá de nuevo.';
const MSG_SIN_IDENTIFICAR = 'No se pudo completar la acción. Es posible que el turno haya cambiado.';
const MSG_NO_EXISTE = 'El turno ya no existe.';
const MSG_DESCONOCIDO = 'Ocurrió un error inesperado. Probá de nuevo o recargá la agenda.';

/** `10:00–10:30` en la zona del consultorio, o vacío si los instantes no son válidos. */
function tramoHorario(inicio: string, fin: string): string {
  const desde = aFechaHoraLocal(inicio);
  const hasta = aFechaHoraLocal(fin);
  return desde === null || hasta === null ? '' : `${desde.hora}–${hasta.hora}`;
}

function conHoraDelConflicto(base: string, inicio: string, fin: string): string {
  const tramo = tramoHorario(inicio, fin);
  return tramo === '' ? base : `${base} Turno en conflicto: ${tramo}.`;
}

export function mensajeRechazo(rechazo: Rechazo): string {
  switch (rechazo.tipo) {
    case 'sillon':
      return conHoraDelConflicto(MSG_SILLON, rechazo.conflicto.inicio, rechazo.conflicto.fin);
    case 'profesional':
      return conHoraDelConflicto(MSG_PROFESIONAL, rechazo.conflicto.inicio, rechazo.conflicto.fin);
    case 'bloqueo':
      return MSG_BLOQUEO;
    case 'fueraDeAgenda':
      return MSG_FUERA_DE_AGENDA;
    case 'referencia':
      return MSG_REFERENCIA;
    case 'profesionalNoResuelto':
      return MSG_PROFESIONAL_NO_RESUELTO;
    case 'validacionGenerica':
      return MSG_VALIDACION_GENERICA;
    case 'sinIdentificar':
      return MSG_SIN_IDENTIFICAR;
    case 'noExiste':
      return MSG_NO_EXISTE;
    case 'campos':
      return MSG_CHECK_FIELDS;
    case 'prohibido':
      return MSG_SIN_PERMISO;
    case 'conexion':
      return MSG_CONNECTION;
    case 'desconocido':
      return MSG_DESCONOCIDO;
    default: {
      const exhaustivo: never = rechazo;
      return exhaustivo;
    }
  }
}

export const MSG_TURNO_CREADO = 'Turno creado.';
export const MSG_CONFIRMAR_SOBRETURNO = 'Se registrará como sobreturno, fuera de las reglas habituales de la agenda. ¿Confirmás?';

/** Aviso no bloqueante junto a la hora sugerida (D12): orientativo, con datos ya cargados. */
export function mensajeAviso(aviso: AvisoHora): string {
  switch (aviso.tipo) {
    case 'ocupada':
      return `La hora sugerida se superpone con otro turno de este sillón (${aviso.desde}–${aviso.hasta}). Podés cambiarla.`;
    case 'fueraDeHorario':
      return 'La hora sugerida está fuera del horario de atención. Podés cambiarla.';
    case 'bloqueada':
      return 'La hora sugerida cae en un bloqueo de la agenda. Podés cambiarla.';
    case 'fueraDeGrilla':
      return 'La hora sugerida no está alineada a la grilla de la agenda. Podés cambiarla.';
    case 'invalida':
      return 'La fecha o la hora no son válidas. Podés cambiarla.';
    default: {
      const exhaustivo: never = aviso;
      return exhaustivo;
    }
  }
}

/* Anuncios de las acciones de estado y de la reprogramación (grupo 6 de C-13). */
export const MSG_TURNO_CONFIRMADO = 'Turno confirmado.';
export const MSG_TURNO_CANCELADO = 'Turno cancelado.';
export const MSG_ASISTENCIA_REGISTRADA = 'Asistencia registrada.';
export const MSG_AUSENCIA_REGISTRADA = 'Ausencia registrada.';
export const MSG_TURNO_REPROGRAMADO = 'Turno reprogramado.';
