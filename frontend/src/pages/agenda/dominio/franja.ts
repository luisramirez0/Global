/** Franja horaria visible de la agenda, autoexpandible (design D6 de C-13). */
import type { Horario } from '../../../api/types';
import { minutosDelDia } from '../../../utils/zonaHoraria';
import { MINUTOS_POR_DIA, type TramoDia } from './posicion';

/** Sin horarios de atención configurados: 08:00 a 20:00. */
export const FRANJA_POR_DEFECTO: TramoDia = { inicioMin: 8 * 60, finMin: 20 * 60 };

/**
 * Base = menor `horaDesde` y mayor `horaHasta` de todos los horarios; luego se amplía para incluir cada segmento
 * del rango (sobreturnos fuera de horario, turnos de horarios que cambiaron, nocturnos), se redondea hacia afuera
 * a `minutosGrilla` y se acota a `[00:00, 24:00]`. La misma franja sirve para todas las columnas de la vista.
 */
export function calcularFranja(
  horarios: readonly Pick<Horario, 'horaDesde' | 'horaHasta'>[],
  segmentos: readonly TramoDia[],
  minutosGrilla: number,
): TramoDia {
  let inicio = Infinity;
  let fin = -Infinity;
  for (const h of horarios) {
    const desde = minutosDelDia(h.horaDesde);
    const hasta = minutosDelDia(h.horaHasta);
    if (desde === null || hasta === null) continue;
    inicio = Math.min(inicio, desde);
    fin = Math.max(fin, hasta);
  }
  const base = inicio === Infinity ? FRANJA_POR_DEFECTO : { inicioMin: inicio, finMin: fin };

  let inicioMin = base.inicioMin;
  let finMin = base.finMin;
  for (const s of segmentos) {
    inicioMin = Math.min(inicioMin, s.inicioMin);
    finMin = Math.max(finMin, s.finMin);
  }
  return {
    inicioMin: Math.max(0, Math.floor(inicioMin / minutosGrilla) * minutosGrilla),
    finMin: Math.min(MINUTOS_POR_DIA, Math.ceil(finMin / minutosGrilla) * minutosGrilla),
  };
}
