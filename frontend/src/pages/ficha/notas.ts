import type { Nota, Pagina } from '../../api/types';
import { h } from '../../utils/dom';
import { formatearFechaHora } from '../../utils/zonaHoraria';
import { MSG_SIN_NOTAS, autorDeNota } from './mensajes';

export const NOTAS_POR_PAGINA = 20;

export interface NotasOpciones {
  inicial: Pagina<Nota>;
}

export interface Notas {
  readonly element: HTMLElement;
  /** Notas ya cargadas y última página pedida (para re-renderizar sin volver a pedirlas, D8). */
  estado(): Pagina<Nota>;
}

function item(nota: Nota): HTMLElement {
  return h(
    'li',
    { className: 'nota' },
    h('p', { className: 'nota-meta' }, `${formatearFechaHora(nota.fecha)} · ${autorDeNota(nota.profesionalId)}`),
    h('p', { className: 'texto-clinico' }, nota.texto),
  );
}

/**
 * Notas clínicas inmutables (C-12b, D7). Tarea 5.3: listado de solo lectura; la tarea 5.5 agrega "Ver más" y el
 * formulario de nota nueva.
 */
export function crearNotas(opciones: NotasOpciones): Notas {
  const titulo = h('h2', { id: 'ficha-notas-titulo' }, 'Notas clínicas');
  const notas = opciones.inicial.contenido;
  const lista = notas.length === 0 ? h('p', {}, MSG_SIN_NOTAS) : h('ul', { className: 'notas' }, ...notas.map(item));
  const element = h('section', { className: 'notas-clinicas', attrs: { 'aria-labelledby': titulo.id } }, titulo, lista);
  return {
    element,
    estado: () => opciones.inicial,
  };
}
