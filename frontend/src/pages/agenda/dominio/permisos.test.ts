import { describe, expect, it } from 'vitest';
import type { Rol } from '../../../api/types';
import { createLoggedContext, createTestContext } from '../../../test-support/pages';
import { rolActual } from '../../config/permisos';
import { puedeOfrecerSobreturno } from './permisos';

describe('puedeOfrecerSobreturno (DP-2: resguardo de UI, no control de seguridad)', () => {
  it.each([
    ['ADMIN', true],
    ['PROFESIONAL', true],
    ['RECEPCION', false],
    [null, false],
  ] as const satisfies readonly (readonly [Rol | null, boolean])[])('rol %s → %s', (rol, esperado) => {
    expect(puedeOfrecerSobreturno(rol)).toBe(esperado);
  });

  it.each([
    ['ADMIN', true],
    ['PROFESIONAL', true],
    ['RECEPCION', false],
  ] as const)('con la sesión de %s (rolActual) → %s', (rol, esperado) => {
    expect(puedeOfrecerSobreturno(rolActual(createLoggedContext(rol)))).toBe(esperado);
  });

  it('sin perfil en la sesión no se ofrece', () => {
    expect(puedeOfrecerSobreturno(rolActual(createTestContext()))).toBe(false);
  });
});
