import type { MeResponse } from '../api/types';

/**
 * Sesión del cliente (design D2): en `sessionStorage` solo `{token, expiresAt}`; el perfil vive en memoria.
 * Sin refresh (DD-04): al vencer, la sesión se cierra y la app vuelve al login.
 */

export const SESSION_KEY = 'global.session.v1';
/** La sesión se da por vencida 30 s antes para no enviar un token que vence en vuelo. */
export const EXPIRY_MARGIN_MS = 30_000;

export type Profile = MeResponse;
export type EndReason = 'logout' | 'expired' | 'unauthorized';
export type SessionEvent = { type: 'started' } | { type: 'profile' } | { type: 'ended'; reason: EndReason };
export type SessionListener = (event: SessionEvent) => void;

export interface Session {
  start(token: string, expiresInSeconds: number): void;
  restore(): boolean;
  getToken(): string | null;
  isAuthenticated(): boolean;
  setProfile(profile: Profile): void;
  profile(): Profile | null;
  end(reason: EndReason): void;
  subscribe(listener: SessionListener): () => void;
}

export interface SessionDeps {
  storage: Storage;
  now: () => number;
}

interface Stored {
  token: string;
  expiresAt: number;
}

function parseStored(raw: string | null): Stored | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const token: unknown = Reflect.get(value, 'token');
  const expiresAt: unknown = Reflect.get(value, 'expiresAt');
  if (typeof token !== 'string' || token === '' || typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return null;
  }
  return { token, expiresAt };
}

export function createSession(deps: SessionDeps): Session {
  const { storage, now } = deps;
  const listeners = new Set<SessionListener>();
  let current: Stored | null = null;
  let currentProfile: Profile | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function emit(event: SessionEvent): void {
    for (const listener of [...listeners]) listener(event);
  }

  function isExpired(s: Stored): boolean {
    return now() >= s.expiresAt - EXPIRY_MARGIN_MS;
  }

  function cancelTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function activate(s: Stored): void {
    cancelTimer();
    current = s;
    currentProfile = null;
    timer = setTimeout(() => session.end('expired'), Math.max(0, s.expiresAt - EXPIRY_MARGIN_MS - now()));
  }

  const session: Session = {
    start(token, expiresInSeconds) {
      const s = { token, expiresAt: now() + expiresInSeconds * 1000 };
      storage.setItem(SESSION_KEY, JSON.stringify(s));
      activate(s);
      emit({ type: 'started' });
    },

    restore() {
      const s = parseStored(storage.getItem(SESSION_KEY));
      if (s === null || isExpired(s)) {
        storage.removeItem(SESSION_KEY);
        return false;
      }
      activate(s);
      return true;
    },

    getToken() {
      if (current === null) return null;
      if (isExpired(current)) {
        session.end('expired');
        return null;
      }
      return current.token;
    },

    isAuthenticated() {
      return session.getToken() !== null;
    },

    setProfile(profile) {
      if (current === null) return;
      currentProfile = profile;
      emit({ type: 'profile' });
    },

    profile() {
      return currentProfile;
    },

    end(reason) {
      storage.removeItem(SESSION_KEY);
      cancelTimer();
      if (current === null) return;
      current = null;
      currentProfile = null;
      emit({ type: 'ended', reason });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return session;
}
