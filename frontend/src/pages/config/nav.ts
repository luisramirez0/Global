import { h } from '../../utils/dom';

/** Secciones de la configuración (design D2 de C-11). El menú principal apunta a la primera. */
export const SECCIONES_CONFIG = [
  { path: '/config/sillones', label: 'Sillones' },
  { path: '/config/prestaciones', label: 'Prestaciones' },
  { path: '/config/horarios', label: 'Horarios de atención' },
  { path: '/config/bloqueos', label: 'Bloqueos de agenda' },
] as const;

export type SeccionConfig = (typeof SECCIONES_CONFIG)[number]['path'];

export const CONFIG_HOME: SeccionConfig = '/config/sillones';

export function renderSubnav(actual: SeccionConfig): HTMLElement {
  return h(
    'nav',
    { className: 'subnav', attrs: { 'aria-label': 'Secciones de configuración' } },
    h(
      'ul',
      {},
      ...SECCIONES_CONFIG.map((s) =>
        h('li', {}, h('a', { attrs: { href: `#${s.path}`, 'aria-current': s.path === actual ? 'page' : false } }, s.label)),
      ),
    ),
  );
}
