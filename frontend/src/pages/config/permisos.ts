/**
 * Permisos de la configuración en la UI (design D3 de C-11; KB 03, spec access-control). Solo deciden qué se
 * muestra: el backend sigue autorizando cada request (un 403 se informa con un mensaje fijo).
 */
import type { Rol } from '../../api/types';

/** Alta, edición y baja de sillones, prestaciones y horarios. */
export function puedeGestionar(rol: Rol | null): boolean {
  return rol === 'ADMIN' || rol === 'PROFESIONAL';
}

/** Alta y edición de bloqueos: los tres roles. */
export function puedeEditarBloqueo(rol: Rol | null): boolean {
  return rol === 'ADMIN' || rol === 'PROFESIONAL' || rol === 'RECEPCION';
}

/** Borrado de bloqueos: RECEPCION no. */
export function puedeBorrarBloqueo(rol: Rol | null): boolean {
  return puedeGestionar(rol);
}

/** Movida a `pages/permisos.ts` en C-12; se re-exporta para no tocar las pantallas de C-11. */
export { rolActual } from '../permisos';
