/**
 * Pruebas de integración del foco tras un cambio de turno (tarea 6.6 de C-13) sobre la página real `/agenda`:
 * cuando el turno sigue en la vista, cuando desaparece (siguiente, anterior, columna adyacente, vista vacía), desde
 * la lista, con respuestas tardías y con recarga fallida. Solo la API está simulada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import type { Turno } from '../../api/types';
import {
  anuncioAgenda,
  bloqueDe,
  boton,
  botonDialogo,
  dialogo,
  montarConTimers,
  tick,
  turnoAR,
  usarRelojFalso,
} from '../../test-support/agenda';
import { deferred, type TestContext } from '../../test-support/pages';

beforeEach(usarRelojFalso);
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  sessionStorage.clear();
});

const activo = (): HTMLElement | null => (document.activeElement instanceof HTMLElement ? document.activeElement : null);
const idActivo = (): string | undefined => activo()?.dataset['turnoId'];
const grupo = (): HTMLElement => document.querySelector<HTMLElement>('.grilla[role="group"]') as HTMLElement;
const accionesLista = (id: number): HTMLButtonElement => document.querySelector(`.lista-turnos button[data-turno-id="${id}"]`) as HTMLButtonElement;

function cancelar(): void {
  botonDialogo('Cancelar').click();
  const campo = dialogo()?.querySelector<HTMLTextAreaElement>('[name="motivoCancelacion"]');
  if (campo === null || campo === undefined) throw new Error('sin motivo');
  campo.value = 'Motivo';
  botonDialogo('Confirmar cancelación').click();
}

/** Cancela `id` desde su bloque de la grilla: la mutación sale bien y el rango recargado es `despues`. */
async function cancelarDesdeGrilla(ctx: TestContext, id: number, despues: Turno[]): Promise<void> {
  ctx.turnos.cambiarEstado.mockResolvedValue({ ...turnoAR(id, '10:00'), estado: 'CANCELADO' });
  ctx.turnos.listar.mockResolvedValue(despues);
  bloqueDe(id).focus();
  bloqueDe(id).click();
  cancelar();
  await tick();
}

async function cancelarDesdeLista(ctx: TestContext, id: number, despues: Turno[]): Promise<void> {
  ctx.turnos.cambiarEstado.mockResolvedValue({ ...turnoAR(id, '10:00'), estado: 'CANCELADO' });
  ctx.turnos.listar.mockResolvedValue(despues);
  accionesLista(id).focus();
  accionesLista(id).click();
  cancelar();
  await tick();
}

