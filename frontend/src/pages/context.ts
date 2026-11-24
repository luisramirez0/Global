import type { AuthApi } from '../api/auth';
import type { Session } from '../state/session';

/** Lo que recibe cada página (design D3). C-11..C-15 lo amplían con sus clientes de API. */
export interface PageContext {
  api: AuthApi;
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
