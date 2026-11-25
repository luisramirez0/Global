import { describe, expect, it } from 'vitest';
import { SECCIONES_CONFIG } from '../pages/config/nav';
import { HOME_PATH, LOGIN_PATH, NAV_ITEMS, REDIRECTS, ROUTES } from './routes';

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

describe('la agenda como entrada (C-13, D10)', () => {
  it('HOME_PATH es /agenda y LOGIN_PATH sigue siendo /login', () => {
    expect(HOME_PATH).toBe('/agenda');
    expect(LOGIN_PATH).toBe('/login');
  });

  it('/agenda es una ruta protegida (no solo para invitados)', () => {
    const route = ROUTES.find((r) => r.path === '/agenda');
    expect(route).toBeDefined();
    expect(route?.guestOnly).not.toBe(true);
  });

  it('ya no existe la ruta /inicio: se redirige de forma explícita a la agenda', () => {
    expect(ROUTES.some((r) => r.path === '/inicio')).toBe(false);
    expect(REDIRECTS.get('/inicio')).toBe('/agenda');
    expect(REDIRECTS.size).toBe(1);
  });

  it('el destino de una redirección es una ruta registrada y no es a su vez una redirección', () => {
    for (const [, destino] of REDIRECTS) {
      expect(ROUTES.some((r) => r.path === destino)).toBe(true);
      expect(REDIRECTS.has(destino)).toBe(false);
    }
  });

  it('el menú principal es Agenda, Configuración y Auditoría (C-15), en ese orden y sin Inicio', () => {
    expect(NAV_ITEMS).toEqual([
      { path: '/agenda', label: 'Agenda' },
      { path: '/config/sillones', label: 'Configuración' },
      { path: '/auditoria', label: 'Auditoría', roles: ['ADMIN', 'PROFESIONAL'] },
    ]);
  });

  it('regresión: las rutas previas siguen registradas y solo login y registro son para invitados', () => {
    expect(ROUTES.map((r) => r.path).sort()).toEqual(
      ['/agenda', '/auditoria', '/config/bloqueos', '/config/horarios', '/config/prestaciones', '/config/sillones', '/login', '/registro'].sort(),
    );
    expect(ROUTES.filter((r) => r.guestOnly === true).map((r) => r.path).sort()).toEqual(['/login', '/registro']);
    expect(new Set(ROUTES.map((r) => r.path)).size).toBe(ROUTES.length);
  });
});

describe('ruta de auditoría (C-15)', () => {
  it('es una ruta protegida registrada', () => {
    const route = ROUTES.find((r) => r.path === '/auditoria');
    expect(route).toBeDefined();
    expect(route?.guestOnly).not.toBe(true);
  });

  it('el menú la ofrece solo a ADMIN y PROFESIONAL', () => {
    expect(NAV_ITEMS).toContainEqual({ path: '/auditoria', label: 'Auditoría', roles: ['ADMIN', 'PROFESIONAL'] });
  });
});
