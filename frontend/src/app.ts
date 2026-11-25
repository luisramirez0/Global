import { API_BASE_URL } from './api/config';
import { createAgendaConfigApi } from './api/agendaConfig';
import { createAuditoriaApi } from './api/auditoria';
import { createAuthApi } from './api/auth';
import { createHttpClient } from './api/http';
import { createPacientesApi } from './api/pacientes';
import { createRecordatoriosApi } from './api/recordatorios';
import { createTurnosApi } from './api/turnos';
import { createLayout } from './components/layout';
import { messageForError } from './pages/auth/messages';
import { createFlash, type PageContext } from './pages/context';
import { crearRegistroEnviosSinConfirmar } from './pages/recordatorios/dominio/enviosSinConfirmar';
import { createRouter, type Router } from './router/router';
import { HOME_PATH, LOGIN_PATH, NAV_ITEMS, REDIRECTS, ROUTES } from './router/routes';
import { createSession } from './state/session';
import { h } from './utils/dom';

const DEFAULT_TITLE = 'Global';
export const MSG_SESSION_EXPIRED = 'Tu sesión venció. Volvé a ingresar.';

export interface AppDeps {
  baseUrl: string;
  fetchFn: typeof fetch;
  storage: Storage;
  now: () => number;
}

export interface App {
  /** Se resuelve cuando la primera vista (página o error de conexión) está en pantalla. */
  ready: Promise<void>;
  destroy(): void;
}

/** Arranque (design D4): layout, sesión restaurada, perfil con `me()` y router. */
export function mountApp(doc: Document, title: string = DEFAULT_TITLE, deps: Partial<AppDeps> = {}): App {
  const root = doc.getElementById('app');
  if (root === null) {
    throw new Error('No se encontro el contenedor #app en el documento');
  }
  const win = doc.defaultView;
  if (win === null) {
    throw new Error('El documento no tiene ventana asociada');
  }

  const session = createSession({ storage: deps.storage ?? win.sessionStorage, now: deps.now ?? (() => Date.now()) });
  const http = createHttpClient({
    baseUrl: deps.baseUrl ?? API_BASE_URL,
    fetchFn: deps.fetchFn ?? ((input, init) => globalThis.fetch(input, init)),
    getToken: () => session.getToken(),
    onUnauthorized: () => session.end('unauthorized'),
  });
  const api = createAuthApi(http);
  const agenda = createAgendaConfigApi(http);
  const turnos = createTurnosApi(http);
  const pacientes = createPacientesApi(http);
  const auditoria = createAuditoriaApi(http);
  const recordatorios = createRecordatoriosApi(http);
  const enviosSinConfirmar = crearRegistroEnviosSinConfirmar();
  const flash = createFlash();

  const layout = createLayout({ appName: title, navItems: NAV_ITEMS, onLogout: () => session.end('logout') });
  root.replaceChildren(layout.root);

  let router: Router | null = null;
  const context: PageContext = {
    api,
    agenda,
    turnos,
    pacientes,
    auditoria,
    recordatorios,
    enviosSinConfirmar,
    session,
    flash,
    navigate: (path) => router?.navigate(path),
  };
  router = createRouter({
    win,
    outlet: layout.main,
    routes: ROUTES,
    context,
    isAuthenticated: () => session.isAuthenticated(),
    appName: title,
    homePath: HOME_PATH,
    loginPath: LOGIN_PATH,
    redirects: REDIRECTS,
  });
  const activeRouter = router;

  const unsubscribe = session.subscribe((event) => {
    layout.update(session.profile());
    if (event.type === 'ended') {
      // Fin de sesión (cierre manual, 401 o vencimiento): nada del usuario anterior queda en memoria (B1 de la revisión).
      enviosSinConfirmar.limpiar();
      if (event.reason !== 'logout') flash.set(MSG_SESSION_EXPIRED);
      // Solo al cerrar: con 'started' el login todavía está cargando el perfil.
      activeRouter.resolve();
    }
  });

  const loading = (): HTMLElement => h('p', { className: 'cargando', attrs: { role: 'status' } }, 'Cargando…');

  async function loadProfile(): Promise<void> {
    try {
      session.setProfile(await api.me());
      activeRouter.start();
    } catch (error) {
      if (!session.isAuthenticated()) {
        // 401 (la sesión ya se cerró) o vencida: al login.
        activeRouter.start();
        return;
      }
      layout.main.replaceChildren(
        h(
          'div',
          { className: 'error-carga', attrs: { role: 'alert' } },
          h('p', {}, messageForError(error)),
          h(
            'button',
            {
              attrs: { type: 'button' },
              on: {
                click: () => {
                  layout.main.replaceChildren(loading());
                  void loadProfile();
                },
              },
            },
            'Reintentar',
          ),
        ),
      );
    }
  }

  async function bootstrap(): Promise<void> {
    if (!session.restore()) {
      activeRouter.start();
      return;
    }
    layout.main.replaceChildren(loading());
    await loadProfile();
  }

  return {
    ready: bootstrap(),
    destroy() {
      activeRouter.stop();
      unsubscribe();
    },
  };
}
