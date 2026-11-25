/**
 * Precarga del alta desde el turno enfocado y aviso no bloqueante sobre la hora sugerida (design D12 de C-13).
 * Funciones puras: se calculan con el contexto vigente al abrir el diálogo y no se guardan; el aviso usa solo
 * datos ya cargados, nunca inventa ocupación y nunca impide el envío (el backend decide).
 */
import type { Bloqueo, Horario, Turno } from '../../../api/types';
import { aFechaHoraLocal, aInstanteUtc, minutosDelDia } from '../../../utils/zonaHoraria';
import type { Vista } from './columnas';
import { horaLocal } from './formato';
import { diaSemanaIso } from './rango';

export interface ContextoPrecarga {
  vista: Vista;
  fechaVisible: string;
  sillonFiltrado: number | null;
  /** Último turno enfocado desde la última renderización de la vista, o `null`. */
  turnoEnfocadoId: number | null;
  turnosRenderizados: readonly Turno[];
}

export interface Precarga {
  fecha: string;
  /** `HH:mm` o vacío. */
  hora: string;
  sillonId: number | null;
}

/** El turno enfocado solo cuenta si sigue en la vista actual. */
export function turnoEnfocadoVigente(contexto: ContextoPrecarga): Turno | null {
  if (contexto.turnoEnfocadoId === null) return null;
  return contexto.turnosRenderizados.find((t) => t.id === contexto.turnoEnfocadoId) ?? null;
}

/** Fecha y sillón del turno enfocado y, como hora, su fin en la zona del consultorio (00:00 → día siguiente). */
export function precargaNuevoTurno(contexto: ContextoPrecarga): Precarga {
  const turno = turnoEnfocadoVigente(contexto);
  const fin = turno === null ? null : aFechaHoraLocal(turno.fin);
  if (turno !== null && fin !== null) return { fecha: fin.fecha, hora: fin.hora, sillonId: turno.sillonId };
  return { fecha: contexto.fechaVisible, hora: '', sillonId: contexto.sillonFiltrado };
}

export type AvisoHora =
  | { tipo: 'ocupada'; desde: string; hasta: string }
  | { tipo: 'fueraDeHorario' }
  | { tipo: 'bloqueada' }
  | { tipo: 'fueraDeGrilla' }
  | { tipo: 'invalida' };

export interface EntradaAviso {
  fecha: string;
  hora: string;
  sillonId: number | null;
  /** Prestación elegida (su duración) o `null` si todavía no se eligió. */
  prestacion: { duracionMinutos: number } | null;
  turnos: readonly Turno[];
  horarios: readonly Pick<Horario, 'diaSemana' | 'horaDesde' | 'horaHasta'>[];
  bloqueos: readonly Pick<Bloqueo, 'sillonId' | 'inicio' | 'fin'>[];
  minutosGrilla: number;
  /** Qué rango y sillón cubren `turnos`; sin ella se asume que cubren todo. */
  cobertura?: { desde: string; hasta: string; sillonId: number | null };
}

const MINUTO_MS = 60_000;

function cubierto(inicio: number, sillonId: number | null, cobertura: EntradaAviso['cobertura']): boolean {
  if (cobertura === undefined) return true;
  if (inicio < Date.parse(cobertura.desde) || inicio >= Date.parse(cobertura.hasta)) return false;
  return cobertura.sillonId === null || cobertura.sillonId === sillonId;
}

function ocupacion(entrada: EntradaAviso, inicio: number): { desde: string; hasta: string } | null {
  if (entrada.sillonId === null || !cubierto(inicio, entrada.sillonId, entrada.cobertura)) return null;
  const fin = entrada.prestacion === null ? null : inicio + entrada.prestacion.duracionMinutos * MINUTO_MS;
  const solapados = entrada.turnos
    .filter((t) => t.sillonId === entrada.sillonId && t.estado !== 'CANCELADO')
    .filter((t) => {
      const desde = Date.parse(t.inicio);
      const hasta = Date.parse(t.fin);
      // Intervalos semiabiertos [inicio, fin), como el backend.
      return fin === null ? desde <= inicio && inicio < hasta : inicio < hasta && fin > desde;
    })
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  const primero = solapados[0];
  return primero === undefined ? null : { desde: horaLocal(primero.inicio), hasta: horaLocal(primero.fin) };
}

function bloqueada(entrada: EntradaAviso, inicio: number): boolean {
  if (!cubierto(inicio, null, entrada.cobertura && { ...entrada.cobertura, sillonId: null })) return false;
  return entrada.bloqueos.some(
    (b) => (b.sillonId === null || b.sillonId === entrada.sillonId) && Date.parse(b.inicio) <= inicio && inicio < Date.parse(b.fin),
  );
}

export function avisoHoraSugerida(entrada: EntradaAviso): AvisoHora | null {
  const minutos = minutosDelDia(entrada.hora);
  const instante = aInstanteUtc(entrada.fecha, entrada.hora);
  const dia = diaSemanaIso(entrada.fecha);
  if (minutos === null || instante === null || dia === null) return { tipo: 'invalida' };
  const inicio = Date.parse(instante);

  const ocupada = ocupacion(entrada, inicio);
  if (ocupada !== null) return { tipo: 'ocupada', ...ocupada };
  if (bloqueada(entrada, inicio)) return { tipo: 'bloqueada' };

  const dentroDeHorario = entrada.horarios.some((h) => {
    const desde = minutosDelDia(h.horaDesde);
    const hasta = minutosDelDia(h.horaHasta);
    return h.diaSemana === dia && desde !== null && hasta !== null && desde <= minutos && minutos < hasta;
  });
  if (!dentroDeHorario) return { tipo: 'fueraDeHorario' };
  if (minutos % entrada.minutosGrilla !== 0) return { tipo: 'fueraDeGrilla' };
  return null;
}