describe('6.6 foco en la grilla tras un cambio', () => {
  it('sigue visible (cancelados encendidos): el foco vuelve al mismo data-turno-id, ahora "Cancelado", con tabindex 0', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const t11 = turnoAR(3, '11:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10, t11] });
    document.querySelector<HTMLInputElement>('input[name="cancelados"]')?.click();
    await tick();
    await cancelarDesdeGrilla(ctx, 2, [t9, { ...t10, estado: 'CANCELADO' }, t11]);
    expect(activo()).toBe(bloqueDe(2));
    expect(bloqueDe(2).textContent).toContain('Cancelado');
    expect(bloqueDe(2).getAttribute('tabindex')).toBe('0');
    expect(anuncioAgenda()).toBe('Turno cancelado.');
  });

  it('desaparece (cancelados apagados): el foco va al turno siguiente de la columna, que queda con tabindex 0', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const t11 = turnoAR(3, '11:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10, t11] });
    await cancelarDesdeGrilla(ctx, 2, [t9, t11]);
    expect(idActivo()).toBe('3');
    expect(bloqueDe(3).getAttribute('tabindex')).toBe('0');
    expect(bloqueDe(1).getAttribute('tabindex')).toBe('-1');
  });

  it('el último de la columna: va al anterior', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10] });
    await cancelarDesdeGrilla(ctx, 2, [t9]);
    expect(idActivo()).toBe('1');
  });

  it('el primero de la columna: va al siguiente (no al último)', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const t11 = turnoAR(3, '11:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10, t11] });
    await cancelarDesdeGrilla(ctx, 1, [t10, t11]);
    expect(idActivo()).toBe('2');
  });

  it('columna vacía: el turno de inicio más cercano de la columna adyacente (10:15 del Sillón 2)', async () => {
    const s1 = turnoAR(1, '10:00', { sillonId: 1 });
    const s2a = turnoAR(2, '09:00', { sillonId: 2 });
    const s2b = turnoAR(3, '10:15', { sillonId: 2 });
    const { ctx } = await montarConTimers('ADMIN', { turnos: [s1, s2a, s2b] });
    await cancelarDesdeGrilla(ctx, 1, [s2a, s2b]);
    expect(idActivo()).toBe('3');
    expect(bloqueDe(3).getAttribute('tabindex')).toBe('0');
  });

  it('vista vacía: el foco queda en el contenedor role="group" de la grilla', async () => {
    const unico = turnoAR(1, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [unico] });
    await cancelarDesdeGrilla(ctx, 1, []);
    expect(activo()).toBe(grupo());
    expect(grupo().getAttribute('role')).toBe('group');
  });

  it('reprogramado a otra hora del mismo día: el foco vuelve al mismo turno en su nueva posición', async () => {
    const t10 = turnoAR(1, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t10] });
    const movido = turnoAR(1, '11:00');
    ctx.turnos.reprogramar.mockResolvedValue(movido);
    ctx.turnos.listar.mockResolvedValue([movido]);
    bloqueDe(1).focus();
    bloqueDe(1).click();
    botonDialogo('Reprogramar').click();
    const hora = dialogo()?.querySelector<HTMLInputElement>('[name="hora"]');
    if (hora !== null && hora !== undefined) hora.value = '11:00';
    botonDialogo('Confirmar reprogramación').click();
    await tick();
    expect(activo()).toBe(bloqueDe(1));
    expect(bloqueDe(1).textContent).toContain('11:00–11:30');
    expect(anuncioAgenda()).toBe('Turno reprogramado al martes 24/11 a las 11:00.');
  });

  it('reprogramado a otro día: el foco va al vecino, la vista no cambia de fecha y se anuncia adónde fue', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10] });
    ctx.turnos.reprogramar.mockResolvedValue(turnoAR(2, '10:00', { fecha: '2026-11-26' }));
    ctx.turnos.listar.mockResolvedValue([t9]);
    bloqueDe(2).focus();
    bloqueDe(2).click();
    botonDialogo('Reprogramar').click();
    const fecha = dialogo()?.querySelector<HTMLInputElement>('[name="fecha"]');
    if (fecha !== null && fecha !== undefined) fecha.value = '2026-11-26';
    botonDialogo('Confirmar reprogramación').click();
    await tick();
    expect(idActivo()).toBe('1');
    expect(document.querySelector('.rango-visible')?.textContent).toBe('martes 24/11/2026');
    expect(anuncioAgenda()).toBe('Turno reprogramado al jueves 26/11 a las 10:00; quedó fuera de esta vista.');
  });

  it('en el foco queda fijada la referencia del turno enfocado (un "Nuevo turno" posterior precarga desde él)', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10] });
    await cancelarDesdeGrilla(ctx, 2, [t9]);
    boton('Nuevo turno').click();
    expect(dialogo()?.querySelector<HTMLInputElement>('[name="hora"]')?.value).toBe('09:30');
  });
});

describe('6.6 foco desde la lista accesible', () => {
  it('cancelado desde "Acciones": el foco va al botón "Acciones" del turno anterior (09:00)', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10] });
    await cancelarDesdeLista(ctx, 2, [t9]);
    expect(activo()).toBe(accionesLista(1));
  });

  it('con un turno posterior: va al siguiente ítem del día', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const t11 = turnoAR(3, '11:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10, t11] });
    await cancelarDesdeLista(ctx, 2, [t9, t11]);
    expect(activo()).toBe(accionesLista(3));
  });

  it('un solo turno en la lista del día: el foco va al encabezado h2 del día', async () => {
    const unico = turnoAR(1, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [unico] });
    await cancelarDesdeLista(ctx, 1, []);
    expect(activo()?.tagName).toBe('H2');
    expect(activo()?.dataset['fecha']).toBe('2026-11-24');
    expect(activo()?.getAttribute('tabindex')).toBe('-1');
  });

  it('sigue en la lista (cancelados encendidos): el mismo ítem', async () => {
    const t10 = turnoAR(1, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t10] });
    document.querySelector<HTMLInputElement>('input[name="cancelados"]')?.click();
    await tick();
    await cancelarDesdeLista(ctx, 1, [{ ...t10, estado: 'CANCELADO' }]);
    expect(activo()).toBe(accionesLista(1));
  });
});

