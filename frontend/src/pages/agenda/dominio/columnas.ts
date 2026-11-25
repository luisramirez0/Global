/** Armado de las columnas de la agenda (design D6 de C-13): por sillón en la vista diaria, por día en la semanal. */
import type { Bloqueo, Sillon, Turno } from '../../../api/types';
import { etiquetaDia } from './formato';
import { segmentarPorDia, type SegmentoDia, type TramoDia } from './posicion';
import { diasDeSemana } from './rango';

export type Vista = 'dia' | 'semana';

export interface TurnoEnColumna {
  turno: Turno;
  segmento: SegmentoDia;
}

export interface ColumnaAgenda {
  /** Estable entre renderizaciones (`sillon-1`, `dia-2026-11-24`). */
  clave: string;
  titulo: string;
  fecha: string;
  /** Sillón de la columna (vista diaria) o sillón filtrado (semanal); `null` = todos. */
  sillonId: number | null;
  turnos: TurnoEnColumna[];
  bloqueos: TramoDia[];
}

export interface EntradaColumnas {
  vista: Vista;
  fecha: string;
  /** Todos los sillones conocidos, activos o no (para resolver nombres). */
  sillones: readonly Sillon[];
  /** Turnos ya filtrados por visibilidad (cancelados ocultos, etc.). */
  turnos: readonly Turno[];
  bloqueos: readonly Bloqueo[];
  filtroSillonId: number | null;
}

function tramoEnDia(instantes: { inicio: string; fin: string }, fecha: string): TramoDia | null {
  const segmento = segmentarPorDia(instantes, fecha);
  return segmento === null ? null : { inicioMin: segmento.inicioMin, finMin: segmento.finMin };
}

export function turnosDelDia(turnos: readonly Turno[], fecha: string, sillonId: number | null): TurnoEnColumna[] {
  const resultado: TurnoEnColumna[] = [];
  for (const turno of turnos) {
    if (sillonId !== null && turno.sillonId !== sillonId) continue;
    const segmento = segmentarPorDia(turno, fecha);
    if (segmento !== null) resultado.push({ turno, segmento });
  }
  return resultado;
}

function bloqueosDelDia(bloqueos: readonly Bloqueo[], fecha: string, sillonId: number | null): TramoDia[] {
  const resultado: TramoDia[] = [];
  for (const bloqueo of bloqueos) {
    // Un bloqueo de otro sillón no sombrea esta columna; sin sillón de referencia solo cuentan los de todo el consultorio.
    if (bloqueo.sillonId !== null && bloqueo.sillonId !== sillonId) continue;
    const tramo = tramoEnDia(bloqueo, fecha);
    if (tramo !== null) resultado.push(tramo);
  }
  return resultado;
}

function tituloSillon(id: number, sillones: readonly Sillon[]): string {
  const conocido = sillones.find((s) => s.id === id);
  if (conocido === undefined) return `Sillón ${id}`;
  return conocido.activo ? conocido.nombre : `${conocido.nombre} (inactivo)`;
}

export function armarColumnas(entrada: EntradaColumnas): ColumnaAgenda[] {
  const { vista, fecha, sillones, turnos, bloqueos, filtroSillonId } = entrada;

  if (vista === 'semana') {
    return diasDeSemana(fecha).map((dia) => ({
      clave: `dia-${dia}`,
      titulo: etiquetaDia(dia),
      fecha: dia,
      sillonId: filtroSillonId,
      turnos: turnosDelDia(turnos, dia, filtroSillonId),
      bloqueos: bloqueosDelDia(bloqueos, dia, filtroSillonId),
    }));
  }

  const ids = sillones.filter((s) => s.activo).map((s) => s.id);
  for (const turno of turnos) {
    if (!ids.includes(turno.sillonId)) ids.push(turno.sillonId);
  }
  const visibles = filtroSillonId === null ? ids : ids.filter((id) => id === filtroSillonId);
  return visibles.map((id) => ({
    clave: `sillon-${id}`,
    titulo: tituloSillon(id, sillones),
    fecha,
    sillonId: id,
    turnos: turnosDelDia(turnos, fecha, id),
    bloqueos: bloqueosDelDia(bloqueos, fecha, id),
  }));
}

/** Nombre de un sillón para mostrar en un bloque o en la lista. */
export function nombreSillon(id: number, sillones: readonly Sillon[]): string {
  return tituloSillon(id, sillones);
}
