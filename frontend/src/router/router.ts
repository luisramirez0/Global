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

/** Parámetros de una ruta con segmentos `:nombre` (C-12, D1): siempre enteros positivos seguros. */
export type RouteParams = Readonly<Record<string, number>>;

export interface Route<C> {
  /**
   * Ruta exacta (`/pacientes`) o con segmentos de parámetro (`/pacientes/:id`). Un parámetro solo coincide con un
   * entero positivo en decimal, sin ceros a la izquierda y no mayor que `Number.MAX_SAFE_INTEGER`; si no, la ruta
   * es desconocida. Las rutas exactas tienen prioridad.
   */
  path: string;
  /** Solo sin sesión (login, registro); con sesión redirige al inicio. */
  guestOnly?: boolean;
  /** `params` está vacío en las rutas sin parámetros. */
  render(context: C, params: RouteParams): Page;
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

const PARAM_NAME = /^:[a-z][A-Za-z0-9]*$/;
const PARAM_VALUE = /^[1-9][0-9]*$/;

/** Un segmento literal o el nombre de un parámetro (sin `:`). */
type Segment = { readonly literal: string } | { readonly param: string };

interface Pattern<C> {
  route: Route<C>;
  segments: readonly Segment[];
}

interface Match<C> {
  route: Route<C>;
  params: RouteParams;
}

function compilePattern<C>(route: Route<C>): Pattern<C> {
  const names = new Set<string>();
  const segments = route.path.split('/').map((segment): Segment => {
    if (!segment.startsWith(':')) return { literal: segment };
    if (!PARAM_NAME.test(segment) || names.has(segment)) {
      throw new Error(`Ruta inválida: ${route.path}`);
    }
    names.add(segment);
    return { param: segment.slice(1) };
  });
  return { route, segments };
}

/** Entero positivo seguro o `null`: nada de signos, decimales, exponentes, ceros a la izquierda ni dígitos no ASCII. */
function parseParam(value: string): number | null {
  if (!PARAM_VALUE.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function matchPattern<C>(pattern: Pattern<C>, path: string): Match<C> | null {
  const parts = path.split('/');
  if (parts.length !== pattern.segments.length) return null;
  const params: Record<string, number> = {};
  for (let i = 0; i < parts.length; i += 1) {
    const segment = pattern.segments[i];
    const part = parts[i];
    if (segment === undefined || part === undefined) return null;
    if ('literal' in segment) {
      if (segment.literal !== part) return null;
    } else {
      const value = parseParam(part);
      if (value === null) return null;
      params[segment.param] = value;
    }
  }
  return { route: pattern.route, params };
}

export function createRouter<C>(config: RouterConfig<C>): Router {
  const { win, outlet, routes, context } = config;
  const isPattern = (r: Route<C>): boolean => r.path.includes(':');
  const byPath = new Map(routes.filter((r) => !isPattern(r)).map((r) => [r.path, r]));
  const patterns = routes.filter(isPattern).map(compilePattern);
  let rendered: { path: string; page: Page } | null = null;
  let started = false;

  function match(path: string): Match<C> | null {
    const exact = byPath.get(path);
    if (exact !== undefined) return { route: exact, params: {} };
    for (const pattern of patterns) {
      const found = matchPattern(pattern, path);
      if (found !== null) return found;
    }
    return null;
  }

  function find(path: string): Match<C> {
    const found = match(path);
    if (found === null) {
      throw new Error(`Ruta no registrada: ${path}`);
    }
    return found;
  }

  function target(requested: string): string {
    const candidate = match(requested) === null ? config.homePath : requested;
    const { route } = find(candidate);
    const authenticated = config.isAuthenticated();
    if (route.guestOnly === true && authenticated) return config.homePath;
    if (route.guestOnly !== true && !authenticated) return config.loginPath;
    return candidate;
  }

  function render(path: string): void {
    const { route, params } = find(path);
    const page = route.render(context, params);
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
