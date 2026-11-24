/**
 * Validación de los formularios de configuración con las mismas reglas que el backend de C-04 (design D6 de C-11):
 * SillonRequest, PrestacionRequest, HorarioRequest, BloqueoRequest. El servidor sigue siendo la autoridad.
 */
import type { DiaSemana, FiltroBloqueos } from '../../api/types';
import { aInstanteUtc, minutosDelDia, siguienteDia } from '../../utils/zonaHoraria';
import { MSG_REQUIRED, utf8Length } from '../auth/validation';

/**
 * Grilla de la agenda en minutos. Debe coincidir con `GrillaAgenda.MINUTOS` del backend.
 * Provisional (SU-03), pendiente de validar con un odontólogo (PA-03): si cambia, editar ambas constantes.
 */
export const GRILLA_MINUTOS = 15;

const INT_MAX = 2_147_483_647; // `Integer` de Java
const MOTIVO_MAX_BYTES = 255;

export const MSG_DURACION = 'Ingresá la duración en minutos, como número entero mayor a cero.';
export const MSG_DURACION_GRILLA = `La duración debe ser múltiplo de ${GRILLA_MINUTOS} minutos.`;
export const MSG_DIA = 'Elegí un día de la semana.';
export const MSG_HORA = 'Ingresá una hora válida (HH:mm).';
export const MSG_HORA_GRILLA = `La hora debe caer en múltiplos de ${GRILLA_MINUTOS} minutos (por ejemplo 09:00 o 09:15).`;
export const MSG_HORA_ORDEN = 'La hora de fin debe ser posterior a la de inicio.';
export const MSG_FECHA_HORA = 'Ingresá una fecha y hora válidas.';
export const MSG_FIN_ORDEN = 'El fin debe ser posterior al inicio.';
export const MSG_MOTIVO_LARGO = 'El motivo es demasiado largo (máximo 255 caracteres sin tildes).';
export const MSG_FECHA = 'Ingresá una fecha válida.';
export const MSG_RANGO = 'La fecha "hasta" no puede ser anterior a "desde".';

const maxMsg = (max: number): string => `Máximo ${max} caracteres.`;

export type Resultado<T, K extends string = string> = { ok: true; value: T } | { ok: false; errors: Partial<Record<K, string>> };

function resultado<T, K extends string>(errors: Partial<Record<K, string>>, value: () => T): Resultado<T, K> {
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: value() };
}

function nombreObligatorio(value: string, max: number): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return MSG_REQUIRED;
  // `@Size` cuenta unidades UTF-16, igual que `length`.
  if (trimmed.length > max) return maxMsg(max);
  return undefined;
}

export function validarSillon(input: { nombre: string }): Resultado<{ nombre: string }, 'nombre'> {
  const errors: Partial<Record<'nombre', string>> = {};
  const nombre = nombreObligatorio(input.nombre, 100);
  if (nombre !== undefined) errors.nombre = nombre;
  return resultado(errors, () => ({ nombre: input.nombre.trim() }));
}

type CamposPrestacion = 'nombre' | 'duracionMinutos';

export function validarPrestacion(input: {
  nombre: string;
  duracion: string;
}): Resultado<{ nombre: string; duracionMinutos: number }, CamposPrestacion> {
  const errors: Partial<Record<CamposPrestacion, string>> = {};
  const nombre = nombreObligatorio(input.nombre, 150);
  if (nombre !== undefined) errors.nombre = nombre;

  const raw = input.duracion.trim();
  const minutos = Number(raw);
  if (raw === '') errors.duracionMinutos = MSG_REQUIRED;
  else if (!/^\d+$/.test(raw) || minutos <= 0 || minutos > INT_MAX) errors.duracionMinutos = MSG_DURACION;
  else if (minutos % GRILLA_MINUTOS !== 0) errors.duracionMinutos = MSG_DURACION_GRILLA;

  return resultado(errors, () => ({ nombre: input.nombre.trim(), duracionMinutos: minutos }));
}

/** `HH:mm`, o `HH:mm:00` de algunos navegadores normalizado a `HH:mm`. */
function normalizarHora(value: string): string {
  return /^\d{2}:\d{2}:00(\.0+)?$/.test(value) ? value.slice(0, 5) : value;
}

function validarHora(value: string): { hora: string; minutos: number } | string {
  if (value.trim() === '') return MSG_REQUIRED;
  const hora = normalizarHora(value.trim());
  const minutos = minutosDelDia(hora);
  if (minutos === null) return MSG_HORA;
  if (minutos % GRILLA_MINUTOS !== 0) return MSG_HORA_GRILLA;
  return { hora, minutos };
}

