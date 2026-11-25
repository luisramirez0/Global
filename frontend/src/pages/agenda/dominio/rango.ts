/**
 * Rangos de la agenda y calendario puro (design D6 de C-13). Todo en la zona del consultorio y sobre fechas
 * `YYYY-MM-DD`: nunca la zona local del navegador (V-D4), el día de la semana sale de `Date.UTC`.
 */
import { aInstanteUtc, siguienteDia } from '../../../utils/zonaHoraria';

/** Rango `[desde, hasta)` en instantes UTC, como lo pide `GET /turnos`. */
export interface RangoUtc {
  desde: string;
  hasta: string;
}

const DIA_MS = 86_400_000;

const dos = (v: number): string => String(v).padStart(2, '0');

/** Fecha calendario válida → milisegundos UTC de su medianoche; si no, `null`. */
function medianocheUtc(fecha: string): number | null {
  // `siguienteDia` valida la fecha (incluido 30 de febrero) sin tocar la zona local.
  if (siguienteDia(fecha) === null) return null;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (anio === undefined || mes === undefined || dia === undefined) return null;
  return Date.UTC(anio, mes - 1, dia);
}

/** `YYYY-MM-DD` más `n` días de calendario (puede ser negativo), o `null` si la fecha es inválida. */
export function sumarDias(fecha: string, n: number): string | null {
  const base = medianocheUtc(fecha);
  if (base === null) return null;
  const d = new Date(base + n * DIA_MS);
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

/** Lunes de la semana ISO de la fecha, o `null` si es inválida. */
export function lunesDeSemana(fecha: string): string | null {
  const dia = diaSemanaIso(fecha);
  return dia === null ? null : sumarDias(fecha, 1 - dia);
}

/** Lunes a domingo de la semana de la fecha; vacío si la fecha es inválida. */
export function diasDeSemana(fecha: string): string[] {
  const lunes = lunesDeSemana(fecha);
  if (lunes === null) return [];
  const dias: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = sumarDias(lunes, i);
    if (d !== null) dias.push(d);
  }
  return dias;
}

/** 1 = lunes … 7 = domingo, sobre la fecha calendario. */
export function diaSemanaIso(fecha: string): number | null {
  const base = medianocheUtc(fecha);
  if (base === null) return null;
  const dow = new Date(base).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function entre(fechaDesde: string, fechaHasta: string): RangoUtc | null {
  const desde = aInstanteUtc(fechaDesde, '00:00');
  const hasta = aInstanteUtc(fechaHasta, '00:00');
  return desde === null || hasta === null ? null : { desde, hasta };
}

/** `[fecha 00:00, fecha+1 00:00)` en hora del consultorio. */
export function rangoDia(fecha: string): RangoUtc | null {
  const siguiente = siguienteDia(fecha);
  return siguiente === null ? null : entre(fecha, siguiente);
}

/** `[lunes 00:00, lunes siguiente 00:00)`: 7 días, dentro del límite de 42 del backend. */
export function rangoSemana(fecha: string): RangoUtc | null {
  const lunes = lunesDeSemana(fecha);
  if (lunes === null) return null;
  const proximo = sumarDias(lunes, 7);
  return proximo === null ? null : entre(lunes, proximo);
}
