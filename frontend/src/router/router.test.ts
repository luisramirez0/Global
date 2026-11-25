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

describe('redirects explícitas (C-13, D10)', () => {
  const rutasConHome: Route<Ctx>[] = [
    { path: '/login', guestOnly: true, render: () => page('login', 'Iniciar sesión') },
    { path: '/home', render: () => page('home', 'Home') },
    { path: '/otra', render: () => page('otra', 'Otra') },
  ];

  function startConRedirects(redirects?: ReadonlyMap<string, string>): Router {
    router = createRouter<Ctx>({
      win: window,
      outlet,
      routes: rutasConHome,
      context: { label: 'x' },
      isAuthenticated: () => authenticated,
      appName: 'Global',
      homePath: '/home',
      loginPath: '/login',
      ...(redirects === undefined ? {} : { redirects }),
    });
    router.start();
    return router;
  }

  // El destino ('/otra') difiere del inicio ('/home'): así se distingue la redirección del *fallback* de ruta desconocida.
  const REDIRECTS = new Map([['/inicio', '/otra']]);

  it('con sesión, #/inicio va a #/otra por replaceState: sin entrada nueva y con un solo render', () => {
    authenticated = true;
    setHash('#/inicio');
    const largo = window.history.length;
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    startConRedirects(REDIRECTS);
    expect(window.location.hash).toBe('#/otra');
    expect(window.history.length).toBe(largo);
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(renders).toEqual(['otra']);
    push.mockRestore();
    replace.mockRestore();
  });

  it('sin sesión, #/inicio va a #/login (el guard manda) sin renderizar la protegida', () => {
    setHash('#/inicio');
    startConRedirects(REDIRECTS);
    expect(window.location.hash).toBe('#/login');
    expect(renders).toEqual(['login']);
  });

  it('el destino de una redirección no se vuelve a redirigir (un solo salto)', () => {
    authenticated = true;
    setHash('#/a');
    startConRedirects(
      new Map([
        ['/a', '/otra'],
        ['/otra', '/home'],
      ]),
    );
    expect(window.location.hash).toBe('#/otra');
    expect(renders).toEqual(['otra']);
  });

  it('una redirección hacia una ruta de invitados con sesión termina en el inicio', () => {
    authenticated = true;
    setHash('#/viejo-login');
    startConRedirects(new Map([['/viejo-login', '/login']]));
    expect(window.location.hash).toBe('#/home');
  });

  it('navegando a #/inicio durante la sesión: queda #/otra, sin una segunda entrada y sin volver a #/inicio', () => {
    authenticated = true;
    setHash('#/home');
    const r = startConRedirects(REDIRECTS);
    const largo = window.history.length;
    r.navigate('/inicio');
    expect(window.location.hash).toBe('#/otra');
    expect(window.history.length).toBe(largo + 1);
    expect(renders).toEqual(['home', 'otra']);
    // El historial no contiene #/inicio: reemplazar al resolver evita el bucle al volver atrás.
    expect(window.history.state).toBeNull();
    expect(r.currentPath()).toBe('/otra');
  });

  it('una redirección tras el login (hashchange) también aplica', () => {
    authenticated = false;
    setHash('#/login');
    startConRedirects(REDIRECTS);
    authenticated = true;
    setHash('#/inicio');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(window.location.hash).toBe('#/otra');
    expect(renders).toEqual(['login', 'otra']);
  });

  it('sin redirects el router se comporta igual: una ruta desconocida va al inicio', () => {
    authenticated = true;
    setHash('#/inicio');
    startConRedirects();
    expect(window.location.hash).toBe('#/home');
    expect(renders).toEqual(['home']);
  });

  it('un mapa vacío tampoco cambia nada', () => {
    authenticated = true;
    setHash('#/otra');
    startConRedirects(new Map());
    expect(window.location.hash).toBe('#/otra');
  });
});
