import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_OK, jsonResponse, problemResponse } from './api/__fixtures__/auth';
import { mountApp, MSG_SESSION_EXPIRED, type App } from './app';
import { SESSION_KEY } from './state/session';

let app: App | null = null;

function storeSession(msFromNow = 600_000): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: 't1', expiresAt: Date.now() + msFromNow }));
}

function mount(fetchFn: typeof fetch, title?: string): App {
  app = mountApp(document, title, { fetchFn, baseUrl: 'http://api.test/api' });
  return app;
}

function main(): HTMLElement {
  const el = document.querySelector('main');
  if (el === null) throw new Error('sin main');
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  app?.destroy();
  app = null;
  document.body.innerHTML = '';
  sessionStorage.clear();
  vi.useRealTimers();
});

describe('mountApp', () => {
  it('sin sesión monta el layout con el nombre del producto y la página de login', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    await mount(fetchFn).ready;
    expect(document.querySelector('#app header')?.textContent).toContain('Global');
    expect(main().querySelector('h1')?.textContent).toBe('Iniciar sesión');
    expect(window.location.hash).toBe('#/login');
    expect(document.title).toBe('Iniciar sesión · Global');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('muestra un nombre de producto malicioso como texto literal, sin crear nodos', async () => {
    await mount(vi.fn<typeof fetch>(), '<img src=x onerror=alert(1)>').ready;
    expect(document.querySelector('header')?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });

  it('lanza un Error descriptivo si falta el contenedor #app', () => {
    document.body.innerHTML = '';
    expect(() => mountApp(document)).toThrowError(/#app/);
  });
});

describe('sesión restaurada', () => {
  it('muestra carga, obtiene el perfil con me() y renderiza inicio', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/inicio');
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ME_OK));
    const mounted = mount(fetchFn);
    expect(main().querySelector('[role="status"]')?.textContent).toBe('Cargando…');
    await mounted.ready;
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://api.test/api/auth/me');
    expect(new Headers(fetchFn.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer t1');
    expect(window.location.hash).toBe('#/inicio');
    expect(main().querySelector('h1')?.textContent).toBe('Hola, Ana');
    expect(document.querySelector('header')?.textContent).toContain('Consultorio Sonrisas');
  });

  it('con la API caída ofrece reintentar sin borrar la sesión', async () => {
    storeSession();
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, ME_OK));
    await mount(fetchFn).ready;
    const alert = main().querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No se pudo conectar con el servidor.');
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    const retry = [...main().querySelectorAll('button')].find((b) => b.textContent === 'Reintentar');
    retry?.click();
    await vi.waitFor(() => expect(main().querySelector('h1')?.textContent).toBe('Hola, Ana'));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('me() con 401 cierra la sesión y muestra el login con aviso', async () => {
    storeSession();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(problemResponse(401));
    await mount(fetchFn).ready;
    expect(window.location.hash).toBe('#/login');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(main().querySelector('[role="status"]')?.textContent).toBe(MSG_SESSION_EXPIRED);
  });
});

describe('cierre de sesión', () => {
  it('Cerrar sesión borra la sesión, va a login y no hace requests', async () => {
    storeSession();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ME_OK));
    await mount(fetchFn).ready;
    const logout = [...document.querySelectorAll('header button')].find((b) => b.textContent === 'Cerrar sesión');
    expect(logout).toBeDefined();
    (logout as HTMLButtonElement).click();
    expect(window.location.hash).toBe('#/login');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(document.querySelector('header')?.textContent).not.toContain('Ana');
    expect(main().querySelector('[role="status"]')).toBeNull(); // sin aviso de vencimiento
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('al vencer el token vuelve al login con aviso', async () => {
    vi.useFakeTimers();
    storeSession(60_000);
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ME_OK));
    await mount(fetchFn).ready;
    expect(window.location.hash).toBe('#/inicio');
    vi.advanceTimersByTime(30_000);
    expect(window.location.hash).toBe('#/login');
    expect(main().querySelector('[role="status"]')?.textContent).toBe(MSG_SESSION_EXPIRED);
  });

  it('volver atrás tras cerrar sesión no muestra inicio', async () => {
    storeSession();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ME_OK));
    await mount(fetchFn).ready;
    (document.querySelector('header button') as HTMLButtonElement).click();
    window.history.replaceState(null, '', '#/inicio'); // simula la entrada anterior del historial
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(window.location.hash).toBe('#/login');
    expect(main().querySelector('h1')?.textContent).toBe('Iniciar sesión');
  });
});

