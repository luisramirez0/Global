import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ME_OK } from '../api/__fixtures__/auth';
import { SESSION_KEY, createSession, type SessionEvent } from './session';

const T0 = Date.UTC(2026, 10, 23, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
  localStorage.clear();
});

function setup() {
  const session = createSession({ storage: sessionStorage, now: () => Date.now() });
  const events: SessionEvent[] = [];
  session.subscribe((e) => events.push(e));
  return { session, events };
}

function stored(): unknown {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw === null ? null : (JSON.parse(raw) as unknown);
}

describe('start', () => {
  it('persiste solo token y vencimiento en sessionStorage, nada en localStorage', () => {
    const { session, events } = setup();
    session.start('t1', 1800);
    expect(stored()).toEqual({ token: 't1', expiresAt: T0 + 1800 * 1000 });
    expect(sessionStorage).toHaveLength(1);
    expect(localStorage).toHaveLength(0);
    expect(session.getToken()).toBe('t1');
    expect(session.isAuthenticated()).toBe(true);
    expect(events).toEqual([{ type: 'started' }]);
  });

  it('el perfil queda solo en memoria', () => {
    const { session } = setup();
    session.start('t1', 1800);
    session.setProfile(ME_OK);
    expect(session.profile()).toEqual(ME_OK);
    const raw = sessionStorage.getItem(SESSION_KEY) ?? '';
    expect(raw).not.toContain('Ana');
    expect(raw).not.toContain('ana@consultorio.test');
    expect(raw).not.toContain('Sonrisas');
  });
});

describe('restore', () => {
  it('restaura una sesión vigente sin perfil', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: 't1', expiresAt: T0 + 600_000 }));
    const { session } = setup();
    expect(session.restore()).toBe(true);
    expect(session.getToken()).toBe('t1');
    expect(session.profile()).toBeNull();
  });

  it.each([
    ['JSON inválido', '{no es json'],
    ['forma incorrecta', JSON.stringify({ token: 1, expiresAt: 'x' })],
    ['token vacío', JSON.stringify({ token: '', expiresAt: T0 + 600_000 })],
    ['vencido', JSON.stringify({ token: 't1', expiresAt: T0 - 1 })],
    ['dentro del margen de 30 s', JSON.stringify({ token: 't1', expiresAt: T0 + 29_000 })],
    ['array', JSON.stringify(['t1'])],
  ])('%s: queda sin sesión y borra la clave', (_n, raw) => {
    sessionStorage.setItem(SESSION_KEY, raw);
    const { session } = setup();
    expect(session.restore()).toBe(false);
    expect(session.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('sin datos queda sin sesión', () => {
    const { session } = setup();
    expect(session.restore()).toBe(false);
  });

  it('programa el cierre de una sesión restaurada', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: 't1', expiresAt: T0 + 600_000 }));
    const { session, events } = setup();
    session.restore();
    vi.advanceTimersByTime(570_000);
    expect(session.isAuthenticated()).toBe(false);
    expect(events).toContainEqual({ type: 'ended', reason: 'expired' });
  });
});

describe('vencimiento', () => {
  it('se cierra con expired a los 1770 s de un token de 1800 s', () => {
    const { session, events } = setup();
    session.start('t1', 1800);
    session.setProfile(ME_OK);
    vi.advanceTimersByTime(1769_000);
    expect(session.isAuthenticated()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(events.at(-1)).toEqual({ type: 'ended', reason: 'expired' });
    expect(session.getToken()).toBeNull();
    expect(session.profile()).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('getToken revalida contra el reloj aunque el temporizador no haya corrido', () => {
    const { session, events } = setup();
    session.start('t1', 1800);
    vi.setSystemTime(T0 + 1771_000); // pestaña suspendida: el reloj avanzó sin disparar timers
    expect(session.getToken()).toBeNull();
    expect(events.at(-1)).toEqual({ type: 'ended', reason: 'expired' });
  });
});

describe('end', () => {
  it.each(['logout', 'unauthorized'] as const)('%s borra clave, perfil y temporizador y notifica', (reason) => {
    const { session, events } = setup();
    session.start('t1', 1800);
    session.setProfile(ME_OK);
    session.end(reason);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(session.profile()).toBeNull();
    expect(session.isAuthenticated()).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'ended', reason });
    const count = events.length;
    vi.advanceTimersByTime(1800_000);
    expect(events).toHaveLength(count); // el temporizador fue cancelado
  });

  it('sin sesión activa no notifica', () => {
    const { session, events } = setup();
    session.end('logout');
    expect(events).toEqual([]);
  });

  it('subscribe devuelve una función para desuscribirse', () => {
    const session = createSession({ storage: sessionStorage, now: () => Date.now() });
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    unsubscribe();
    session.start('t1', 1800);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('perfil', () => {
  it('setProfile notifica profile', () => {
    const { session, events } = setup();
    session.start('t1', 1800);
    session.setProfile(ME_OK);
    expect(events.at(-1)).toEqual({ type: 'profile' });
  });

  it('setProfile sin sesión se ignora', () => {
    const { session } = setup();
    session.setProfile(ME_OK);
    expect(session.profile()).toBeNull();
  });
});
