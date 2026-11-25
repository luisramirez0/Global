import type { NavItem } from '../components/layout';
import { renderAuditoria } from '../pages/auditoria/auditoria';
import { renderBloqueos } from '../pages/config/bloqueos';
import { renderHorarios } from '../pages/config/horarios';
import { CONFIG_HOME } from '../pages/config/nav';
import { renderPrestaciones } from '../pages/config/prestaciones';
import { renderSillones } from '../pages/config/sillones';
import type { PageContext } from '../pages/context';
import { renderAgenda } from '../pages/agenda/agenda';
import { renderRecordatorios } from '../pages/recordatorios/recordatorios';
import { renderLogin } from '../pages/login/login';
import { renderRegistro } from '../pages/registro/registro';
import { HOME_PATH, LOGIN_PATH } from './paths';
import type { Route } from './router';

export { HOME_PATH, LOGIN_PATH };

/**
 * Tabla de rutas. Para sumar una pantalla protegida (C-11..C-15): agregar `{ path, render }` acá y, si va en el
 * menú, una entrada en `NAV_ITEMS`. Las rutas son protegidas salvo que declaren `guestOnly`.
 */
export const ROUTES: readonly Route<PageContext>[] = [
  { path: LOGIN_PATH, guestOnly: true, render: renderLogin },
  { path: '/registro', guestOnly: true, render: renderRegistro },
  // Agenda de turnos (C-13): es la entrada de la aplicación.
  { path: HOME_PATH, render: renderAgenda },
  // Recordatorios de turnos por WhatsApp y email (C-14).
  { path: '/recordatorios', render: renderRecordatorios },
  // Configuración de agenda (C-11).
  { path: '/config/sillones', render: renderSillones },
  { path: '/config/prestaciones', render: renderPrestaciones },
  { path: '/config/horarios', render: renderHorarios },
  { path: '/config/bloqueos', render: renderBloqueos },
  // Auditoría y export de datos de pacientes (C-15).
  { path: '/auditoria', render: renderAuditoria },
];

/** Redirecciones explícitas de rutas retiradas (marcadores viejos). El router las aplica antes del guard. */
export const REDIRECTS: ReadonlyMap<string, string> = new Map([['/inicio', HOME_PATH]]);

export const NAV_ITEMS: readonly NavItem[] = [
  { path: HOME_PATH, label: 'Agenda' },
  { path: '/recordatorios', label: 'Recordatorios' },
  { path: CONFIG_HOME, label: 'Configuración' },
  { path: '/auditoria', label: 'Auditoría', roles: ['ADMIN', 'PROFESIONAL'] },
];
