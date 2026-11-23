// @vitest-environment node
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const eslint = new ESLint();

// La primera pasada de ESLint carga config y parser TS (~2 s en reposo, > 5 s con la máquina cargada):
// se hace fuera de los tests para que el timeout por test no los vuelva inestables.
beforeAll(async () => {
  await eslint.lintText('export {};', { filePath: 'src/warmup.ts' });
}, 60_000);

async function lint(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.severity === 2);
}

describe('APIs que interpretan HTML prohibidas en src (regla 3)', () => {
  it.each([
    ['innerHTML', 'export function f(el: HTMLElement, s: string): void { el.innerHTML = s; }'],
    ['outerHTML', 'export function f(el: HTMLElement, s: string): void { el.outerHTML = s; }'],
    ['insertAdjacentHTML', "export function f(el: HTMLElement, s: string): void { el.insertAdjacentHTML('beforeend', s); }"],
    ['document.write', 'export function f(s: string): void { document.write(s); }'],
    ['createContextualFragment', 'export function f(r: Range, s: string): DocumentFragment { return r.createContextualFragment(s); }'],
    ['DOMParser', "export function f(s: string): Document { return new DOMParser().parseFromString(s, 'text/html'); }"],
    ['eval', 'export function f(s: string): unknown { return eval(s); }'],
    ['new Function', "export function f(s: string): unknown { return new Function(s); }"],
    ['localStorage', "export function f(): string | null { return localStorage.getItem('x'); }"],
    ['console', "export function f(s: string): void { console.log(s); }"],
  ])('rechaza %s en código de producción', async (_name, code) => {
    expect(await lint(code, 'src/x.ts')).not.toEqual([]);
  });

  it('permite innerHTML en tests para armar fixtures', async () => {
    const code = "document.body.innerHTML = '<div id=\"app\"></div>';";
    expect(await lint(code, 'src/x.test.ts')).toEqual([]);
  });

  it('permite textContent en código de producción', async () => {
    const code = 'export function f(el: HTMLElement, s: string): void { el.textContent = s; }';
    expect(await lint(code, 'src/x.ts')).toEqual([]);
  });
});
