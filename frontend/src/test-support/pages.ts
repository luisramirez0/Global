/** Utilidades de test para páginas (solo se importan desde *.test.ts). */
import { vi, type Mock } from 'vitest';
import type { AgendaConfigApi } from '../api/agendaConfig';
import type { AuditoriaApi } from '../api/auditoria';
import type { AuthApi } from '../api/auth';
import type { MeResponse, Rol } from '../api/types';
import { createFlash, type PageContext } from '../pages/context';
import { createSession } from '../state/session';

/** Cada método de la API de agenda como `vi.fn` tipado (C-11). */
export type AgendaMock = { [K in keyof AgendaConfigApi]: Mock<AgendaConfigApi[K]> };

/** Cliente de auditoría y export como `vi.fn` tipado (C-15). */
export type AuditoriaMock = { [K in keyof AuditoriaApi]: Mock<AuditoriaApi[K]> };

export interface TestContext extends PageContext {
  api: {
    register: ReturnType<typeof vi.fn<AuthApi['register']>>;
    login: ReturnType<typeof vi.fn<AuthApi['login']>>;
    me: ReturnType<typeof vi.fn<AuthApi['me']>>;
  };
  agenda: AgendaMock;
  auditoria: AuditoriaMock;
  navigate: ReturnType<typeof vi.fn<(path: string) => void>>;
}

function createAgendaMock(): AgendaMock {
  return {
    listarSillones: vi.fn<AgendaConfigApi['listarSillones']>(),
    crearSillon: vi.fn<AgendaConfigApi['crearSillon']>(),
    editarSillon: vi.fn<AgendaConfigApi['editarSillon']>(),
    borrarSillon: vi.fn<AgendaConfigApi['borrarSillon']>(),
    listarPrestaciones: vi.fn<AgendaConfigApi['listarPrestaciones']>(),
    crearPrestacion: vi.fn<AgendaConfigApi['crearPrestacion']>(),
    editarPrestacion: vi.fn<AgendaConfigApi['editarPrestacion']>(),
    borrarPrestacion: vi.fn<AgendaConfigApi['borrarPrestacion']>(),
    listarHorarios: vi.fn<AgendaConfigApi['listarHorarios']>(),
    crearHorario: vi.fn<AgendaConfigApi['crearHorario']>(),
    editarHorario: vi.fn<AgendaConfigApi['editarHorario']>(),
    borrarHorario: vi.fn<AgendaConfigApi['borrarHorario']>(),
    listarBloqueos: vi.fn<AgendaConfigApi['listarBloqueos']>(),
    crearBloqueo: vi.fn<AgendaConfigApi['crearBloqueo']>(),
    editarBloqueo: vi.fn<AgendaConfigApi['editarBloqueo']>(),
    borrarBloqueo: vi.fn<AgendaConfigApi['borrarBloqueo']>(),
  };
}

export function createTestContext(): TestContext {
  return {
    api: { register: vi.fn<AuthApi['register']>(), login: vi.fn<AuthApi['login']>(), me: vi.fn<AuthApi['me']>() },
    agenda: createAgendaMock(),
    auditoria: { listar: vi.fn<AuditoriaApi['listar']>(), exportarPaciente: vi.fn<AuditoriaApi['exportarPaciente']>() },
    session: createSession({ storage: sessionStorage, now: () => Date.now() }),
    navigate: vi.fn<(path: string) => void>(),
    flash: createFlash(),
  };
}

/** Contexto con sesión iniciada y perfil del rol indicado (datos ficticios). */
export function createLoggedContext(rol: Rol): TestContext {
  const ctx = createTestContext();
  ctx.session.start('token-de-prueba', 1800);
  const profile: MeResponse = {
    usuario: { id: 2, nombre: 'Ana', email: 'ana@consultorio.test', rol },
    consultorio: { id: 2, nombre: 'Consultorio Sonrisas' },
  };
  ctx.session.setProfile(profile);
  return ctx;
}

export function select(root: ParentNode, name: string): HTMLSelectElement {
  const el = root.querySelector(`select[name="${name}"]`);
  if (!(el instanceof HTMLSelectElement)) throw new Error(`No existe el select ${name}`);
  return el;
}

/** Botones cuyo texto visible es exactamente `text`. */
export function buttons(root: ParentNode, text: string): HTMLButtonElement[] {
  return [...root.querySelectorAll('button')].filter((b) => b.textContent === text);
}

/** El único botón con ese `aria-label` (p. ej. "Editar Sillón 1"). */
export function buttonLabeled(root: ParentNode, label: string): HTMLButtonElement {
  const found = [...root.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') === label);
  if (found.length !== 1 || found[0] === undefined) throw new Error(`Se esperaba un botón "${label}" y hay ${found.length}`);
  return found[0];
}

/** Deja correr promesas resueltas y sus `then` encadenados. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export function input(root: ParentNode, name: string): HTMLInputElement {
  const el = root.querySelector(`input[name="${name}"]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`No existe el input ${name}`);
  return el;
}

export function fill(root: ParentNode, values: Readonly<Record<string, string>>): void {
  for (const [name, value] of Object.entries(values)) {
    input(root, name).value = value;
  }
}

export function submit(root: ParentNode): void {
  const form = root.querySelector('form');
  if (form === null) throw new Error('No hay formulario');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

export function alertText(root: ParentNode): string {
  return root.querySelector('[role="alert"]')?.textContent ?? '';
}

export function errorOf(root: ParentNode, name: string): string {
  const describedBy = input(root, name).getAttribute('aria-describedby');
  if (describedBy === null) return '';
  return root.querySelector(`#${describedBy}`)?.textContent ?? '';
}

/** Promesa controlable para simular una request pendiente. */
export function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
