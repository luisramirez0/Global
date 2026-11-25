import type { Page } from '../../router/router';
import { h } from '../../utils/dom';

/** Títulos fijos (design D8): nunca llevan datos del paciente. */
export const TITULO_ALTA = 'Nuevo paciente';
export const TITULO_EDICION = 'Paciente';

/** Alta de paciente (C-12, D9/D11). Esqueleto de la tarea 3.3; el formulario llega en la tarea 4.5. */
export function renderNuevoPaciente(): Page {
  const element = h('section', { className: 'pagina-paciente' }, h('h1', {}, TITULO_ALTA));
  return { title: TITULO_ALTA, element };
}

/** Detalle y edición (C-12, D9/D11). El router ya validó el id (`:id`). Esqueleto de la tarea 3.3. */
export function renderPaciente(): Page {
  const element = h('section', { className: 'pagina-paciente' }, h('h1', {}, TITULO_EDICION));
  return { title: TITULO_EDICION, element };
}
