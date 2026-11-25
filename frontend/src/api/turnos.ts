import { decodeTurno, listOf } from './decoders';
import type { HttpClient } from './http';
import { conId, conQuery } from './rutas';
import type { FiltroTurnos, Turno, TurnoCreateRequest, TurnoEstadoRequest, TurnoReprogramarRequest } from './types';

/** Endpoints de turnos de C-07 (design D1 de C-13). Todos autenticados. */
export interface TurnosApi {
  listar(filtro: FiltroTurnos): Promise<Turno[]>;
  obtener(id: number): Promise<Turno>;
  crear(request: TurnoCreateRequest): Promise<Turno>;
  cambiarEstado(id: number, request: TurnoEstadoRequest): Promise<Turno>;
  reprogramar(id: number, request: TurnoReprogramarRequest): Promise<Turno>;
}

/** Los ids de query también son enteros positivos: un valor inválido es un error de programación. */
function idQuery(valor: number | undefined): string | undefined {
  if (valor === undefined) return undefined;
  return conId('', valor).slice(1);
}

export function createTurnosApi(http: HttpClient): TurnosApi {
  // Async: un id inválido rechaza la promesa igual que un error de la API.
  return {
    async listar(filtro) {
      const path = conQuery('/turnos', {
        desde: filtro.desde,
        hasta: filtro.hasta,
        sillonId: idQuery(filtro.sillonId),
        profesionalId: idQuery(filtro.profesionalId),
        incluirCancelados: filtro.incluirCancelados === true ? 'true' : undefined,
      });
      return http.request('GET', path, { decode: listOf(decodeTurno) });
    },
    async obtener(id) {
      return http.request('GET', conId('/turnos', id), { decode: decodeTurno });
    },
    async crear(request) {
      return http.request('POST', '/turnos', { body: request, decode: decodeTurno });
    },
    async cambiarEstado(id, request) {
      // El motivo solo se acepta con CANCELADO (C-07 D7): con otro estado no viaja.
      const body: TurnoEstadoRequest =
        request.estado === 'CANCELADO' && request.motivoCancelacion !== undefined
          ? { estado: request.estado, motivoCancelacion: request.motivoCancelacion }
          : { estado: request.estado };
      return http.request('PATCH', `${conId('/turnos', id)}/estado`, { body, decode: decodeTurno });
    },
    async reprogramar(id, request) {
      return http.request('PUT', conId('/turnos', id), { body: request, decode: decodeTurno });
    },
  };
}
