/**
 * Transiciones de estado de un turno en la UI (design D11 y D9 de C-13). Copia de RN-AG-05: el backend sigue
 * siendo la autoridad y devuelve 409 si una transición no corresponde.
 */
import type { EstadoTurno } from '../../../api/types';

const TRANSICIONES: Readonly<Record<EstadoTurno, readonly EstadoTurno[]>> = {
  PROGRAMADO: ['CONFIRMADO', 'CANCELADO', 'ASISTIO', 'AUSENTE'],
  CONFIRMADO: ['CANCELADO', 'ASISTIO', 'AUSENTE'],
  CANCELADO: [],
  ASISTIO: [],
  AUSENTE: [],
};

/** Estados a los que puede pasar un turno, en el orden en que se ofrecen las acciones. */
export function transicionesPermitidas(estado: EstadoTurno): readonly EstadoTurno[] {
  return TRANSICIONES[estado];
}

/** Solo `PROGRAMADO` y `CONFIRMADO` se pueden reprogramar. */
export function esReprogramable(estado: EstadoTurno): boolean {
  return estado === 'PROGRAMADO' || estado === 'CONFIRMADO';
}

/** "Asistió"/"Ausente" solo cuando el turno ya empezó; compara instantes UTC, sin zona. */
export function puedeMarcarAsistencia(turno: { inicio: string }, ahoraMs: number): boolean {
  const inicio = Date.parse(turno.inicio);
  return !Number.isNaN(inicio) && inicio <= ahoraMs;
}

/** Texto visible de cada estado: el color nunca es la única señal. */
export const ETIQUETA_ESTADO: Readonly<Record<EstadoTurno, string>> = {
  PROGRAMADO: 'Programado',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
  ASISTIO: 'Asistió',
  AUSENTE: 'Ausente',
};
