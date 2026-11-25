import { decodePaciente, paginaOf } from './decoders';
import type { HttpClient } from './http';
import { conId, conQuery } from './rutas';
import type { FiltroPacientes, Pagina, Paciente } from './types';

/**
 * Cliente de `/pacientes` (design D1 de C-13). Compartido y sin lógica de pantalla: C-12 lo extiende con
 * `crear`, `editar` y `baja` en este mismo módulo y esta misma interfaz (no crea otro cliente).
 */
export interface PacientesApi {
  buscar(filtro: FiltroPacientes): Promise<Pagina<Paciente>>;
  obtener(id: number): Promise<Paciente>;
}

export function createPacientesApi(http: HttpClient): PacientesApi {
  return {
    async buscar(filtro) {
      const path = conQuery('/pacientes', {
        q: filtro.q,
        incluirInactivos: filtro.incluirInactivos === true ? 'true' : undefined,
        page: filtro.page === undefined ? undefined : String(filtro.page),
        size: filtro.size === undefined ? undefined : String(filtro.size),
      });
      return http.request('GET', path, { decode: paginaOf(decodePaciente) });
    },
    async obtener(id) {
      return http.request('GET', conId('/pacientes', id), { decode: decodePaciente });
    },
  };
}
