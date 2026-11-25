import type { NavItem } from '../components/layout';
import { renderAuditoria } from '../pages/auditoria/auditoria';
import { renderBloqueos } from '../pages/config/bloqueos';
import { renderHorarios } from '../pages/config/horarios';
import { CONFIG_HOME } from '../pages/config/nav';
import { renderPrestaciones } from '../pages/config/prestaciones';
import { renderSillones } from '../pages/config/sillones';
import type { PageContext } from '../pages/context';
import { renderInicio } from '../pages/inicio/inicio';
import { renderLogin } from '../pages/login/login';
import { renderRegistro } from '../pages/registro/registro';
import type { Route } from './router';

/**
 * Tabla de rutas. Para sumar una pantalla protegida (C-11..C-15): agregar `{ path, render }` acá y, si va en el
 * menú, una entrada en `NAV_ITEMS`. Las rutas son protegidas salvo que declaren `guestOnly`.
 */
export const HOME_PATH = '/inicio';
export const LOGIN_PATH = '/login';

export const ROUTES: readonly Route<PageContext>[] = [
  { path: LOGIN_PATH, guestOnly: true, render: renderLogin },
  { path: '/registro', guestOnly: true, render: renderRegistro },
  { path: HOME_PATH, render: renderInicio },
  // Configuración de agenda (C-11).
  { path: '/config/sillones', render: renderSillones },
  { path: '/config/prestaciones', render: renderPrestaciones },
  { path: '/config/horarios', render: renderHorarios },
  { path: '/config/bloqueos', render: renderBloqueos },
  // Auditoría y export de datos de pacientes (C-15).
  { path: '/auditoria', render: renderAuditoria },
];

export const NAV_ITEMS: readonly NavItem[] = [
  { path: HOME_PATH, label: 'Inicio' },
  { path: CONFIG_HOME, label: 'Configuración' },
  { path: '/auditoria', label: 'Auditoría', roles: ['ADMIN', 'PROFESIONAL'] },
];
