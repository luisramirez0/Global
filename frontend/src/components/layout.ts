import type { Profile } from '../state/session';
import { h } from '../utils/dom';

/** Layout base (design D4): encabezado, navegación principal y región de contenido. */

export interface NavItem {
  path: string;
  label: string;
}

export interface LayoutOptions {
  appName: string;
  navItems: readonly NavItem[];
  onLogout: () => void;
}

export interface Layout {
  root: HTMLElement;
  main: HTMLElement;
  update(profile: Profile | null): void;
}

export function createLayout(options: LayoutOptions): Layout {
  const main = h('main', { id: 'contenido', attrs: { tabindex: '-1' } });

  const skip = h(
    'a',
    {
      className: 'saltar',
      attrs: { href: '#contenido' },
      on: {
        click: (event) => {
          // Sin cambiar el hash: el router lo interpretaría como una ruta.
          event.preventDefault();
          main.focus();
        },
      },
    },
    'Saltar al contenido',
  );

  const sessionArea = h('div', { className: 'sesion' });
  const navSlot = h('div', { className: 'nav-slot' });
  const header = h('header', { className: 'encabezado' }, h('p', { className: 'marca' }, options.appName), sessionArea);
  const root = h('div', { className: 'app' }, skip, header, navSlot, main);

  function update(profile: Profile | null): void {
    if (profile === null) {
      sessionArea.replaceChildren();
      navSlot.replaceChildren();
      return;
    }
    sessionArea.replaceChildren(
      h('p', { className: 'consultorio' }, profile.consultorio.nombre),
      h('p', { className: 'usuario' }, profile.usuario.nombre),
      h('button', { attrs: { type: 'button' }, on: { click: () => options.onLogout() } }, 'Cerrar sesión'),
    );
    navSlot.replaceChildren(
      h(
        'nav',
        { attrs: { 'aria-label': 'Principal' } },
        h('ul', {}, ...options.navItems.map((item) => h('li', {}, h('a', { attrs: { href: `#${item.path}` } }, item.label)))),
      ),
    );
  }

  update(null);
  return { root, main, update };
}
