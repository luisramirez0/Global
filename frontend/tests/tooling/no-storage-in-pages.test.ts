// @vitest-environment node
/**
 * Datos de salud y personales fuera del almacenamiento del navegador (C-12, design D8). El lint global ya prohíbe
 * `localStorage` y `console` en `src/`; `sessionStorage` lo permite porque la sesión de C-10 lo usa. Este chequeo lo
 * prohíbe en las páginas de pacientes y de ficha, sobre los archivos reales.
 */
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const MENSAJE = 'C-12 D8: las páginas de pacientes y ficha no usan almacenamiento del navegador.';

const eslint = new ESLint({
  overrideConfig: {
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'sessionStorage', message: MENSAJE },
        { name: 'localStorage', message: MENSAJE },
        { name: 'indexedDB', message: MENSAJE },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'sessionStorage', message: MENSAJE },
        { object: 'window', property: 'localStorage', message: MENSAJE },
        { object: 'globalThis', property: 'sessionStorage', message: MENSAJE },
        { object: 'globalThis', property: 'localStorage', message: MENSAJE },
        { object: 'document', property: 'cookie', message: MENSAJE },
      ],
      'no-console': 'error',
    },
  },
});

beforeAll(async () => {
  await eslint.lintText('export {};', { filePath: 'src/warmup.ts' });
}, 60_000);

async function erroresEn(patron: string): Promise<{ archivo: string; regla: string | null }[]> {
  const resultados = await eslint.lintFiles([patron]);
  return resultados
    .filter((r) => !r.filePath.endsWith('.test.ts'))
    .flatMap((r) =>
      r.messages
        .filter((m) => m.severity === 2 && (m.ruleId === 'no-restricted-globals' || m.ruleId === 'no-restricted-properties' || m.ruleId === 'no-console'))
        .map((m) => ({ archivo: r.filePath, regla: m.ruleId })),
    );
}

describe('almacenamiento del navegador en las páginas de C-12 (D8)', () => {
  it('el chequeo detecta sessionStorage, window.localStorage, document.cookie y console (si no, no probaría nada)', async () => {
    const casos = [
      "export function f(): string | null { return sessionStorage.getItem('x'); }",
      "export function f(): string | null { return window.localStorage.getItem('x'); }",
      'export function f(): string { return document.cookie; }',
      "export function f(s: string): void { console.info(s); }",
    ];
    for (const code of casos) {
      const [r] = await eslint.lintText(code, { filePath: 'src/pages/ficha/x.ts' });
      expect((r?.messages ?? []).filter((m) => m.severity === 2), code).not.toEqual([]);
    }
  });

  it.each(['src/pages/pacientes/**/*.ts', 'src/pages/ficha/**/*.ts'])('%s no usa almacenamiento ni console', async (patron) => {
    expect(await erroresEn(patron)).toEqual([]);
  }, 60_000);
});
