import { describe, expect, it } from 'vitest';
import { createLoggedContext, createTestContext } from './pages';

describe('contextos de prueba (7.4, aditivo)', () => {
  it('createTestContext trae los mocks de turnos y pacientes con todos los métodos del cliente', () => {
    const ctx = createTestContext();
    expect(Object.keys(ctx.turnos).sort()).toEqual(['cambiarEstado', 'crear', 'listar', 'obtener', 'reprogramar']);
    expect(Object.keys(ctx.pacientes).sort()).toEqual(['buscar', 'obtener']);
    expect(Object.keys(ctx.agenda)).toContain('listarSillones');
  });

  it.each(['ADMIN', 'PROFESIONAL', 'RECEPCION'] as const)('createLoggedContext(%s) tiene sesión, perfil con ese rol y los mismos mocks', (rol) => {
    const ctx = createLoggedContext(rol);
    expect(ctx.session.profile()?.usuario.rol).toBe(rol);
    expect(ctx.session.isAuthenticated()).toBe(true);
    expect(ctx.turnos.listar).not.toBe(ctx.pacientes.buscar);
  });

  it('cada contexto tiene sus propios mocks (no se comparten entre pruebas)', () => {
    const a = createTestContext();
    const b = createTestContext();
    a.turnos.listar.mockResolvedValue([]);
    expect(b.turnos.listar.getMockImplementation()).toBeUndefined();
    expect(a.turnos).not.toBe(b.turnos);
  });
});
