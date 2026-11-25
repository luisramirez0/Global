/**
 * Validación de los formularios de la agenda (design D4 de C-13). El servidor sigue siendo la autoridad: estas
 * reglas evitan requests inútiles y marcan cada campo antes de enviar.
 */
import type { TurnoCreateRequest, TurnoReprogramarRequest } from '../../../api/types';
import { utf8Length } from '../../../utils/texto';
import { aInstanteUtc, minutosDelDia } from '../../../utils/zonaHoraria';
import { MSG_REQUIRED } from '../../auth/validation';
import type { Resultado } from '../../config/validacion';

export const MSG_MOTIVO_OBLIGATORIO = 'Indicá el motivo de la cancelación.';
export const MSG_MOTIVO_LARGO_BYTES =
  'El motivo es demasiado largo (máximo 255 bytes; las letras con tilde, la ñ y los emojis ocupan más de uno).';
export const MSG_PACIENTE_OBLIGATORIO = 'Elegí un paciente.';
export const MSG_PRESTACION_OBLIGATORIA = 'Elegí una prestación.';
export const MSG_SILLON_OBLIGATORIO = 'Elegí un sillón.';
export const MSG_FECHA_INVALIDA = 'Ingresá una fecha válida.';
export const MSG_HORA_INVALIDA = 'Ingresá una hora válida (HH:mm).';
export const MSG_NOTAS_LARGAS = 'Máximo 1000 caracteres.';

const MOTIVO_MAX_BYTES = 255;
const NOTAS_MAX = 1000;

export type ValidacionMotivo = { ok: true; value: string } | { ok: false; error: string };

/** Obligatorio en la UI (la API lo acepta opcional), recortado y de hasta 255 bytes UTF-8 (no caracteres). */
export function validarMotivoCancelacion(texto: string): ValidacionMotivo {
  const motivo = texto.trim();
  if (motivo === '') return { ok: false, error: MSG_MOTIVO_OBLIGATORIO };
  if (utf8Length(motivo) > MOTIVO_MAX_BYTES) return { ok: false, error: MSG_MOTIVO_LARGO_BYTES };
  return { ok: true, value: motivo };
}

/** Id de un selector (`value` en texto): entero positivo o `null`. */
function idDeSelector(valor: string): number | null {
  if (!/^[1-9]\d*$/.test(valor)) return null;
  const n = Number(valor);
  return Number.isSafeInteger(n) ? n : null;
}

/** Fecha y hora del consultorio → instante UTC; si no sirven, el error de cada campo. */
function validarInicio(fecha: string, hora: string): { inicio: string } | { fecha?: string; hora?: string } {
  const errores: { fecha?: string; hora?: string } = {};
  const instante = aInstanteUtc(fecha, hora);
  if (fecha === '') errores.fecha = MSG_REQUIRED;
  else if (aInstanteUtc(fecha, '00:00') === null) errores.fecha = MSG_FECHA_INVALIDA;
  if (hora === '') errores.hora = MSG_REQUIRED;
  else if (minutosDelDia(hora) === null) errores.hora = MSG_HORA_INVALIDA;
  if (instante === null || errores.fecha !== undefined || errores.hora !== undefined) return errores;
  return { inicio: instante };
}

export interface AltaTurnoInput {
  /** Id del paciente elegido en el buscador, o `null` si no eligió. */
  pacienteId: number | null;
  /** `value` de los selectores: id en texto o vacío. */
  prestacionId: string;
  sillonId: string;
  /** `YYYY-MM-DD` y `HH:mm` en la zona del consultorio. */
  fecha: string;
  hora: string;
  notas: string;
}

export type CampoAlta = 'pacienteId' | 'prestacionId' | 'sillonId' | 'fecha' | 'hora' | 'notas';

export function validarAltaTurno(input: AltaTurnoInput): Resultado<TurnoCreateRequest, CampoAlta> {
  const errors: Partial<Record<CampoAlta, string>> = {};
  if (input.pacienteId === null) errors.pacienteId = MSG_PACIENTE_OBLIGATORIO;
  const prestacionId = idDeSelector(input.prestacionId);
  if (prestacionId === null) errors.prestacionId = MSG_PRESTACION_OBLIGATORIA;
  const sillonId = idDeSelector(input.sillonId);
  if (sillonId === null) errors.sillonId = MSG_SILLON_OBLIGATORIO;
  const inicio = validarInicio(input.fecha, input.hora);
  if (!('inicio' in inicio)) {
    if (inicio.fecha !== undefined) errors.fecha = inicio.fecha;
    if (inicio.hora !== undefined) errors.hora = inicio.hora;
  }
  const notas = input.notas.trim();
  if (notas.length > NOTAS_MAX) errors.notas = MSG_NOTAS_LARGAS;

  if (
    Object.keys(errors).length > 0 ||
    input.pacienteId === null ||
    prestacionId === null ||
    sillonId === null ||
    !('inicio' in inicio)
  ) {
    return { ok: false, errors };
  }
  const value: TurnoCreateRequest = { pacienteId: input.pacienteId, prestacionId, sillonId, inicio: inicio.inicio };
  if (notas !== '') value.notas = notas;
  return { ok: true, value };
}

export interface ReprogramacionInput {
  fecha: string;
  hora: string;
  sillonId: string;
  /** Sillón actual del turno: solo si cambió viaja `sillonId`. */
  sillonActualId: number;
}

export type CampoReprogramacion = 'fecha' | 'hora' | 'sillonId';

export function validarReprogramacion(input: ReprogramacionInput): Resultado<TurnoReprogramarRequest, CampoReprogramacion> {
  const errors: Partial<Record<CampoReprogramacion, string>> = {};
  const sillonId = idDeSelector(input.sillonId);
  if (sillonId === null) errors.sillonId = MSG_SILLON_OBLIGATORIO;
  const inicio = validarInicio(input.fecha, input.hora);
  if (!('inicio' in inicio)) {
    if (inicio.fecha !== undefined) errors.fecha = inicio.fecha;
    if (inicio.hora !== undefined) errors.hora = inicio.hora;
  }
  if (Object.keys(errors).length > 0 || sillonId === null || !('inicio' in inicio)) return { ok: false, errors };
  const value: TurnoReprogramarRequest = { inicio: inicio.inicio };
  if (sillonId !== input.sillonActualId) value.sillonId = sillonId;
  return { ok: true, value };
}
