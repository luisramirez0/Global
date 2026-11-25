/**
 * Foco y anuncio tras un cambio de turno (design D11 y D12 de C-13). Funciones puras sobre un resumen de lo que
 * estaba renderizado antes de la mutación y de lo que quedó tras la recarga: nunca navegan a otra fecha y nunca
 * usan datos del servidor para armar textos (solo la respuesta ya decodificada y los nombres cargados).
 */
import type { EstadoTurno } from '../../../api/types';
import { aFechaHoraLocal } from '../../../utils/zonaHoraria';
import {
  MSG_ASISTENCIA_REGISTRADA,
  MSG_AUSENCIA_REGISTRADA,
  MSG_TURNO_CANCELADO,
  MSG_TURNO_CONFIRMADO,
  MSG_TURNO_REPROGRAMADO,
} from '../mensajes';
import { etiquetaDia } from './formato';
import type { EntradaTeclado } from './teclado';

/** Un bloque de la grilla: columna (de izquierda a derecha), inicio del tramo y carril. */
export interface EntradaGrilla extends EntradaTeclado {
  carril: number;
}

/** Un ítem de la lista accesible, en el orden en que se muestra, con su día. */
export interface EntradaLista {
  id: number;
  fecha: string;
}

export interface VistaRenderizada {
  /** `null` si la grilla no se renderizó (último recurso: el `h1`). */
  grilla: readonly EntradaGrilla[] | null;
  lista: readonly EntradaLista[];
  /** Los días de la vista (todos tienen su `h2`, también los vacíos). */
  fechas: readonly string[];
}

export type OrigenFoco = 'grilla' | 'lista';
export type DestinoFoco =
  | { tipo: 'turno'; id: number }
  | { tipo: 'grupo' }
  | { tipo: 'diaLista'; fecha: string }
  | { tipo: 'h1' };

const clave = (e: EntradaGrilla): [number, number, number] => [e.inicioMin, e.carril, e.id];

function comparar(a: EntradaGrilla, b: EntradaGrilla): number {
  const [ai, ac, aid] = clave(a);
  const [bi, bc, bid] = clave(b);
  return ai - bi || ac - bc || aid - bid;
}

function masCercanaEnColumnasAdyacentes(grilla: readonly EntradaGrilla[], origen: EntradaGrilla): EntradaGrilla | undefined {
  const columnas = [...new Set(grilla.map((e) => e.columna))];
  if (columnas.length === 0) return undefined;
  // Columna más cercana con turnos; a igual distancia, la de la izquierda.
  const elegida = columnas.reduce((mejor, c) => {
    const dc = Math.abs(c - origen.columna);
    const dm = Math.abs(mejor - origen.columna);
    return dc < dm || (dc === dm && c < mejor) ? c : mejor;
  }, columnas[0] ?? origen.columna);
  return grilla
    .filter((e) => e.columna === elegida)
    .sort((a, b) => Math.abs(a.inicioMin - origen.inicioMin) - Math.abs(b.inicioMin - origen.inicioMin) || comparar(a, b))[0];
}

function focoEnGrilla(antes: VistaRenderizada, despues: VistaRenderizada, turnoId: number): DestinoFoco {
  const grilla = despues.grilla;
  if (grilla === null) return { tipo: 'h1' };
  if (grilla.some((e) => e.id === turnoId)) return { tipo: 'turno', id: turnoId };
  if (grilla.length === 0) return { tipo: 'grupo' };

  const origen = antes.grilla?.find((e) => e.id === turnoId);
  if (origen === undefined) {
    const primero = [...grilla].sort((a, b) => a.inicioMin - b.inicioMin || a.columna - b.columna || comparar(a, b))[0];
    return primero === undefined ? { tipo: 'grupo' } : { tipo: 'turno', id: primero.id };
  }

  const enColumna = grilla.filter((e) => e.columna === origen.columna).sort(comparar);
  if (enColumna.length > 0) {
    const siguiente = enColumna.find((e) => comparar(e, origen) > 0);
    const elegido = siguiente ?? enColumna[enColumna.length - 1];
    if (elegido !== undefined) return { tipo: 'turno', id: elegido.id };
  }
  const adyacente = masCercanaEnColumnasAdyacentes(grilla, origen);
  return adyacente === undefined ? { tipo: 'grupo' } : { tipo: 'turno', id: adyacente.id };
}

