// @vitest-environment node
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const eslint = new ESLint();

// La primera pasada de ESLint carga config y parser TS (~2 s en reposo, > 5 s con la máquina cargada):
// se hace fuera de los tests para que el timeout por test no los vuelva inestables.
beforeAll(async () => {
  await eslint.lintText('export {};', { filePath: 'src/warmup.ts' });
}, 60_000);

async function lint(code: string) {
  const [result] = await eslint.lintText(code, { filePath: 'src/x.ts' });
  return result?.messages ?? [];
}

describe('regla no-explicit-any', () => {
  it('reporta error al usar any', async () => {
    const messages = await lint('const x: any = 1; export { x };');
    const hit = messages.find((m) => m.ruleId === '@typescript-eslint/no-explicit-any');
    expect(hit?.severity).toBe(2);
  });

  it('acepta unknown', async () => {
    const messages = await lint('const x: unknown = 1; export { x };');
    expect(messages).toEqual([]);
  });
});
