import type { AgendaConfigApi } from '../api/agendaConfig';
import type { AuditoriaApi } from '../api/auditoria';
import type { AuthApi } from '../api/auth';
import type { PacientesApi } from '../api/pacientes';
import type { RecordatoriosApi } from '../api/recordatorios';
import type { TurnosApi } from '../api/turnos';
import type { Session } from '../state/session';
import type { RegistroEnviosSinConfirmar } from './recordatorios/dominio/enviosSinConfirmar';

/** Lo que recibe cada página (design D3). C-11..C-15 lo amplían con sus clientes de API. */
export interface PageContext {
  api: AuthApi;
  /** Configuración de agenda (C-11). */
  agenda: AgendaConfigApi;
  /** Turnos (C-13, C-07). */
  turnos: TurnosApi;
  /** Pacientes (C-05); C-12 lo amplía con alta, edición y baja. */
  pacientes: PacientesApi;
  /** Log de auditoría y export de pacientes (C-15). */
  auditoria: AuditoriaApi;
  /** Recordatorios de turnos (C-14, C-09). */
  recordatorios: RecordatoriosApi;
  /** Turnos con envío de email sin confirmar; solo en memoria, compartido por página y agenda (C-14, D11). */
  enviosSinConfirmar: RegistroEnviosSinConfirmar;
  session: Session;
  navigate(path: string): void;
  flash: Flash;
}

/** Aviso de un solo uso para la próxima página (p. ej. "Tu sesión venció"). Solo en memoria. */
export interface Flash {
  set(message: string): void;
  consume(): string | null;
}

export function createFlash(): Flash {
  let pending: string | null = null;
  return {
    set(message) {
      pending = message;
    },
    consume() {
      const message = pending;
      pending = null;
      return message;
    },
  };
}
