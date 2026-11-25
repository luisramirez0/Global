import { decodePaciente, paginaOf } from './decoders';
import { expectNoContent, type HttpClient } from './http';
import { conId, conQuery } from './rutas';
import type { FiltroPacientes, Paciente, PacienteRequest, Pagina } from './types';

/** Endpoints de pacientes de C-05 (C-12, tasks 4.1). Todos autenticados; los permisos los decide el backend. */
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

function paginacion(page: number, size: number): { page: string; size: string } {
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > TAMANIO_PAGINA_MAX) {
    throw new Error('Error de programación: paginación inválida');
  }
  return { page: String(page), size: String(size) };
}

const decodePagina = paginaOf(decodePaciente);

export function createPacientesApi(http: HttpClient): PacientesApi {
  // Async: un id o una paginación inválidos rechazan la promesa igual que un error de la API.
  return {
    async buscar(filtro) {
      const q = filtro.q.trim();
      const path = conQuery('/pacientes', {
        q: q === '' ? undefined : q,
        incluirInactivos: filtro.incluirInactivos ? 'true' : undefined,
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
