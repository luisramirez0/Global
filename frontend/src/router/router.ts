/**
 * Router por hash con guard (design D3). Rutas protegidas por defecto; `guestOnly` marca las de autenticación.
 * Las redirecciones del guard reemplazan la entrada del historial; `navigate` agrega una.
 */

export interface Page {
  element: HTMLElement;
  /** Nombre de la página para `document.title`. */
  title: string;
  dispose?: () => void;
}

export interface Route<C> {
  path: string;
  /** Solo sin sesión (login, registro); con sesión redirige al inicio. */
  guestOnly?: boolean;
  render(context: C): Page;
}

export interface RouterConfig<C> {
  win: Window;
  outlet: HTMLElement;
  routes: readonly Route<C>[];
  context: C;
  isAuthenticated: () => boolean;
  appName: string;
  homePath: string;
  loginPath: string;
}

export interface Router {
  start(): void;
  stop(): void;
  navigate(path: string): void;
  /** Vuelve a aplicar el guard sobre la ruta actual (p. ej. tras cerrar la sesión). */
  resolve(): void;
  currentPath(): string | null;
}

export function parseHash(hash: string): string {
  const withoutMark = hash.startsWith('#') ? hash.slice(1) : hash;
  const path = withoutMark.split('?')[0] ?? '';
  if (path === '' || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function createRouter<C>(config: RouterConfig<C>): Router {
  const { win, outlet, routes, context } = config;
  const byPath = new Map(routes.map((r) => [r.path, r]));
  let rendered: { path: string; page: Page } | null = null;
  let started = false;

  function find(path: string): Route<C> {
    const route = byPath.get(path);
    if (route === undefined) {
      throw new Error(`Ruta no registrada: ${path}`);
    }
    return route;
  }

  function target(requested: string): string {
    const known = byPath.get(requested);
    const candidate = known === undefined ? config.homePath : requested;
    const route = find(candidate);
    const authenticated = config.isAuthenticated();
    if (route.guestOnly === true && authenticated) return config.homePath;
    if (route.guestOnly !== true && !authenticated) return config.loginPath;
    return candidate;
  }

  function render(path: string): void {
    const page = find(path).render(context);
    rendered?.page.dispose?.();
    rendered = { path, page };
    outlet.replaceChildren(page.element);
    win.document.title = `${page.title} · ${config.appName}`;
    const heading = page.element.querySelector('h1');
    if (heading !== null) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }

  function resolve(): void {
    const path = target(parseHash(win.location.hash));
    if (win.location.hash !== `#${path}`) {
      win.history.replaceState(win.history.state, '', `#${path}`);
    }
    if (rendered?.path !== path) {
      render(path);
    }
  }

  const onLocationChange = (): void => resolve();

  return {
    start() {
      if (!started) {
        started = true;
        win.addEventListener('hashchange', onLocationChange);
        win.addEventListener('popstate', onLocationChange);
      }
      resolve();
    },
    stop() {
      started = false;
      win.removeEventListener('hashchange', onLocationChange);
      win.removeEventListener('popstate', onLocationChange);
    },
    navigate(path) {
      if (parseHash(win.location.hash) !== path) {
        win.history.pushState(null, '', `#${path}`);
      }
      resolve();
    },
    resolve,
    currentPath() {
      return rendered?.path ?? null;
    },
  };
}
