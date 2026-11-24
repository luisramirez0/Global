/**
 * Conversión entre la hora del consultorio y UTC (design D4 de C-11).
 *
 * Se apoya solo en `Intl.DateTimeFormat` con `timeZone` explícito y en aritmética sobre `Date.UTC`: nunca usa
 * la zona local del proceso (`getHours`, `setHours`, `new Date('YYYY-MM-DDTHH:mm')`), así que el resultado es el
 * mismo en cualquier navegador o entorno de test.
 */

/** Valor por defecto de `consultorio.zona_horaria`; `/me` todavía no la expone (pendiente de backend). */
export const ZONA_CONSULTORIO = 'America/Argentina/Buenos_Aires';

export interface FechaHora {
  /** `YYYY-MM-DD` */
  fecha: string;
  /** `HH:mm` */
  hora: string;
}

interface Partes {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

const MINUTO_MS = 60_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zona: string): Intl.DateTimeFormat {
  let f = formatters.get(zona);
  if (f === undefined) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(zona, f);
  }
  return f;
}

function partesEnZona(epochMs: number, zona: string): Partes {
  const valores: Record<string, number> = {};
  for (const parte of formatter(zona).formatToParts(new Date(epochMs))) {
    if (parte.type !== 'literal') valores[parte.type] = Number(parte.value);
  }
  return {
    anio: valores['year'] ?? NaN,
    mes: valores['month'] ?? NaN,
    dia: valores['day'] ?? NaN,
    hora: valores['hour'] ?? NaN,
    minuto: valores['minute'] ?? NaN,
    segundo: valores['second'] ?? NaN,
  };
}

/** Diferencia (ms) entre la hora de pared de la zona y UTC en ese instante. */
function offsetMs(epochMs: number, zona: string): number {
  const p = partesEnZona(epochMs, zona);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return comoUtc - Math.floor(epochMs / 1000) * 1000;
}

const dos = (n: number): string => String(n).padStart(2, '0');

function parsearFecha(fecha: string): { anio: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (m === null) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return { anio, mes, dia };
}

/** `HH:mm` válida (00:00–23:59) → minutos desde medianoche; si no, `null`. */
export function minutosDelDia(hora: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  if (m === null) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function aIso(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('.000Z', 'Z');
}

/** Fecha y hora de pared en la zona del consultorio → instante UTC ISO-8601, o `null` si son inválidas. */
export function aInstanteUtc(fecha: string, hora: string, zona: string = ZONA_CONSULTORIO): string | null {
  const f = parsearFecha(fecha);
  const minutos = minutosDelDia(hora);
  if (f === null || minutos === null) return null;
  const pared = Date.UTC(f.anio, f.mes - 1, f.dia) + minutos * MINUTO_MS;
  // Dos pasadas: si la zona cambiara de offset (horario de verano) entre la estimación y el resultado.
  let instante = pared - offsetMs(pared, zona);
  const corregido = pared - offsetMs(instante, zona);
  if (corregido !== instante) instante = corregido;
  return aIso(instante);
}

/** Instante ISO-8601 → fecha y hora de pared en la zona del consultorio, o `null` si no es un instante. */
export function aFechaHoraLocal(iso: string, zona: string = ZONA_CONSULTORIO): FechaHora | null {
  const epoch = Date.parse(iso);
  if (iso === '' || Number.isNaN(epoch)) return null;
  const p = partesEnZona(epoch, zona);
  return { fecha: `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`, hora: `${dos(p.hora)}:${dos(p.minuto)}` };
}

/** Fecha de hoy (`YYYY-MM-DD`) en la zona del consultorio, no en UTC (V-D8). */
export function hoyEnZona(nowMs: number, zona: string = ZONA_CONSULTORIO): string {
  const p = partesEnZona(nowMs, zona);
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`;
}

/** `YYYY-MM-DD` del día siguiente (calendario puro), o `null` si la fecha es inválida. */
export function siguienteDia(fecha: string): string | null {
  const f = parsearFecha(fecha);
  if (f === null) return null;
  const d = new Date(Date.UTC(f.anio, f.mes - 1, f.dia + 1));
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

/** `dd/mm/aaaa HH:mm` en la zona del consultorio; vacío si el instante es inválido. */
export function formatearFechaHora(iso: string, zona: string = ZONA_CONSULTORIO): string {
  const local = aFechaHoraLocal(iso, zona);
  if (local === null) return '';
  const [anio, mes, dia] = local.fecha.split('-');
  return `${dia ?? ''}/${mes ?? ''}/${anio ?? ''} ${local.hora}`;
}
