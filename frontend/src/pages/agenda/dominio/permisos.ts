/**
 * Permisos propios de la agenda (design D3 de C-13). Solo deciden qué se ofrece: el backend sigue autorizando
 * y hoy acepta sobreturno de los tres roles.
 */
import type { Rol } from '../../../api/types';

/**
 * DP-2 (pendiente del product owner): hasta que confirme si `RECEPCION` puede forzar un sobreturno, la UI no se
 * lo ofrece. Es un resguardo de UI, no de seguridad. Si lo confirma, se cambia solo esta función.
 * `rol` sale de `rolActual(ctx)`; sin perfil (`null`) no se ofrece.
 */
export function puedeOfrecerSobreturno(rol: Rol | null): boolean {
  return rol === 'ADMIN' || rol === 'PROFESIONAL';
}
