import { afterEach, describe, expect, it, vi } from 'vitest';
import { ME_OK } from '../api/__fixtures__/auth';
import { createLayout } from './layout';

const MALICIOSO = '<img src=x onerror=alert(1)>';

function setup() {
  const onLogout = vi.fn();
  const layout = createLayout({ appName: 'Global', navItems: [{ path: '/inicio', label: 'Inicio' }], onLogout });
  document.body.replaceChildren(layout.root);
  return { layout, onLogout };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('layout', () => {
  it('sin sesión muestra solo el nombre del producto', () => {
    const { layout } = setup();
    layout.update(null);
    const header = layout.root.querySelector('header');
    expect(header?.textContent).toContain('Global');
    expect(layout.root.querySelector('button')).toBeNull();
    expect(layout.root.querySelector('nav')).toBeNull();
  });

  it('con perfil muestra consultorio, usuario, navegación y Cerrar sesión', () => {
    const { layout } = setup();
    layout.update(ME_OK);
    const header = layout.root.querySelector('header');
    expect(header?.textContent).toContain('Consultorio Sonrisas');
    expect(header?.textContent).toContain('Ana');
    const button = layout.root.querySelector('button');
    expect(button?.textContent).toBe('Cerrar sesión');
    const nav = layout.root.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Principal');
    expect(nav?.querySelector('a')?.getAttribute('href')).toBe('#/inicio');
  });

  it('muestra nombres maliciosos como texto literal', () => {
    const { layout } = setup();
    layout.update({
      usuario: { ...ME_OK.usuario, nombre: MALICIOSO },
      consultorio: { id: 2, nombre: MALICIOSO },
    });
    expect(layout.root.textContent).toContain(MALICIOSO);
    expect(document.querySelector('img')).toBeNull();
  });

  it('Cerrar sesión invoca onLogout', () => {
    const { layout, onLogout } = setup();
    layout.update(ME_OK);
    layout.root.querySelector('button')?.click();
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('al volver a null quita los datos del usuario', () => {
    const { layout } = setup();
    layout.update(ME_OK);
    layout.update(null);
    expect(layout.root.textContent).not.toContain('Ana');
  });

  it('el main es el destino del enlace para saltar al contenido', () => {
    const { layout } = setup();
    expect(layout.main.tagName).toBe('MAIN');
    expect(layout.main.id).toBe('contenido');
    const skip = layout.root.querySelector('a.saltar');
    expect(skip?.textContent).toBe('Saltar al contenido');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    skip?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); // no altera el hash del router
    expect(document.activeElement).toBe(layout.main);
  });
});
