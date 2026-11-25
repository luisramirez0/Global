import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_OK, jsonResponse, problemResponse } from './api/__fixtures__/auth';
import { SILLON_1, SILLON_2 } from './api/__fixtures__/agendaConfig';
import type { MeResponse, Rol } from './api/types';
import { mountApp, MSG_SESSION_EXPIRED, type App } from './app';
import { MSG_SOLO_LECTURA } from './pages/config/mensajes';
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

const meConRol = (rol: Rol): MeResponse => ({ ...ME_OK, usuario: { ...ME_OK.usuario, rol } });

/** API simulada por ruta: `me()` y las lecturas de la agenda y de la configuración (listas vacías o los sillones). */
function apiFalsa(me: MeResponse = ME_OK) {
  return vi.fn<typeof fetch>((input) => {
    const url = String(input);
    if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, me));
    if (url.includes('/sillones')) return Promise.resolve(jsonResponse(200, [SILLON_1, SILLON_2]));
    if (/\/(turnos|prestaciones|horarios|bloqueos)/.test(url)) return Promise.resolve(jsonResponse(200, []));
    return Promise.resolve(problemResponse(404));
  });
}

const urlsPedidas = (fetchFn: ReturnType<typeof apiFalsa>): string[] => fetchFn.mock.calls.map((c) => String(c[0]));
const pedidosDeTurnos = (fetchFn: ReturnType<typeof apiFalsa>): number => urlsPedidas(fetchFn).filter((u) => u.includes('/turnos')).length;

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
  it('muestra carga, obtiene el perfil con me() antes de cualquier página protegida y renderiza la agenda', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/agenda');
    const fetchFn = apiFalsa();
    const mounted = mount(fetchFn);
    expect(main().querySelector('[role="status"]')?.textContent).toBe('Cargando…');
    await mounted.ready;
    await vi.waitFor(() => expect(pedidosDeTurnos(fetchFn)).toBe(1));
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://api.test/api/auth/me');
    expect(new Headers(fetchFn.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer t1');
    expect(urlsPedidas(fetchFn).slice(1).every((u) => !u.endsWith('/auth/me'))).toBe(true);
    expect(window.location.hash).toBe('#/agenda');
    expect(main().querySelector('h1')?.textContent).toBe('Agenda');
    expect(document.querySelector('header')?.textContent).toContain('Consultorio Sonrisas');
  });

  it('con la API caída ofrece reintentar sin borrar la sesión', async () => {
    storeSession();
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await mount(fetchFn).ready;
    const alert = main().querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No se pudo conectar con el servidor.');
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    const api = apiFalsa();
    fetchFn.mockImplementation(api);
    const retry = [...main().querySelectorAll('button')].find((b) => b.textContent === 'Reintentar');
    retry?.click();
    await vi.waitFor(() => expect(main().querySelector('h1')?.textContent).toBe('Agenda'));
    expect(fetchFn.mock.calls[1]?.[0]).toBe('http://api.test/api/auth/me');
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
  it('Cerrar sesión borra la sesión, va a login y no hace requests nuevos', async () => {
    storeSession();
    const fetchFn = apiFalsa();
    await mount(fetchFn).ready;
    await vi.waitFor(() => expect(pedidosDeTurnos(fetchFn)).toBe(1));
    const antes = fetchFn.mock.calls.length;
    const logout = [...document.querySelectorAll('header button')].find((b) => b.textContent === 'Cerrar sesión');
    expect(logout).toBeDefined();
    (logout as HTMLButtonElement).click();
    expect(window.location.hash).toBe('#/login');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(document.querySelector('header')?.textContent).not.toContain('Ana');
    expect(main().querySelector('[role="status"]')).toBeNull(); // sin aviso de vencimiento
    expect(fetchFn.mock.calls.length).toBe(antes);
  });

  it('al vencer el token vuelve al login con aviso', async () => {
    vi.useFakeTimers();
    storeSession(60_000);
    const fetchFn = apiFalsa();
    await mount(fetchFn).ready;
    expect(window.location.hash).toBe('#/agenda');
    vi.advanceTimersByTime(30_000);
    expect(window.location.hash).toBe('#/login');
    expect(main().querySelector('[role="status"]')?.textContent).toBe(MSG_SESSION_EXPIRED);
  });

  it('volver atrás tras cerrar sesión no muestra la agenda', async () => {
    storeSession();
    const fetchFn = apiFalsa();
    await mount(fetchFn).ready;
    (document.querySelector('header button') as HTMLButtonElement).click();
    window.history.replaceState(null, '', '#/agenda'); // simula la entrada anterior del historial
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(window.location.hash).toBe('#/login');
    expect(main().querySelector('h1')?.textContent).toBe('Iniciar sesión');
  });
});

describe('login de punta a punta con la API simulada', () => {
  it('login → me → agenda, con el token en sessionStorage y el perfil fuera de él', async () => {
    const fetchFn = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) {
        return Promise.resolve(
          jsonResponse(200, { accessToken: 'tok', tokenType: 'Bearer', expiresIn: 1800, usuario: { id: 2, nombre: 'Ana', rol: 'ADMIN' }, consultorioId: 2 }),
        );
      }
      return apiFalsa()(input);
    });
    await mount(fetchFn).ready;
    const email = main().querySelector<HTMLInputElement>('input[name="email"]');
    const password = main().querySelector<HTMLInputElement>('input[name="password"]');
    if (email === null || password === null) throw new Error('sin campos');
    email.value = 'ana@consultorio.test';
    password.value = 'Segura123!';
    main().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/agenda'));
    await vi.waitFor(() => expect(main().querySelector('h1')?.textContent).toBe('Agenda'));
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
    const fetchFn = apiFalsa();
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

describe('7.2 la agenda es la entrada (HOME_PATH = /agenda)', () => {
  it('al abrir con el marcador antiguo #/inicio y sesión restaurada: #/agenda, sin entradas nuevas y una sola carga', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/inicio');
    const largo = window.history.length;
    const push = vi.spyOn(window.history, 'pushState');
    const fetchFn = apiFalsa();
    await mount(fetchFn).ready;
    await vi.waitFor(() => expect(main().querySelector('h1')?.textContent).toBe('Agenda'));
    await vi.waitFor(() => expect(pedidosDeTurnos(fetchFn)).toBe(1));
    expect(window.location.hash).toBe('#/agenda');
    expect(window.history.length).toBe(largo);
    expect(push).not.toHaveBeenCalled();
    // La agenda se renderizó una sola vez: un solo pedido de turnos incluso tras dejar correr los eventos.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(pedidosDeTurnos(fetchFn)).toBe(1);
    push.mockRestore();
  });

  it.each(['', '#/', '#/no-existe', '#/inicio/otra-cosa'])('con sesión %j resuelve a #/agenda', async (hash) => {
    storeSession();
    window.history.replaceState(null, '', hash === '' ? '/' : hash);
    await mount(apiFalsa()).ready;
    expect(window.location.hash).toBe('#/agenda');
    expect(main().querySelector('h1')?.textContent).toBe('Agenda');
  });

  it('sin sesión, #/inicio va a #/login sin pedir nada y tras el login queda #/agenda', async () => {
    window.history.replaceState(null, '', '#/inicio');
    const fetchFn = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) {
        return Promise.resolve(
          jsonResponse(200, { accessToken: 'tok', tokenType: 'Bearer', expiresIn: 1800, usuario: { id: 2, nombre: 'Ana', rol: 'ADMIN' }, consultorioId: 2 }),
        );
      }
      return apiFalsa()(input);
    });
    await mount(fetchFn).ready;
    expect(window.location.hash).toBe('#/login');
    expect(fetchFn).not.toHaveBeenCalled();
    const email = main().querySelector<HTMLInputElement>('input[name="email"]');
    const password = main().querySelector<HTMLInputElement>('input[name="password"]');
    if (email === null || password === null) throw new Error('sin campos');
    email.value = 'ana@consultorio.test';
    password.value = 'Segura123!';
    main().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/agenda'));
  });

  it('durante la navegación, #/inicio redirige a #/agenda y volver atrás no regresa ni hace bucle', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/config/sillones');
    await mount(apiFalsa()).ready;
    const largo = window.history.length;
    window.history.pushState(null, '', '#/inicio');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(window.location.hash).toBe('#/agenda');
    expect(window.history.length).toBe(largo + 1);
    // Un "Atrás" que vuelve a mostrar #/inicio se resuelve otra vez a la agenda, una sola vez.
    window.history.replaceState(null, '', '#/inicio');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(window.location.hash).toBe('#/agenda');
    expect(window.history.length).toBe(largo + 1);
  });

  it.each(['#/login', '#/registro'])('con sesión %s redirige a #/agenda', async (hash) => {
    storeSession();
    window.history.replaceState(null, '', hash);
    await mount(apiFalsa()).ready;
    expect(window.location.hash).toBe('#/agenda');
  });

  it.each(['#/login', '#/registro'])('sin sesión %s se muestra sin pedir datos', async (hash) => {
    window.history.replaceState(null, '', hash);
    const fetchFn = vi.fn<typeof fetch>();
    await mount(fetchFn).ready;
    expect(window.location.hash).toBe(hash);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('7.2 roles y menú', () => {
  const BASE = [
    ['Agenda', '#/agenda'],
    ['Recordatorios', '#/recordatorios'],
    ['Configuración', '#/config/sillones'],
  ];
  const CON_AUDITORIA = [...BASE, ['Auditoría', '#/auditoria']];

  it.each([
    ['ADMIN', CON_AUDITORIA],
    ['PROFESIONAL', CON_AUDITORIA],
    ['RECEPCION', BASE],
  ] as const)('%s llega a #/agenda y ve "Agenda" y "Configuración" (y "Auditoría" según C-15), sin "Inicio"', async (rol, esperados) => {
    storeSession();
    window.history.replaceState(null, '', '#/agenda');
    await mount(apiFalsa(meConRol(rol))).ready;
    expect(main().querySelector('h1')?.textContent).toBe('Agenda');
    const enlaces = [...document.querySelectorAll('nav[aria-label="Principal"] a')].map((a) => [a.textContent, a.getAttribute('href')]);
    expect(enlaces).toEqual(esperados);
    expect(document.querySelector('nav')?.textContent).not.toContain('Inicio');
  });

  it.each([
    ['ADMIN', false],
    ['PROFESIONAL', false],
    ['RECEPCION', true],
  ] as const)('%s en #/config/sillones conserva su comportamiento anterior (solo lectura: %s)', async (rol, soloLectura) => {
    storeSession();
    window.history.replaceState(null, '', '#/config/sillones');
    await mount(apiFalsa(meConRol(rol))).ready;
    await vi.waitFor(() => expect(main().textContent).toContain('Sillón 1'));
    expect(main().textContent?.includes(MSG_SOLO_LECTURA)).toBe(soloLectura);
    expect(main().querySelector('h1')?.textContent).toBe('Sillones');
  });

  it.each(['/config/sillones', '/config/prestaciones', '/config/horarios', '/config/bloqueos'])('%s sigue siendo una ruta protegida alcanzable con sesión', async (path) => {
    storeSession();
    window.history.replaceState(null, '', `#${path}`);
    await mount(apiFalsa()).ready;
    expect(window.location.hash).toBe(`#${path}`);
  });

  it('ida y vuelta Configuración → Agenda: cada pantalla se muestra con el foco en su h1', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/agenda');
    await mount(apiFalsa()).ready;
    expect(document.activeElement).toBe(main().querySelector('h1'));
    window.location.hash = '#/config/sillones';
    await vi.waitFor(() => expect(main().querySelector('h1')?.textContent).toBe('Sillones'));
    expect(document.activeElement).toBe(main().querySelector('h1'));
    window.location.hash = '#/agenda';
    await vi.waitFor(() => expect(main().querySelector('h1')?.textContent).toBe('Agenda'));
    expect(document.activeElement).toBe(main().querySelector('h1'));
    expect(document.title).toBe('Agenda · Global');
  });

  it('la agenda recibe los clientes de turnos y pacientes de la aplicación: pide con la URL base y el token', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/agenda');
    const fetchFn = apiFalsa();
    await mount(fetchFn).ready;
    await vi.waitFor(() => expect(pedidosDeTurnos(fetchFn)).toBe(1));
    const llamada = fetchFn.mock.calls.find((c) => String(c[0]).includes('/turnos'));
    expect(String(llamada?.[0]).startsWith('http://api.test/api/turnos?desde=')).toBe(true);
    expect(new Headers(llamada?.[1]?.headers).get('Authorization')).toBe('Bearer t1');
  });
});

