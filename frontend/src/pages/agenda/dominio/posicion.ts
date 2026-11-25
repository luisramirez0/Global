/**
 * Posición de los turnos en la grilla (design D5 y D6 de C-13). Funciones puras: la granularidad llega como
 * parámetro (`minutosGrilla`, provisoria PA-03) y los minutos del día salen de la zona del consultorio, nunca de
 * la del navegador.
 */
import { aFechaHoraLocal, aInstanteUtc, minutosDelDia, siguienteDia, ZONA_CONSULTORIO } from '../../../utils/zonaHoraria';

export const MINUTOS_POR_DIA = 1440;

export interface TramoDia {
  /** Minutos desde las 00:00 del día del consultorio. */
  inicioMin: number;
  /** Idem; 1440 = 24:00. */
  finMin: number;
}

export interface Posicion {
  /** Fila inicial de la grilla CSS (empieza en 1). */
  fila: number;
  filas: number;
}

/** `fila = floor((inicio − franja) / g) + 1`; `filas = max(1, ceil((fin − franja) / g) − floor((inicio − franja) / g))`. */
export function calcularPosicion(tramo: TramoDia, franja: { franjaInicioMin: number; minutosGrilla: number }): Posicion {
  const { franjaInicioMin, minutosGrilla } = franja;
  const filaInicio = Math.floor((tramo.inicioMin - franjaInicioMin) / minutosGrilla);
  const filaFin = Math.ceil((tramo.finMin - franjaInicioMin) / minutosGrilla);
  return { fila: filaInicio + 1, filas: Math.max(1, filaFin - filaInicio) };
}

export interface SegmentoDia extends TramoDia {
  /** El turno sigue después de las 24:00 de este día ("Continúa"). */
  continua: boolean;
  /** El turno empezó antes de las 00:00 de este día ("Viene del día anterior"). */
  vieneDeAntes: boolean;
}

/** Recorta un turno a `[00:00, 24:00)` de `fecha` en la zona del consultorio; `null` si no toca ese día. */
export function segmentarPorDia(
  turno: { inicio: string; fin: string },
  fecha: string,
  zona: string = ZONA_CONSULTORIO,
): SegmentoDia | null {
  const siguiente = siguienteDia(fecha);
  const inicioDiaIso = aInstanteUtc(fecha, '00:00', zona);
  const finDiaIso = siguiente === null ? null : aInstanteUtc(siguiente, '00:00', zona);
  const inicio = Date.parse(turno.inicio);
  const fin = Date.parse(turno.fin);
  if (inicioDiaIso === null || finDiaIso === null || Number.isNaN(inicio) || Number.isNaN(fin)) return null;
  const inicioDia = Date.parse(inicioDiaIso);
  const finDia = Date.parse(finDiaIso);
  if (fin <= inicioDia || inicio >= finDia) return null;

  const vieneDeAntes = inicio < inicioDia;
  const continua = fin > finDia;
  const inicioMin = vieneDeAntes ? 0 : minutosLocales(turno.inicio, zona);
  const finMin = continua || fin === finDia ? MINUTOS_POR_DIA : minutosLocales(turno.fin, zona);
  if (inicioMin === null || finMin === null) return null;
  return { inicioMin, finMin, continua, vieneDeAntes };
}

function minutosLocales(iso: string, zona: string): number | null {
  const local = aFechaHoraLocal(iso, zona);
  return local === null ? null : minutosDelDia(local.hora);
}

export interface Carril {
  /** Posición horizontal dentro del grupo de turnos que se superponen (desde 0). */
  carril: number;
  /** Cantidad de carriles del grupo: el ancho de cada bloque es `1 / carriles`. */
  carriles: number;
}

/**
 * Reparte en carriles los turnos de una columna que se superponen (intervalos semiabiertos `[inicio, fin)`):
 * asignación voraz por hora de inicio. El resultado respeta el orden de entrada.
 */
export function asignarCarriles(segmentos: readonly TramoDia[]): Carril[] {
  const resultado: Carril[] = segmentos.map(() => ({ carril: 0, carriles: 1 }));
  const orden = segmentos
    .map((_s, indice) => indice)
    .sort((a, b) => {
      const sa = segmentos[a];
      const sb = segmentos[b];
      if (sa === undefined || sb === undefined) return 0;
      return sa.inicioMin - sb.inicioMin || sa.finMin - sb.finMin || a - b;
    });

  let grupo: number[] = [];
  let finGrupo = -Infinity;
  let finPorCarril: number[] = [];

  const cerrarGrupo = (): void => {
    for (const indice of grupo) {
      const asignado = resultado[indice];
      if (asignado !== undefined) asignado.carriles = finPorCarril.length;
    }
    grupo = [];
    finPorCarril = [];
  };

  for (const indice of orden) {
    const seg = segmentos[indice];
    const asignado = resultado[indice];
    if (seg === undefined || asignado === undefined) continue;
    if (seg.inicioMin >= finGrupo) cerrarGrupo();
    let carril = finPorCarril.findIndex((fin) => fin <= seg.inicioMin);
    if (carril === -1) {
      carril = finPorCarril.length;
      finPorCarril.push(seg.finMin);
    } else {
      finPorCarril[carril] = seg.finMin;
    }
    asignado.carril = carril;
    grupo.push(indice);
    finGrupo = Math.max(finGrupo, seg.finMin);
  }
  cerrarGrupo();
  return resultado;
}
