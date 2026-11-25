import { decodeBloqueo, decodeHorario, decodePrestacion, decodeSillon, listOf } from './decoders';
import { expectNoContent, type HttpClient } from './http';
import { conId, conQuery } from './rutas';
import type {
  Bloqueo,
  BloqueoRequest,
  FiltroBloqueos,
  Horario,
  HorarioRequest,
  Prestacion,
  PrestacionRequest,
  Sillon,
  SillonRequest,
} from './types';

/** Endpoints de configuración de agenda de C-04 (design D1 de C-11). Todos autenticados. */
export interface AgendaConfigApi {
  listarSillones(incluirInactivos: boolean): Promise<Sillon[]>;
  crearSillon(request: SillonRequest): Promise<Sillon>;
  editarSillon(id: number, request: SillonRequest): Promise<Sillon>;
  borrarSillon(id: number): Promise<void>;

  listarPrestaciones(incluirInactivas: boolean): Promise<Prestacion[]>;
  crearPrestacion(request: PrestacionRequest): Promise<Prestacion>;
  editarPrestacion(id: number, request: PrestacionRequest): Promise<Prestacion>;
  borrarPrestacion(id: number): Promise<void>;

  listarHorarios(): Promise<Horario[]>;
  crearHorario(request: HorarioRequest): Promise<Horario>;
  editarHorario(id: number, request: HorarioRequest): Promise<Horario>;
  borrarHorario(id: number): Promise<void>;

  listarBloqueos(filtro: FiltroBloqueos): Promise<Bloqueo[]>;
  crearBloqueo(request: BloqueoRequest): Promise<Bloqueo>;
  editarBloqueo(id: number, request: BloqueoRequest): Promise<Bloqueo>;
  borrarBloqueo(id: number): Promise<void>;
}

export function createAgendaConfigApi(http: HttpClient): AgendaConfigApi {
  // Async: un id inválido rechaza la promesa igual que un error de la API.
  return {
    async listarSillones(incluirInactivos) {
      const path = conQuery('/sillones', { incluirInactivos: incluirInactivos ? 'true' : undefined });
      return http.request('GET', path, { decode: listOf(decodeSillon) });
    },
    async crearSillon(request) {
      return http.request('POST', '/sillones', { body: request, decode: decodeSillon });
    },
    async editarSillon(id, request) {
      return http.request('PUT', conId('/sillones', id), { body: request, decode: decodeSillon });
    },
    async borrarSillon(id) {
      return http.request('DELETE', conId('/sillones', id), { decode: expectNoContent });
    },

    async listarPrestaciones(incluirInactivas) {
      const path = conQuery('/prestaciones', { incluirInactivas: incluirInactivas ? 'true' : undefined });
      return http.request('GET', path, { decode: listOf(decodePrestacion) });
    },
    async crearPrestacion(request) {
      return http.request('POST', '/prestaciones', { body: request, decode: decodePrestacion });
    },
    async editarPrestacion(id, request) {
      return http.request('PUT', conId('/prestaciones', id), { body: request, decode: decodePrestacion });
    },
    async borrarPrestacion(id) {
      return http.request('DELETE', conId('/prestaciones', id), { decode: expectNoContent });
    },

    async listarHorarios() {
      return http.request('GET', '/horarios-atencion', { decode: listOf(decodeHorario) });
    },
    async crearHorario(request) {
      return http.request('POST', '/horarios-atencion', { body: request, decode: decodeHorario });
    },
    async editarHorario(id, request) {
      return http.request('PUT', conId('/horarios-atencion', id), { body: request, decode: decodeHorario });
    },
    async borrarHorario(id) {
      return http.request('DELETE', conId('/horarios-atencion', id), { decode: expectNoContent });
    },

    async listarBloqueos(filtro) {
      return http.request('GET', conQuery('/bloqueos', { desde: filtro.desde, hasta: filtro.hasta }), {
        decode: listOf(decodeBloqueo),
      });
    },
    async crearBloqueo(request) {
      return http.request('POST', '/bloqueos', { body: request, decode: decodeBloqueo });
    },
    async editarBloqueo(id, request) {
      return http.request('PUT', conId('/bloqueos', id), { body: request, decode: decodeBloqueo });
    },
    async borrarBloqueo(id) {
      return http.request('DELETE', conId('/bloqueos', id), { decode: expectNoContent });
    },
  };
}