describe('login de punta a punta con la API simulada', () => {
  it('login → me → inicio, con el token en sessionStorage y el perfil fuera de él', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: 'tok',
          tokenType: 'Bearer',
          expiresIn: 1800,
          usuario: { id: 2, nombre: 'Ana', rol: 'ADMIN' },
          consultorioId: 2,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, ME_OK));
    await mount(fetchFn).ready;
    const email = main().querySelector<HTMLInputElement>('input[name="email"]');
    const password = main().querySelector<HTMLInputElement>('input[name="password"]');
    if (email === null || password === null) throw new Error('sin campos');
    email.value = 'ana@consultorio.test';
    password.value = 'Segura123!';
    main().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/inicio'));
    expect(new Headers(fetchFn.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false);
    expect(new Headers(fetchFn.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe('Bearer tok');
    const raw = sessionStorage.getItem(SESSION_KEY) ?? '';
    expect(raw).toContain('tok');
    expect(raw).not.toContain('ana@consultorio.test');
    expect(document.querySelector('header')?.textContent).toContain('Ana');
  });
});

describe('configuración de agenda (C-11)', () => {
  it('el menú ofrece "Configuración" y la pantalla pide los sillones con el token', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/config/sillones');
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(200, ME_OK))
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 1, nombre: 'Sillón 1', activo: true }]));
    await mount(fetchFn).ready;
    const link = document.querySelector('nav[aria-label="Principal"] a[href="#/config/sillones"]');
    expect(link?.textContent).toBe('Configuración');
    expect(main().querySelector('h1')?.textContent).toBe('Sillones');
    await vi.waitFor(() => expect(main().textContent).toContain('Sillón 1'));
    expect(fetchFn.mock.calls[1]?.[0]).toBe('http://api.test/api/sillones');
    expect(new Headers(fetchFn.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe('Bearer t1');
  });

  it.each(['/config/sillones', '/config/prestaciones', '/config/horarios', '/config/bloqueos'])(
    'sin sesión %s redirige al login sin pedir datos',
    async (path) => {
      window.history.replaceState(null, '', `#${path}`);
      const fetchFn = vi.fn<typeof fetch>();
      await mount(fetchFn).ready;
      expect(window.location.hash).toBe('#/login');
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );
});

describe('rutas de pacientes con id inválido (C-12, A-D1)', () => {
  it.each(['#/pacientes/abc', '#/pacientes/-1', '#/pacientes/0', '#/pacientes/01', '#/pacientes/1.5', '#/pacientes/9007199254740993'])(
    'con sesión %s va a inicio sin ninguna request además del me() del arranque',
    async (hash) => {
      storeSession();
      window.history.replaceState(null, '', hash);
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ME_OK));
      await mount(fetchFn).ready;
      expect(window.location.hash).toBe('#/inicio');
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(fetchFn.mock.calls[0]?.[0]).toBe('http://api.test/api/auth/me');
    },
  );

  it.each(['#/pacientes/abc', '#/pacientes/-1'])('sin sesión %s va a login sin requests', async (hash) => {
    window.history.replaceState(null, '', hash);
    const fetchFn = vi.fn<typeof fetch>();
    await mount(fetchFn).ready;
    expect(window.location.hash).toBe('#/login');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('pacientes (C-12a)', () => {
  it('el menú ofrece "Pacientes" a #/pacientes', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/inicio');
    await mount(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ME_OK))).ready;
    const link = document.querySelector('nav[aria-label="Principal"] a[href="#/pacientes"]');
    expect(link?.textContent).toBe('Pacientes');
  });

  it.each([
    ['#/pacientes', 'Pacientes'],
    ['#/pacientes/nuevo', 'Nuevo paciente'],
    ['#/pacientes/7', 'Paciente'],
  ])('con sesión %s renderiza la página "%s"', async (hash, titulo) => {
    storeSession();
    window.history.replaceState(null, '', hash);
    await mount(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ME_OK))).ready;
    expect(window.location.hash).toBe(hash);
    expect(main().querySelector('h1')?.textContent).toBe(titulo);
    expect(document.title).toBe(`${titulo} · Global`);
  });

  it.each(['#/pacientes', '#/pacientes/nuevo', '#/pacientes/7'])('sin sesión %s va a login sin requests', async (hash) => {
    window.history.replaceState(null, '', hash);
    const fetchFn = vi.fn<typeof fetch>();
    await mount(fetchFn).ready;
    expect(window.location.hash).toBe('#/login');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('ficha no registrada en C-12a (tasks 3.4; la reemplaza C-12b)', () => {
  it.each(['#/pacientes/5/ficha', '#/pacientes/1/ficha'])(
    'con sesión ADMIN %s es ruta desconocida: va a inicio y solo se pidió el me() del arranque',
    async (hash) => {
      storeSession();
      window.history.replaceState(null, '', hash);
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ME_OK));
      await mount(fetchFn).ready;
      expect(window.location.hash).toBe('#/inicio');
      expect(fetchFn.mock.calls.map((c) => String(c[0]))).toEqual(['http://api.test/api/auth/me']);
    },
  );
});
