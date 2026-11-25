import type { Page } from '../../router/router';
import { h } from '../../utils/dom';

/** Título fijo (design D8): nunca lleva datos del paciente. */
export const TITULO_LISTA = 'Pacientes';

/** Lista y búsqueda de pacientes (C-12, D10). Esqueleto de la tarea 3.3; el contenido llega en la tarea 4.4. */
export function renderPacientes(): Page {
  const element = h('section', { className: 'pagina-pacientes' }, h('h1', {}, TITULO_LISTA));
  return { title: TITULO_LISTA, element };
}
