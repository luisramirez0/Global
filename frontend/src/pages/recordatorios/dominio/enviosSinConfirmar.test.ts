import { afterEach, describe, expect, it } from 'vitest';
import { crearRegistroEnviosSinConfirmar } from './enviosSinConfirmar';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('registro de envíos sin confirmar (D11)', () => {
  it('tiene() es falso al crear', () => {
    const r = crearRegistroEnviosSinConfirmar();
    expect(r.tiene(7)).toBe(false);
    expect(r.tiene(8)).toBe(false);
  });

  it('marcar(7) deja tiene(7) verdadero y tiene(8) falso', () => {
    const r = crearRegistroEnviosSinConfirmar();
    r.marcar(7);
    expect(r.tiene(7)).toBe(true);
    expect(r.tiene(8)).toBe(false);
  });

  it('marcar dos veces el mismo id es idempotente y varios ids conviven', () => {
    const r = crearRegistroEnviosSinConfirmar();
    r.marcar(7);
    r.marcar(7);
    r.marcar(9);
    expect([r.tiene(7), r.tiene(8), r.tiene(9)]).toEqual([true, false, true]);
  });

  it('dos registros son independientes', () => {
    const a = crearRegistroEnviosSinConfirmar();
    const b = crearRegistroEnviosSinConfirmar();
    a.marcar(7);
    expect(b.tiene(7)).toBe(false);
  });

  it('localStorage y sessionStorage quedan vacíos tras marcar', () => {
    const r = crearRegistroEnviosSinConfirmar();
    r.marcar(7);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('enviado() es falso al crear, marcarEnviado(7) lo deja verdadero solo para el 7 y es independiente de tiene()', () => {
    const r = crearRegistroEnviosSinConfirmar();
    expect(r.enviado(7)).toBe(false);
    r.marcarEnviado(7);
    expect(r.enviado(7)).toBe(true);
    expect(r.enviado(8)).toBe(false);
    expect(r.tiene(7)).toBe(false);
    r.marcar(8);
    expect(r.enviado(8)).toBe(false);
  });

  it('los envíos exitosos son por registro y no tocan el almacenamiento', () => {
    const a = crearRegistroEnviosSinConfirmar();
    const b = crearRegistroEnviosSinConfirmar();
    a.marcarEnviado(7);
    expect(b.enviado(7)).toBe(false);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('enCurso: falso al crear, verdadero tras iniciarEnvio, falso tras terminarEnvio, por turno', () => {
    const r = crearRegistroEnviosSinConfirmar();
    expect(r.enCurso(7)).toBe(false);
    r.iniciarEnvio(7);
    expect(r.enCurso(7)).toBe(true);
    expect(r.enCurso(8)).toBe(false);
    r.terminarEnvio(7);
    expect(r.enCurso(7)).toBe(false);
  });

  it('limpiar() vacía los tres estados y no toca otros registros', () => {
    const a = crearRegistroEnviosSinConfirmar();
    const b = crearRegistroEnviosSinConfirmar();
    a.marcar(7);
    a.marcarEnviado(8);
    a.iniciarEnvio(9);
    b.marcar(7);
    a.limpiar();
    expect([a.tiene(7), a.enviado(8), a.enCurso(9)]).toEqual([false, false, false]);
    expect(b.tiene(7)).toBe(true);
  });
});
