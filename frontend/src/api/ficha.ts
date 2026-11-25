import { decodeConsentimiento, decodeFicha, decodeNota, decodeTextoConsentimiento, listOf, paginaOf } from './decoders';
import type { HttpClient } from './http';
import { conId, conQuery } from './rutas';
import type { Consentimiento, Ficha, FichaRequest, Nota, Pagina, TextoConsentimiento } from './types';

/**
 * Historia clínica de C-08 (C-12b, tasks 5.1). Todas autenticadas y solo `ADMIN`/`PROFESIONAL` en el backend; cada
 * lectura de ficha y notas queda auditada (RN-DS-02), así que la UI no repite pedidos innecesarios (design D8).
 */
export interface FichaApi {
  listarConsentimientos(pacienteId: number): Promise<Consentimiento[]>;
  textoVigente(): Promise<TextoConsentimiento>;
  /** Solo la versión del texto: fecha y usuario los pone el servidor. */
  registrarConsentimiento(pacienteId: number, versionTexto: string): Promise<Consentimiento>;
  obtenerFicha(pacienteId: number): Promise<Ficha>;
  guardarFicha(pacienteId: number, request: FichaRequest): Promise<Ficha>;
  listarNotas(pacienteId: number, page: number, size: number): Promise<Pagina<Nota>>;
  /** Sin `turnoId` en C-12 (lo agrega C-13). */
  crearNota(pacienteId: number, texto: string): Promise<Nota>;
}

export const NOTAS_TAMANIO_MAX = 100;

function dePaciente(pacienteId: number, recurso: string): string {
  return `${conId('/pacientes', pacienteId)}/${recurso}`;
}

const decodePaginaNotas = paginaOf(decodeNota);

export function createFichaApi(http: HttpClient): FichaApi {
  // Async: un id o una paginación inválidos rechazan la promesa igual que un error de la API.
  return {
    async listarConsentimientos(pacienteId) {
      return http.request('GET', dePaciente(pacienteId, 'consentimientos'), { decode: listOf(decodeConsentimiento) });
    },
    async textoVigente() {
      return http.request('GET', '/consentimientos/texto-vigente', { decode: decodeTextoConsentimiento });
    },
    async registrarConsentimiento(pacienteId, versionTexto) {
      return http.request('POST', dePaciente(pacienteId, 'consentimientos'), {
        body: { versionTexto },
        decode: decodeConsentimiento,
      });
    },
    async obtenerFicha(pacienteId) {
      return http.request('GET', dePaciente(pacienteId, 'ficha'), { decode: decodeFicha });
    },
    async guardarFicha(pacienteId, request) {
      return http.request('PUT', dePaciente(pacienteId, 'ficha'), { body: request, decode: decodeFicha });
    },
    async listarNotas(pacienteId, page, size) {
      const base = dePaciente(pacienteId, 'notas');
      if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > NOTAS_TAMANIO_MAX) {
        throw new Error('Error de programación: paginación inválida');
      }
      return http.request('GET', conQuery(base, { page: String(page), size: String(size) }), { decode: decodePaginaNotas });
    },
    async crearNota(pacienteId, texto) {
      return http.request('POST', dePaciente(pacienteId, 'notas'), { body: { texto }, decode: decodeNota });
    },
  };
}
