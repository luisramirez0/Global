import { describe, expect, it } from 'vitest';
import { SECCIONES_CONFIG } from '../pages/config/nav';
import { NAV_ITEMS, ROUTES } from './routes';

describe('rutas de configuración (C-11)', () => {
  it('cada sección de la navegación de configuración es una ruta protegida registrada', () => {
    for (const { path } of SECCIONES_CONFIG) {
      const route = ROUTES.find((r) => r.path === path);
      expect(route, path).toBeDefined();
      expect(route?.guestOnly).not.toBe(true);
    }
  });

  it('el menú principal lleva a la primera sección', () => {
    expect(NAV_ITEMS).toContainEqual({ path: '/config/sillones', label: 'Configuración' });
    expect(NAV_ITEMS.every((item) => ROUTES.some((r) => r.path === item.path))).toBe(true);
  });
});

describe('rutas de pacientes (C-12a)', () => {
  it.each(['/pacientes', '/pacientes/nuevo', '/pacientes/:id'])('%s es una ruta protegida registrada', (path) => {
    const route = ROUTES.find((r) => r.path === path);
    expect(route, path).toBeDefined();
    expect(route?.guestOnly).not.toBe(true);
  });

  it('el menú principal ofrece "Pacientes" y apunta a una ruta registrada', () => {
    expect(NAV_ITEMS).toContainEqual({ path: '/pacientes', label: 'Pacientes' });
    expect(NAV_ITEMS.every((item) => ROUTES.some((r) => r.path === item.path))).toBe(true);
  });

  it('la ficha no está registrada en C-12a (la registra C-12b)', () => {
    expect(ROUTES.some((r) => r.path.endsWith('/ficha') || r.path.includes('ficha'))).toBe(false);
  });
});