describe('recordatorios (C-14)', () => {
  it.each(['ADMIN', 'PROFESIONAL', 'RECEPCION'] as const)('%s abre #/recordatorios: h1 enfocado y pide los pendientes de mañana con el token', async (rol) => {
    storeSession();
    window.history.replaceState(null, '', '#/recordatorios');
    const fetchFn = apiFalsa(meConRol(rol));
    await mount(fetchFn).ready;
    const h1 = main().querySelector('h1');
    expect(h1?.textContent).toBe('Recordatorios');
    expect(document.activeElement).toBe(h1);
    expect(document.querySelector('nav[aria-label="Principal"] a[href="#/recordatorios"]')?.textContent).toBe('Recordatorios');
    await vi.waitFor(() => expect(urlsPedidas(fetchFn).some((u) => /\/turnos\/pendientes-recordatorio\?fecha=\d{4}-\d{2}-\d{2}$/.test(u))).toBe(true));
    const llamada = fetchFn.mock.calls.find((c) => String(c[0]).includes('/pendientes-recordatorio'));
    expect(new Headers(llamada?.[1]?.headers).get('Authorization')).toBe('Bearer t1');
  });

  it('sin sesión, #/recordatorios lleva a #/login sin pedir nada', async () => {
    window.history.replaceState(null, '', '#/recordatorios');
    const fetchFn = vi.fn<typeof fetch>();
    await mount(fetchFn).ready;
    expect(window.location.hash).toBe('#/login');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('auditoría (C-15)', () => {
  const PAGINA_VACIA = { contenido: [], pagina: 0, tamanio: 20, totalElementos: 0, totalPaginas: 0 };

  it('ADMIN ve "Auditoría" en el menú y la pantalla pide el log con el token', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/auditoria');
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(200, ME_OK))
      .mockResolvedValueOnce(jsonResponse(200, PAGINA_VACIA));
    await mount(fetchFn).ready;
    const link = document.querySelector('nav[aria-label="Principal"] a[href="#/auditoria"]');
    expect(link?.textContent).toBe('Auditoría');
    expect(main().querySelector('h1')?.textContent).toBe('Auditoría');
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    expect(fetchFn.mock.calls[1]?.[0]).toBe('http://api.test/api/auditoria?page=0');
    expect(new Headers(fetchFn.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe('Bearer t1');
  });

  it('RECEPCION no ve el ítem y, si entra por URL, no se pide el log', async () => {
    storeSession();
    window.history.replaceState(null, '', '#/auditoria');
    const recepcion = { ...ME_OK, usuario: { ...ME_OK.usuario, rol: 'RECEPCION' } };
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(200, recepcion));
    await mount(fetchFn).ready;
    expect(document.querySelector('nav[aria-label="Principal"] a[href="#/auditoria"]')).toBeNull();
    expect(main().textContent).toContain('Tu rol no tiene acceso a la auditoría.');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sin sesión #/auditoria redirige al login sin pedir datos', async () => {
    window.history.replaceState(null, '', '#/auditoria');
    const fetchFn = vi.fn<typeof fetch>();
    await mount(fetchFn).ready;
    expect(window.location.hash).toBe('#/login');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('B1 (revisión de C-14) el registro de envíos se vacía al terminar la sesión', () => {
  const PENDIENTE = {
    turnoId: 7,
    inicio: '2026-11-26T13:00:00Z',
    fin: '2026-11-26T13:30:00Z',
    estado: 'PROGRAMADO',
    paciente: { id: 5, nombre: 'Ana', apellido: 'Pérez' },
    profesional: { id: 7, nombre: 'Marta', apellido: 'Ríos' },
    tieneTelefono: true,
    tieneEmail: true,
    ultimoRecordatorio: null,
  };
  const LOGIN = { accessToken: 'tok', tokenType: 'Bearer', expiresIn: 1800, usuario: { id: 2, nombre: 'Ana', rol: 'ADMIN' }, consultorioId: 2 };

  /** Email del turno 7: 500 (incierto). WhatsApp: 401 (cierra la sesión por vencimiento). */
  function api() {
    return vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return Promise.resolve(jsonResponse(200, LOGIN));
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(200, ME_OK));
      if (url.includes('/pendientes-recordatorio')) return Promise.resolve(jsonResponse(200, [PENDIENTE]));
      if (url.endsWith('/recordatorio/email')) return Promise.resolve(problemResponse(500));
      if (url.endsWith('/recordatorio/whatsapp')) return Promise.resolve(problemResponse(401));
      return apiFalsa()(input);
    });
  }
  const emailBtn = (): HTMLButtonElement => {
    const b = [...main().querySelectorAll('button')].find((x) => x.textContent === 'Email');
    if (b === undefined) throw new Error('sin Email');
    return b;
  };
  async function loginYIrARecordatorios(): Promise<void> {
    const email = main().querySelector<HTMLInputElement>('input[name="email"]');
    const password = main().querySelector<HTMLInputElement>('input[name="password"]');
    if (email === null || password === null) throw new Error('sin campos');
    email.value = 'ana@consultorio.test';
    password.value = 'Segura123!';
    main().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/agenda'));
    window.location.hash = '#/recordatorios';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(emailBtn()).toBeDefined());
  }

  it.each([
    ['cierre de sesión manual', async () => {
      ([...document.querySelectorAll('header button')].find((b) => b.textContent === 'Cerrar sesión') as HTMLButtonElement).click();
    }],
    ['401 automático', async () => {
      [...main().querySelectorAll('button')].find((b) => b.textContent === 'WhatsApp')?.click();
      await vi.waitFor(() => expect(window.location.hash).toBe('#/login'));
    }],
  ])('%s: tras volver a iniciar sesión, "Email" del turno marcado vuelve a estar habilitado', async (_n, terminarSesion) => {
    storeSession();
    window.history.replaceState(null, '', '#/recordatorios');
    await mount(api()).ready;
    await vi.waitFor(() => expect(emailBtn()).toBeDefined());
    emailBtn().click();
    await vi.waitFor(() => expect(main().textContent).toContain('Envío por email sin confirmar'));
    await terminarSesion();
    expect(window.location.hash).toBe('#/login');
    expect(main().querySelector('.recordatorio-item')).toBeNull();
    await loginYIrARecordatorios();
    expect(emailBtn().disabled).toBe(false);
  });
});
