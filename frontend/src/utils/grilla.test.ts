import { describe, expect, it } from 'vitest';
import { GRILLA_MINUTOS as GRILLA_CONFIG } from '../pages/config/validacion';
import { GRILLA_MINUTOS } from './grilla';

describe('GRILLA_MINUTOS', () => {
  it('vale 15 minutos (provisional, PA-03)', () => {
    expect(GRILLA_MINUTOS).toBe(15);
  });

  it('la configuración (C-11) reexporta la misma constante: una sola fuente en el frontend', () => {
    expect(GRILLA_CONFIG).toBe(GRILLA_MINUTOS);
  });
});
