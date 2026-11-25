import { decodeEnlaceWhatsApp, decodeRecordatorioEmail, decodeTurnoPendiente, listOf } from './decoders';
import type { HttpClient } from './http';
import { conId, conQuery } from './rutas';
import type { EnlaceWhatsApp, RecordatorioEmail, TurnoPendiente } from './types';

/**
 * Endpoints de recordatorios de C-09 (design D1 de C-14). Todos autenticados y con `cache: 'no-store'`:
 * el GET de WhatsApp no es idempotente (cada llamada registra un recordatorio).
 */
export interface RecordatoriosApi {
  enlaceWhatsApp(turnoId: number): Promise<EnlaceWhatsApp>;
  enviarEmail(turnoId: number): Promise<RecordatorioEmail>;
  /** `fecha` `YYYY-MM-DD` en la zona del consultorio. */
  pendientes(fecha: string): Promise<TurnoPendiente[]>;
}

export function createRecordatoriosApi(http: HttpClient): RecordatoriosApi {
  // Async: un id inválido rechaza la promesa igual que un error de la API.
  return {
    async enlaceWhatsApp(turnoId) {
      const path = `${conId('/turnos', turnoId)}/recordatorio/whatsapp`;
      return http.request('GET', path, { decode: decodeEnlaceWhatsApp, cache: 'no-store' });
    },
    async enviarEmail(turnoId) {
      const path = `${conId('/turnos', turnoId)}/recordatorio/email`;
      return http.request('POST', path, { decode: decodeRecordatorioEmail, cache: 'no-store' });
    },
    async pendientes(fecha) {
      const path = conQuery('/turnos/pendientes-recordatorio', { fecha });
      return http.request('GET', path, { decode: listOf(decodeTurnoPendiente), cache: 'no-store' });
    },
  };
}