describe('6.6 respuestas tardías y recarga fallida', () => {
  it('la respuesta tardía de una recarga anterior no mueve el foco ni pisa a la recarga vigente', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10] });
    const tardia = deferred<Turno[]>();
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...t10, estado: 'CANCELADO' });
    ctx.turnos.listar.mockReturnValueOnce(tardia.promise).mockResolvedValueOnce([]);
    bloqueDe(2).focus();
    bloqueDe(2).click();
    cancelar();
    await tick();
    // Antes de que responda la recarga del cambio, la persona navega y esa otra carga termina primero.
    boton('Siguiente').click();
    await tick();
    tardia.resolve([t9]);
    await tick();
    expect(document.querySelector('.rango-visible')?.textContent).toBe('miércoles 25/11/2026');
    expect(document.querySelector('.grilla [data-turno-id]')).toBeNull();
    expect(idActivo()).toBeUndefined();
    expect(anuncioAgenda()).toBe('Turno cancelado.');
  });

  it('recarga fallida: el foco queda en el bloque que abrió el diálogo y se muestra el error con "Recargar agenda"', async () => {
    const t10 = turnoAR(1, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t10] });
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...t10, estado: 'CONFIRMADO' });
    ctx.turnos.listar.mockRejectedValue(new ApiError('network'));
    bloqueDe(1).focus();
    bloqueDe(1).click();
    botonDialogo('Confirmar').click();
    await tick();
    expect(activo()).toBe(bloqueDe(1));
    expect(document.querySelector('.estado-carga [role="alert"]')?.textContent).toContain('No se pudo conectar con el servidor.');
    expect(boton('Recargar agenda')).toBeInstanceOf(HTMLButtonElement);
    expect(anuncioAgenda()).toBe('Turno confirmado.');
    // La grilla anterior sigue a la vista para no perder el lugar.
    expect(document.querySelector('.grilla')?.hasAttribute('hidden')).toBe(false);
  });

  it('"Recargar agenda" tras la falla usa la misma función de foco con el estado del momento del error', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10] });
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...t10, estado: 'CANCELADO' });
    ctx.turnos.listar.mockRejectedValueOnce(new ApiError('network'));
    bloqueDe(2).focus();
    bloqueDe(2).click();
    cancelar();
    await tick();
    ctx.turnos.listar.mockResolvedValue([t9]);
    boton('Recargar agenda').click();
    await tick();
    expect(idActivo()).toBe('1');
    expect(document.querySelector('.estado-carga [role="alert"]')).toBeNull();
  });

  it('recarga fallida con el elemento que abrió el diálogo ya fuera del documento: el foco va al grupo de la grilla', async () => {
    const t10 = turnoAR(1, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t10] });
    const respuesta = deferred<Turno[]>();
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...t10, estado: 'CONFIRMADO' });
    ctx.turnos.listar.mockReturnValue(respuesta.promise);
    const bloque = bloqueDe(1);
    bloque.focus();
    bloque.click();
    botonDialogo('Confirmar').click();
    await tick();
    bloque.remove();
    respuesta.reject(new ApiError('network'));
    await tick();
    expect(activo()).toBe(grupo());
  });

  it('con "Recargar agenda" manual tras un 409 sin conflicto el foco también sigue a focoTrasCambio (vecino si el turno ya no está)', async () => {
    const t9 = turnoAR(1, '09:00');
    const t10 = turnoAR(2, '10:00');
    const { ctx } = await montarConTimers('ADMIN', { turnos: [t9, t10] });
    ctx.turnos.cambiarEstado.mockRejectedValue(new ApiError('conflict', { status: 409 }));
    bloqueDe(2).focus();
    bloqueDe(2).click();
    botonDialogo('Confirmar').click();
    await tick();
    ctx.turnos.listar.mockResolvedValue([t9]);
    botonDialogo('Recargar agenda').click();
    await tick();
    expect(dialogo()).toBeNull();
    expect(idActivo()).toBe('1');
  });
});