function aDiaSemana(value: string): DiaSemana | null {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 6 || n === 7 ? n : null;
}

type CamposHorario = 'diaSemana' | 'horaDesde' | 'horaHasta';

export function validarHorario(input: {
  diaSemana: string;
  horaDesde: string;
  horaHasta: string;
}): Resultado<{ diaSemana: DiaSemana; horaDesde: string; horaHasta: string }, CamposHorario> {
  const errors: Partial<Record<CamposHorario, string>> = {};
  const dia = /^\d$/.test(input.diaSemana) ? aDiaSemana(input.diaSemana) : null;
  if (dia === null) errors.diaSemana = MSG_DIA;
  const desde = validarHora(input.horaDesde);
  const hasta = validarHora(input.horaHasta);
  if (typeof desde === 'string') errors.horaDesde = desde;
  if (typeof hasta === 'string') errors.horaHasta = hasta;
  if (typeof desde !== 'string' && typeof hasta !== 'string' && desde.minutos >= hasta.minutos) {
    errors.horaHasta = MSG_HORA_ORDEN;
  }
  return resultado(errors, () => ({
    diaSemana: dia ?? 1,
    horaDesde: typeof desde === 'string' ? '' : desde.hora,
    horaHasta: typeof hasta === 'string' ? '' : hasta.hora,
  }));
}

/** Valor de `<input type="datetime-local">` en hora del consultorio → instante UTC. */
function validarFechaHora(value: string): string | { iso: string } {
  if (value.trim() === '') return MSG_REQUIRED;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:00(\.0+)?)?$/.exec(value.trim());
  const iso = m === null ? null : aInstanteUtc(m[1] ?? '', m[2] ?? '');
  return iso === null ? MSG_FECHA_HORA : { iso };
}

type CamposBloqueo = 'inicio' | 'fin' | 'motivo';

export function validarBloqueo(input: {
  inicio: string;
  fin: string;
  motivo: string;
}): Resultado<{ inicio: string; fin: string; motivo?: string }, CamposBloqueo> {
  const errors: Partial<Record<CamposBloqueo, string>> = {};
  const inicio = validarFechaHora(input.inicio);
  const fin = validarFechaHora(input.fin);
  if (typeof inicio === 'string') errors.inicio = inicio;
  if (typeof fin === 'string') errors.fin = fin;
  if (typeof inicio !== 'string' && typeof fin !== 'string' && Date.parse(fin.iso) <= Date.parse(inicio.iso)) {
    errors.fin = MSG_FIN_ORDEN;
  }
  const motivo = input.motivo.trim();
  if (utf8Length(motivo) > MOTIVO_MAX_BYTES) errors.motivo = MSG_MOTIVO_LARGO;

  return resultado(errors, () => {
    const value: { inicio: string; fin: string; motivo?: string } = {
      inicio: typeof inicio === 'string' ? '' : inicio.iso,
      fin: typeof fin === 'string' ? '' : fin.iso,
    };
    if (motivo !== '') value.motivo = motivo;
    return value;
  });
}

type CamposFiltro = 'desde' | 'hasta';

/** Filtro por fechas del consultorio: `desde` 00:00 de ese día; `hasta` inclusivo (00:00 del día siguiente). */
export function validarFiltroBloqueos(input: { desde: string; hasta: string }): Resultado<FiltroBloqueos, CamposFiltro> {
  const errors: Partial<Record<CamposFiltro, string>> = {};
  const desde = input.desde.trim() === '' ? undefined : aInstanteUtc(input.desde.trim(), '00:00');
  const diaSiguiente = input.hasta.trim() === '' ? undefined : siguienteDia(input.hasta.trim());
  const hasta = diaSiguiente === undefined ? undefined : diaSiguiente === null ? null : aInstanteUtc(diaSiguiente, '00:00');
  if (desde === null) errors.desde = MSG_FECHA;
  if (hasta === null) errors.hasta = MSG_FECHA;
  if (typeof desde === 'string' && typeof hasta === 'string' && Date.parse(hasta) <= Date.parse(desde)) {
    errors.hasta = MSG_RANGO;
  }
  return resultado(errors, () => {
    const value: FiltroBloqueos = {};
    if (typeof desde === 'string') value.desde = desde;
    if (typeof hasta === 'string') value.hasta = hasta;
    return value;
  });
}
