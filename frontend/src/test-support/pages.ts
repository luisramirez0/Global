/** Utilidades de test para páginas (solo se importan desde *.test.ts). */
import { vi } from 'vitest';
import type { AuthApi } from '../api/auth';
import { createFlash, type PageContext } from '../pages/context';
import { createSession } from '../state/session';

export interface TestContext extends PageContext {
  api: {
    register: ReturnType<typeof vi.fn<AuthApi['register']>>;
    login: ReturnType<typeof vi.fn<AuthApi['login']>>;
    me: ReturnType<typeof vi.fn<AuthApi['me']>>;
  };
  navigate: ReturnType<typeof vi.fn<(path: string) => void>>;
}

export function createTestContext(): TestContext {
  return {
    api: { register: vi.fn<AuthApi['register']>(), login: vi.fn<AuthApi['login']>(), me: vi.fn<AuthApi['me']>() },
    session: createSession({ storage: sessionStorage, now: () => Date.now() }),
    navigate: vi.fn<(path: string) => void>(),
    flash: createFlash(),
  };
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
