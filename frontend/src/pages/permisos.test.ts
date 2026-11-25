import { describe, expect, it } from 'vitest';
import { createLoggedContext, createTestContext } from '../test-support/pages';
import { rolActual as rolActualConfig } from './config/permisos';
import { puedeDarDeBaja, rolActual } from './permisos';

/** Permisos de pacientes en la UI (C-12, D2). Solo deciden qué se muestra: el backend sigue autorizando. */
describe('puedeDarDeBaja', () => {
  it.each(['ADMIN', 'PROFESIONAL'] as const)('%s puede dar de baja y reactivar', (rol) => {
    expect(puedeDarDeBaja(rol)).toBe(true);
  });

  it('RECEPCION no', () => {
    expect(puedeDarDeBaja('RECEPCION')).toBe(false);
  });

  it('sin perfil no', () => {
    expect(puedeDarDeBaja(null)).toBe(false);
  });
});

describe('rolActual', () => {
  it.each(['ADMIN', 'PROFESIONAL', 'RECEPCION'] as const)('devuelve %s del perfil de la sesión', (rol) => {
    expect(rolActual(createLoggedContext(rol))).toBe(rol);
  });

  it('sin perfil devuelve null', () => {
    expect(rolActual(createTestContext())).toBeNull();
  });

  it('config/permisos re-exporta la misma función (C-11 no cambia)', () => {
    expect(rolActualConfig).toBe(rolActual);
  });
});
