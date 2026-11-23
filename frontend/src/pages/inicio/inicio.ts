import type { Page } from '../../router/router';
import { h } from '../../utils/dom';
import type { PageContext } from '../context';

/** Página de bienvenida provisoria: C-13 la reemplaza por la agenda. */
export function renderInicio(ctx: PageContext): Page {
  const profile = ctx.session.profile();
  const element = h(
    'section',
    { className: 'pagina-inicio' },
    h('h1', {}, profile === null ? 'Inicio' : `Hola, ${profile.usuario.nombre}`),
    profile === null ? null : h('p', {}, `Consultorio: ${profile.consultorio.nombre}`),
    h('p', {}, 'La agenda estará disponible próximamente.'),
  );
  return { title: 'Inicio', element };
}
