import { decodePaciente, paginaOf } from './decoders';
import { expectNoContent, type HttpClient } from './http';
import { conId, conQuery } from './rutas';
import type { FiltroPacientes, Paciente, PacienteRequest, Pagina } from './types';

/**
 * Cliente de `/pacientes` (C-05). Lo creó C-13 con `buscar` y `obtener` para la agenda; C-12 lo extiende en este mismo
 * módulo e interfaz con el ABM (`crear`, `editar`, `darDeBaja`, `reactivar`). Todos autenticados; los permisos los
 * decide el backend.
 */
export interface PacientesApi {
  buscar(filtro: FiltroPacientes): Promise<Pagina<Paciente>>;
  obtener(id: number): Promise<Paciente>;
  crear(request: PacienteRequest): Promise<Paciente>;
  editar(id: number, request: PacienteRequest): Promise<Paciente>;
  /** Baja lógica (`GESTION`); idempotente. */
  darDeBaja(id: number): Promise<void>;
  /** `GESTION`; idempotente. */
  reactivar(id: number): Promise<void>;
}

export const TAMANIO_PAGINA_MAX = 50;

/** Página y tamaño opcionales; si vienen, deben ser válidos (un valor inválido es error de programación). */
function paginacion(page: number | undefined, size: number | undefined): { page: string | undefined; size: string | undefined } {
  if (page !== undefined && (!Number.isSafeInteger(page) || page < 0)) {
    throw new Error('Error de programación: paginación inválida');
  }
  if (size !== undefined && (!Number.isSafeInteger(size) || size < 1 || size > TAMANIO_PAGINA_MAX)) {
    throw new Error('Error de programación: paginación inválida');
  }
  return { page: page === undefined ? undefined : String(page), size: size === undefined ? undefined : String(size) };
}

const decodePagina = paginaOf(decodePaciente);

export function createPacientesApi(http: HttpClient): PacientesApi {
  // Async: un id o una paginación inválidos rechazan la promesa igual que un error de la API.
  return {
    async buscar(filtro) {
      // Un término vacío o de solo espacios no se envía (C-12, D10).
      const q = filtro.q?.trim();
      const path = conQuery('/pacientes', {
        q: q === undefined || q === '' ? undefined : q,
        incluirInactivos: filtro.incluirInactivos === true ? 'true' : undefined,
        ...paginacion(filtro.page, filtro.size),
      });
      return http.request('GET', path, { decode: decodePagina });
    },
    async obtener(id) {
      return http.request('GET', conId('/pacientes', id), { decode: decodePaciente });
    },
    async crear(request) {
      return http.request('POST', '/pacientes', { body: request, decode: decodePaciente });
    },
    async editar(id, request) {
      return http.request('PUT', conId('/pacientes', id), { body: request, decode: decodePaciente });
    },
    async darDeBaja(id) {
      return http.request('DELETE', conId('/pacientes', id), { decode: expectNoContent });
    },
    async reactivar(id) {
      return http.request('POST', `${conId('/pacientes', id)}/reactivar`, { decode: expectNoContent });
    },
  };
}
