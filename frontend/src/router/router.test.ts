import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from '../utils/dom';
import { createRouter, parseHash, type Page, type Route, type Router } from './router';

interface Ctx {
  label: string;
}

let authenticated = false;
let outlet: HTMLElement;
let router: Router | null = null;
const renders: string[] = [];
const disposed: string[] = [];

function page(name: string, title: string): Page {
  renders.push(name);
  return {
    title,
    element: h('section', {}, h('h1', {}, title)),
    dispose: () => disposed.push(name),
  };
}

const routes: Route<Ctx>[] = [
  { path: '/login', guestOnly: true, render: () => page('login', 'Iniciar sesión') },
  { path: '/registro', guestOnly: true, render: () => page('registro', 'Registro') },
  { path: '/inicio', render: () => page('inicio', 'Inicio') },
];

function setHash(hash: string): void {
  window.history.replaceState(null, '', hash === '' ? window.location.pathname : hash);
}

function start(): Router {
  router = createRouter<Ctx>({
    win: window,
    outlet,
    routes,
    context: { label: 'x' },
    isAuthenticated: () => authenticated,
    appName: 'Global',
    homePath: '/inicio',
    loginPath: '/login',
  });
  router.start();
  return router;
}

beforeEach(() => {
  authenticated = false;
  renders.length = 0;
  disposed.length = 0;
  outlet = h('main');
  document.body.replaceChildren(outlet);
  setHash('');
});

afterEach(() => {
  router?.stop();
  router = null;
  document.body.replaceChildren();
});

describe('parseHash', () => {
  it.each([
    ['', '/'],
    ['#', '/'],
    ['#/', '/'],
    ['#/login', '/login'],
    ['#/login?x=1', '/login'],
    ['#contenido', '/contenido'],
  ])('%j → %j', (hash, path) => {
    expect(parseHash(hash)).toBe(path);
  });
});

