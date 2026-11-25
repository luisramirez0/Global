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

describe('contextos de prueba de recordatorios (C-14)', () => {
  it('createTestContext trae el mock de recordatorios con los tres métodos y el registro vacío', () => {
    const ctx = createTestContext();
    expect(Object.keys(ctx.recordatorios).sort()).toEqual(['enlaceWhatsApp', 'enviarEmail', 'pendientes']);
    expect(ctx.enviosSinConfirmar.tiene(7)).toBe(false);
  });

  it('cada contexto tiene su propio registro y sus propios mocks', () => {
    const a = createTestContext();
    const b = createTestContext();
    a.enviosSinConfirmar.marcar(7);
    expect(b.enviosSinConfirmar.tiene(7)).toBe(false);
    expect(a.recordatorios).not.toBe(b.recordatorios);
  });

  it('createLoggedContext también incluye recordatorios', () => {
    const ctx = createLoggedContext('RECEPCION');
    expect(ctx.recordatorios.pendientes).toBeDefined();
    expect(ctx.enviosSinConfirmar.tiene(1)).toBe(false);
  });
});
