/**
 * Permisos de la UI compartidos entre pantallas (C-12, design D2; KB 03, spec access-control). Solo deciden qué se
 * muestra: el backend sigue autorizando cada request (un 403 se informa con un mensaje fijo).
 */
import type { Rol } from '../api/types';
import type { PageContext } from './context';

export function rolActual(ctx: PageContext): Rol | null {
  return ctx.session.profile()?.usuario.rol ?? null;
}

/** Baja y reactivación de pacientes (`GESTION` en el backend): RECEPCION no. */
export function puedeDarDeBaja(rol: Rol | null): boolean {
  return rol === 'ADMIN' || rol === 'PROFESIONAL';
}
