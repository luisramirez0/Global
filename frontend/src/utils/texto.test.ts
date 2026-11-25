import { describe, expect, it } from 'vitest';
import { utf8Length as utf8LengthAuth } from '../pages/auth/validation';
import { utf8Length } from './texto';

describe('utf8Length', () => {
  it.each([
    ['', 0],
    ['abc', 3],
    ['ñ', 2],
    ['á', 2],
    ['€', 3],
    ['😀', 4],
    ['añ😀', 7],
  ])('%j ocupa %i bytes', (texto, bytes) => {
    expect(utf8Length(texto)).toBe(bytes);
  });

  it('cuenta bytes y no caracteres: 128 ñ son 128 caracteres y 256 bytes', () => {
    const texto = 'ñ'.repeat(128);
    expect(texto.length).toBe(128);
    expect(utf8Length(texto)).toBe(256);
  });

  it('login y registro siguen usando la misma función (reexportada desde validation)', () => {
    expect(utf8LengthAuth).toBe(utf8Length);
  });
});