function focoEnLista(antes: VistaRenderizada, despues: VistaRenderizada, turnoId: number): DestinoFoco {
  if (despues.lista.some((e) => e.id === turnoId)) return { tipo: 'turno', id: turnoId };
  const indice = antes.lista.findIndex((e) => e.id === turnoId);
  const origen = antes.lista[indice];
  if (origen === undefined) return { tipo: 'h1' };

  const delDia = antes.lista.filter((e) => e.fecha === origen.fecha);
  const posicion = delDia.findIndex((e) => e.id === turnoId);
  const restantes = new Set(despues.lista.filter((e) => e.fecha === origen.fecha).map((e) => e.id));
  const siguiente = delDia.slice(posicion + 1).find((e) => restantes.has(e.id));
  if (siguiente !== undefined) return { tipo: 'turno', id: siguiente.id };
  const anterior = delDia.slice(0, posicion).reverse().find((e) => restantes.has(e.id));
  if (anterior !== undefined) return { tipo: 'turno', id: anterior.id };
  return despues.fechas.includes(origen.fecha) ? { tipo: 'diaLista', fecha: origen.fecha } : { tipo: 'h1' };
}

/** Adónde va el foco tras la mutación de `turnoId` hecha desde la grilla o desde la lista. */
export function focoTrasCambio(antes: VistaRenderizada, despues: VistaRenderizada, turnoId: number, origen: OrigenFoco): DestinoFoco {
  return origen === 'grilla' ? focoEnGrilla(antes, despues, turnoId) : focoEnLista(antes, despues, turnoId);
}

/** El turno sigue mostrándose (en la grilla o en la lista) en esa vista. */
export function sigueVisible(vista: VistaRenderizada, turnoId: number): boolean {
  return (vista.grilla?.some((e) => e.id === turnoId) ?? false) || vista.lista.some((e) => e.id === turnoId);
}

export type CambioAnunciable =
  | { tipo: 'estado'; estado: EstadoTurno }
  | {
      tipo: 'reprogramado';
      /** Inicio del turno devuelto por el `PUT`. */
      inicio: string;
      /** Nombre del sillón nuevo; `null` si no cambió. */
      sillonNombre: string | null;
      fueraDeVista: boolean;
    };

const ANUNCIO_ESTADO: Readonly<Record<EstadoTurno, string>> = {
  PROGRAMADO: MSG_TURNO_REPROGRAMADO,
  CONFIRMADO: MSG_TURNO_CONFIRMADO,
  CANCELADO: MSG_TURNO_CANCELADO,
  ASISTIO: MSG_ASISTENCIA_REGISTRADA,
  AUSENTE: MSG_AUSENCIA_REGISTRADA,
};

/** Texto del `role="status"` tras un cambio exitoso, armado solo con datos del cliente. */
export function anuncioCambio(cambio: CambioAnunciable): string {
  if (cambio.tipo === 'estado') return ANUNCIO_ESTADO[cambio.estado];
  const local = aFechaHoraLocal(cambio.inicio);
  if (local === null) return MSG_TURNO_REPROGRAMADO;
  const enSillon = cambio.sillonNombre === null ? '' : ` en ${cambio.sillonNombre}`;
  const cierre = cambio.fueraDeVista ? '; quedó fuera de esta vista.' : '.';
  return `Turno reprogramado al ${etiquetaDia(local.fecha)} a las ${local.hora}${enSillon}${cierre}`;
}