describe('guard', () => {
  it('protegida sin sesión redirige a login sin renderizar la protegida', () => {
    setHash('#/inicio');
    start();
    expect(window.location.hash).toBe('#/login');
    expect(renders).toEqual(['login']);
  });

  it('la redirección reemplaza la entrada del historial', () => {
    setHash('#/inicio');
    const before = window.history.length;
    const push = vi.spyOn(window.history, 'pushState');
    start();
    expect(push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(before);
    push.mockRestore();
  });

  it.each(['#/login', '#/registro'])('%s con sesión redirige a inicio', (hash) => {
    authenticated = true;
    setHash(hash);
    start();
    expect(window.location.hash).toBe('#/inicio');
    expect(renders).toEqual(['inicio']);
  });

  it.each(['', '#/', '#/no-existe'])('%j con sesión resuelve a inicio', (hash) => {
    authenticated = true;
    setHash(hash);
    start();
    expect(window.location.hash).toBe('#/inicio');
  });

  it('ruta desconocida sin sesión termina en login', () => {
    setHash('#/no-existe');
    start();
    expect(window.location.hash).toBe('#/login');
  });

  it('resolve tras perder la sesión redirige a login', () => {
    authenticated = true;
    setHash('#/inicio');
    const r = start();
    authenticated = false;
    r.resolve();
    expect(window.location.hash).toBe('#/login');
    expect(renders).toEqual(['inicio', 'login']);
    expect(disposed).toEqual(['inicio']);
  });
});

describe('navegación', () => {
  it('navigate agrega una entrada al historial y renderiza', () => {
    setHash('#/login');
    const r = start();
    const push = vi.spyOn(window.history, 'pushState');
    r.navigate('/registro');
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/registro');
    expect(renders).toEqual(['login', 'registro']);
    expect(disposed).toEqual(['login']);
    push.mockRestore();
  });

  it('navigate a la ruta actual no vuelve a renderizar', () => {
    setHash('#/login');
    const r = start();
    r.navigate('/login');
    expect(renders).toEqual(['login']);
  });

  it('reacciona a hashchange', () => {
    setHash('#/login');
    start();
    setHash('#/registro');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(renders).toEqual(['login', 'registro']);
  });

  it('stop deja de escuchar', () => {
    setHash('#/login');
    const r = start();
    r.stop();
    setHash('#/registro');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(renders).toEqual(['login']);
  });

  it('actualiza el título y enfoca el h1 de la página', () => {
    setHash('#/login');
    const r = start();
    r.navigate('/registro');
    expect(document.title).toBe('Registro · Global');
    const h1 = outlet.querySelector('h1');
    expect(document.activeElement).toBe(h1);
    expect(h1?.getAttribute('tabindex')).toBe('-1');
  });

  it('reemplaza el contenido del outlet', () => {
    setHash('#/login');
    const r = start();
    r.navigate('/registro');
    expect(outlet.querySelectorAll('section')).toHaveLength(1);
    expect(r.currentPath()).toBe('/registro');
  });
});

/*
 * Rutas con parámetro (C-12, design D1 / A-D1). Casos nuevos con rutas de prueba propias: los de arriba no cambian.
 */
describe('rutas con parámetro', () => {
  const vistos: { name: string; params: Readonly<Record<string, number>> | undefined }[] = [];

  function paramPage(name: string, title: string, params?: Readonly<Record<string, number>>): Page {
    vistos.push({ name, params });
    return page(name, title);
  }

  const paramRoutes: Route<Ctx>[] = [
    ...routes,
    { path: '/x/nuevo', render: () => paramPage('x-nuevo', 'Nuevo') },
    { path: '/x/:id', render: (_ctx, params) => paramPage('x-detalle', 'Detalle', params) },
    { path: '/x/:id/y', render: (_ctx, params) => paramPage('x-y', 'Sub', params) },
    { path: '/a/:id/b/:otro', render: (_ctx, params) => paramPage('a-b', 'Dos', params) },
  ];

  function startWith(list: readonly Route<Ctx>[]): Router {
    router = createRouter<Ctx>({
      win: window,
      outlet,
      routes: list,
      context: { label: 'x' },
      isAuthenticated: () => authenticated,
      appName: 'Global',
      homePath: '/inicio',
      loginPath: '/login',
    });
    router.start();
    return router;
  }

  beforeEach(() => {
    vistos.length = 0;
    authenticated = true;
  });

  it('un id válido se entrega como número', () => {
    setHash('#/x/12');
    startWith(paramRoutes);
    expect(window.location.hash).toBe('#/x/12');
    expect(vistos).toEqual([{ name: 'x-detalle', params: { id: 12 } }]);
  });

  it('resuelve parámetros en segmentos intermedios y varios parámetros', () => {
    setHash('#/x/7/y');
    const r = startWith(paramRoutes);
    r.navigate('/a/3/b/40');
    expect(vistos).toEqual([
      { name: 'x-y', params: { id: 7 } },
      { name: 'a-b', params: { id: 3, otro: 40 } },
    ]);
  });

  it('acepta el entero seguro más grande', () => {
    setHash(`#/x/${Number.MAX_SAFE_INTEGER}`);
    startWith(paramRoutes);
    expect(vistos).toEqual([{ name: 'x-detalle', params: { id: Number.MAX_SAFE_INTEGER } }]);
  });

  it('la ruta exacta gana sobre el patrón', () => {
    setHash('#/x/nuevo');
    startWith(paramRoutes);
    expect(renders).toEqual(['x-nuevo']);
    expect(window.location.hash).toBe('#/x/nuevo');
  });

  it.each([
    'abc',
    '-1',
    '0',
    '01',
    '1.5',
    '1e3',
    '+5',
    '0x10',
    '５',
    '%31',
    '9007199254740992',
    '9007199254740993',
  ])('id inválido %j → ruta desconocida: va a inicio sin renderizar la página', (id) => {
    setHash(`#/x/${id}`);
    startWith(paramRoutes);
    expect(window.location.hash).toBe('#/inicio');
    expect(renders).toEqual(['inicio']);
    expect(vistos).toEqual([]);
  });

  it.each(['#/x/5/', '#/x/5/z', '#/x//y', '#/x', '#/a/3/b'])(
    'forma que no coincide %j → ruta desconocida',
    (hash) => {
      setHash(hash);
      startWith(paramRoutes);
      expect(window.location.hash).toBe('#/inicio');
      expect(vistos).toEqual([]);
    },
  );

  it('el patrón literal "/x/:id" no se toma como ruta exacta', () => {
    setHash('#/x/:id');
    startWith(paramRoutes);
    expect(window.location.hash).toBe('#/inicio');
    expect(vistos).toEqual([]);
  });

  it('cambiar el id libera la página anterior y renderiza una nueva', () => {
    setHash('#/x/1');
    const r = startWith(paramRoutes);
    r.navigate('/x/2');
    expect(vistos.map((v) => v.params)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(disposed).toEqual(['x-detalle']);
    expect(r.currentPath()).toBe('/x/2');
  });

  it('navegar al mismo id no vuelve a renderizar', () => {
    setHash('#/x/1');
    const r = startWith(paramRoutes);
    r.navigate('/x/1');
    expect(vistos).toHaveLength(1);
  });

  it('reacciona a hashchange entre ids', () => {
    setHash('#/x/1');
    startWith(paramRoutes);
    setHash('#/x/9/y');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(vistos.map((v) => v.name)).toEqual(['x-detalle', 'x-y']);
  });

  it('sin sesión, una ruta con parámetro válido va a login sin renderizarla', () => {
    authenticated = false;
    setHash('#/x/12');
    startWith(paramRoutes);
    expect(window.location.hash).toBe('#/login');
    expect(vistos).toEqual([]);
  });

  it('sin sesión, un id inválido también termina en login', () => {
    authenticated = false;
    setHash('#/x/abc');
    startWith(paramRoutes);
    expect(window.location.hash).toBe('#/login');
    expect(vistos).toEqual([]);
  });

  it('las rutas sin parámetros reciben params vacío', () => {
    const recibidos: unknown[] = [];
    setHash('#/inicio');
    startWith([
      { path: '/login', guestOnly: true, render: () => page('login', 'Login') },
      {
        path: '/inicio',
        render: (_ctx, params) => {
          recibidos.push(params);
          return page('inicio', 'Inicio');
        },
      },
    ]);
    expect(recibidos).toEqual([{}]);
  });

  it.each(['/x/:', '/x/:1d', '/x/:id/:id', '/x/:i-d'])('rechaza un patrón mal formado %j al crear el router', (path) => {
    expect(() => startWith([...routes, { path, render: () => page('mal', 'Mal') }])).toThrowError(/Ruta inválida/);
  });
});
