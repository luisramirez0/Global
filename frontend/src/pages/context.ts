import type { AgendaConfigApi } from '../api/agendaConfig';
import type { AuthApi } from '../api/auth';
import type { PacientesApi } from '../api/pacientes';
import type { TurnosApi } from '../api/turnos';
import type { Session } from '../state/session';

/** Lo que recibe cada página (design D3). C-11..C-15 lo amplían con sus clientes de API. */
export interface PageContext {
  api: AuthApi;
  /** Configuración de agenda (C-11). */
  agenda: AgendaConfigApi;
  /** Turnos (C-13, C-07). */
  turnos: TurnosApi;
  /** Pacientes (C-05); C-12 lo amplía con alta, edición y baja. */
  pacientes: PacientesApi;
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
