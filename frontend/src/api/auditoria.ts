import { decodeEntradaAuditoria, decodeExportPaciente, paginaOf } from './decoders';
import type { HttpClient } from './http';
import type { EntradaAuditoria, ExportPaciente, FiltrosAuditoria, Pagina } from './types';

/**
 * Auditoría (C-06, `GET /api/auditoria`) y export de datos de un paciente (C-15, `GET /api/pacientes/{id}/export`).
 * Ambos autenticados y solo para ADMIN/PROFESIONAL; el backend decide (un 403 llega como `forbidden`).
 */
export interface AuditoriaApi {
  listar(filtros: FiltrosAuditoria): Promise<Pagina<EntradaAuditoria>>;
  exportarPaciente(pacienteId: number): Promise<ExportPaciente>;
}

function esIdValido(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0;
}

/** Query en orden estable; omite lo vacío. `entidadId` sin `entidad` es un error de programación (design D8). */
function queryAuditoria(filtros: FiltrosAuditoria): string {
  if (filtros.entidadId !== undefined && (filtros.entidad === undefined || filtros.entidad === '')) {
    throw new Error('Error de programación: entidadId requiere entidad');
  }
  const query = new URLSearchParams();
  const pares: ReadonlyArray<readonly [string, string | number | undefined]> = [
    ['desde', filtros.desde],
    ['hasta', filtros.hasta],
    ['accion', filtros.accion],
    ['entidad', filtros.entidad],
    ['entidadId', filtros.entidadId],
    ['usuarioId', filtros.usuarioId],
    ['page', filtros.page],
  ];
  for (const [clave, valor] of pares) {
    if (valor !== undefined && valor !== '') query.set(clave, String(valor));
  }
  return `/auditoria?${query.toString()}`;
}

export function createAuditoriaApi(http: HttpClient): AuditoriaApi {
  // Async: un argumento inválido rechaza la promesa igual que un error de la API.
  return {
    async listar(filtros) {
      return http.request('GET', queryAuditoria(filtros), { decode: paginaOf(decodeEntradaAuditoria) });
    },
    async exportarPaciente(pacienteId) {
      if (!esIdValido(pacienteId)) {
        throw new Error('Error de programación: id de paciente inválido');
      }
      return http.request('GET', `/pacientes/${pacienteId}/export`, { decode: decodeExportPaciente });
    },
  };
}
