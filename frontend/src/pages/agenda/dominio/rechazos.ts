/**
 * Clasificación de los rechazos del backend a turnos (design D2, D3 y D11 de C-13). Función pura: decide solo por
 * `status`, `kind`, `conflicto`, `bloqueoId`, los nombres de campo de `fieldErrors` y la acción propia del
 * cliente. NUNCA lee `title` ni `detail`: los 409 genéricos de turnos solo se distinguen por el `title`.
 */
import { ApiError } from '../../../api/errors';
import type { ConflictoTurno } from '../../../api/types';

export type AccionTurno = 'alta' | 'estado' | 'reprogramar';

export interface ContextoRechazo {
  accion: AccionTurno;
}

export type Rechazo =
  | { tipo: 'sillon'; conflicto: ConflictoTurno }
  | { tipo: 'profesional'; conflicto: ConflictoTurno }
  | { tipo: 'sinIdentificar' }
  | { tipo: 'noExiste' }
  | { tipo: 'bloqueo'; bloqueoId: number }
  | { tipo: 'fueraDeAgenda' }
  | { tipo: 'profesionalNoResuelto' }
  | { tipo: 'referencia'; campos: readonly string[] }
  | { tipo: 'validacionGenerica' }
  | { tipo: 'campos'; campos: readonly string[] }
  | { tipo: 'prohibido' }
  | { tipo: 'conexion' }
  | { tipo: 'desconocido' };

const CAMPOS_REFERENCIA: readonly string[] = ['pacienteId', 'prestacionId', 'sillonId'];

function camposDe(error: ApiError): string[] {
  return [...new Set(error.fieldErrors.map((f) => f.campo))];
}

function clasificar422(error: ApiError): Rechazo {
  if (error.bloqueoId !== null) return { tipo: 'bloqueo', bloqueoId: error.bloqueoId };
  const campos = camposDe(error);
  if (campos.includes('inicio')) return { tipo: 'fueraDeAgenda' };
  if (campos.includes('profesionalId')) return { tipo: 'profesionalNoResuelto' };
  const referencias = campos.filter((c) => CAMPOS_REFERENCIA.includes(c));
  if (referencias.length > 0) return { tipo: 'referencia', campos: referencias };
  return { tipo: 'validacionGenerica' };
}

export function clasificarRechazo(error: unknown, contexto: ContextoRechazo): Rechazo {
  if (!(error instanceof ApiError)) return { tipo: 'desconocido' };
  if (error.kind === 'network' || error.kind === 'timeout') return { tipo: 'conexion' };
  switch (error.status) {
    case 400:
      return { tipo: 'campos', campos: camposDe(error) };
    case 403:
      return { tipo: 'prohibido' };
    case 404:
      // Un 404 al crear no es "el turno ya no existe": es una ruta o un recurso inesperado.
      return contexto.accion === 'alta' ? { tipo: 'desconocido' } : { tipo: 'noExiste' };
    case 409:
      return error.conflicto === null
        ? { tipo: 'sinIdentificar' }
        : { tipo: error.conflicto.motivo === 'SILLON' ? 'sillon' : 'profesional', conflicto: error.conflicto };
    case 422:
      return clasificar422(error);
    default:
      return { tipo: 'desconocido' };
  }
}

/** El sobreturno omite el horario, la grilla, los bloqueos y el profesional, nunca el solapamiento de sillón. */
export function admiteSobreturno(rechazo: Rechazo): boolean {
  return rechazo.tipo === 'profesional' || rechazo.tipo === 'fueraDeAgenda' || rechazo.tipo === 'bloqueo';
}

/** Causas no identificables: se muestra "Recargar agenda" y la recarga la decide la persona (D11). */
export function requiereRecargaManual(rechazo: Rechazo): boolean {
  return rechazo.tipo === 'noExiste' || rechazo.tipo === 'sinIdentificar' || rechazo.tipo === 'desconocido';
}
