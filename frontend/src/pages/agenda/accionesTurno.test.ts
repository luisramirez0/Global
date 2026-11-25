/**
 * Pruebas de integración de las acciones de estado (tareas 6.1, 6.2 y 6.4 de C-13): se renderiza la página real
 * `/agenda` con sus componentes y dominio reales; solo la API está simulada con los mocks de test-support.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROBLEM_409_GENERICO, TURNO_MALICIOSO } from '../../api/__fixtures__/turnos';
import type { Turno } from '../../api/types';
import {
  anuncioAgenda,
  bloqueDe,
  botonDialogo,
  dialogo,
  escape,
  http,
  montarConTimers,
  textosBotonesDialogo,
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

const PASADO = turnoAR(100, '10:00'); // 10:00–10:30, ya empezó (ahora = 12:00)
const FUTURO_CONFIRMADO = turnoAR(101, '15:00', { estado: 'CONFIRMADO' });
const EMPEZO_HACE_5 = turnoAR(102, '11:55', { estado: 'CONFIRMADO', minutos: 30 });

const abrirAcciones = (id: number): void => bloqueDe(id).click();
const motivo = (): HTMLTextAreaElement => {
  const e = dialogo()?.querySelector<HTMLTextAreaElement>('[name="motivoCancelacion"]');
  if (e === null || e === undefined) throw new Error('sin campo motivo');
  return e;
};
const escribirMotivo = (texto: string): void => {
  motivo().value = texto;
  motivo().dispatchEvent(new Event('input', { bubbles: true }));
};
const cancelarConMotivo = (texto: string): void => {
  abrirAcciones(100);
  botonDialogo('Cancelar').click();
  escribirMotivo(texto);
  botonDialogo('Confirmar cancelación').click();
};
const alertaAccion = (): string => dialogo()?.querySelector('.alerta-accion')?.textContent ?? '';
const llamadasEstado = (ctx: TestContext): unknown[] => ctx.turnos.cambiarEstado.mock.calls.map((c) => c[1]);

describe('6.1 acciones por estado', () => {
  it('turno PROGRAMADO que ya empezó: Confirmar, Cancelar, Reprogramar, Asistió y Ausente, todas habilitadas y en ese orden', async () => {
    await montarConTimers('ADMIN', { turnos: [PASADO] });
    abrirAcciones(100);
    expect(textosBotonesDialogo()).toEqual(['Confirmar', 'Cancelar', 'Reprogramar', 'Asistió', 'Ausente', 'Cerrar']);
    for (const t of ['Confirmar', 'Cancelar', 'Reprogramar', 'Asistió', 'Ausente']) {
      expect(botonDialogo(t).hasAttribute('aria-disabled')).toBe(false);
      expect(botonDialogo(t).hasAttribute('disabled')).toBe(false);
    }
  });

  it('el diálogo se llama "Turno de {paciente}" y muestra el detalle', async () => {
    await montarConTimers('ADMIN', { turnos: [PASADO] });
    abrirAcciones(100);
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Turno de Pérez, Ana');
    expect(dialogo()?.textContent).toContain('Limpieza');
  });

  it('CONFIRMADO no ofrece "Confirmar" pero sí el resto', async () => {
    await montarConTimers('ADMIN', { turnos: [FUTURO_CONFIRMADO] });
    abrirAcciones(101);
    expect(textosBotonesDialogo()).toEqual(['Cancelar', 'Reprogramar', 'Asistió', 'Ausente', 'Cerrar']);
  });

  it.each(['ASISTIO', 'AUSENTE', 'CANCELADO'] as const)('turno final %s: ninguna acción de estado ni Reprogramar', async (estado) => {
    await montarConTimers('ADMIN', { turnos: [turnoAR(100, '10:00', { estado })] });
    const check = document.querySelector<HTMLInputElement>('input[name="cancelados"]');
    check?.click();
    await tick();
    abrirAcciones(100);
    expect(textosBotonesDialogo()).toEqual(['Cerrar']);
  });

  it('RECEPCION ve las mismas acciones que ADMIN', async () => {
    await montarConTimers('RECEPCION', { turnos: [PASADO] });
    abrirAcciones(100);
    expect(textosBotonesDialogo()).toEqual(['Confirmar', 'Cancelar', 'Reprogramar', 'Asistió', 'Ausente', 'Cerrar']);
  });

  it('con horarios de dos profesionales (DP-1) siguen disponibles Reprogramar y las acciones de estado', async () => {
    const horarios = [
      { id: 1, profesionalId: 7, diaSemana: 2 as const, horaDesde: '09:00', horaHasta: '18:00' },
      { id: 2, profesionalId: 8, diaSemana: 2 as const, horaDesde: '09:00', horaHasta: '18:00' },
    ];
    await montarConTimers('ADMIN', { turnos: [PASADO], horarios });
    abrirAcciones(100);
    expect(textosBotonesDialogo()).toEqual(['Confirmar', 'Cancelar', 'Reprogramar', 'Asistió', 'Ausente', 'Cerrar']);
  });

  it('turno futuro: "Asistió" y "Ausente" con aria-disabled, enfocables y con el aviso por aria-describedby; "Cancelar" habilitado', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [FUTURO_CONFIRMADO] });
    abrirAcciones(101);
    for (const t of ['Asistió', 'Ausente']) {
      const b = botonDialogo(t);
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(b.hasAttribute('disabled')).toBe(false);
      expect(document.getElementById(b.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Disponible cuando empiece el turno.');
      b.focus();
      expect(document.activeElement).toBe(b);
      b.click();
    }
    await tick();
    expect(ctx.turnos.cambiarEstado).not.toHaveBeenCalled();
    expect(botonDialogo('Cancelar').hasAttribute('aria-disabled')).toBe(false);
    expect(dialogo()).not.toBeNull();
  });

  it('todas las acciones se alcanzan con Tab: el orden de enfocables del diálogo es Cancelar, Reprogramar, Asistió, Ausente, Cerrar', async () => {
    await montarConTimers('ADMIN', { turnos: [FUTURO_CONFIRMADO] });
    abrirAcciones(101);
    const enfocables = [...(dialogo()?.querySelectorAll<HTMLElement>('button') ?? [])].filter((b) => !b.hasAttribute('disabled') && b.getAttribute('tabindex') !== '-1');
    expect(enfocables.map((b) => b.textContent)).toEqual(['Cancelar', 'Reprogramar', 'Asistió', 'Ausente', 'Cerrar']);
  });

  it('turno que empezó hace 5 minutos: "Asistió" envía {estado: "ASISTIO"} y se anuncia el resultado', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [EMPEZO_HACE_5] });
    abrirAcciones(102);
    expect(botonDialogo('Asistió').hasAttribute('aria-disabled')).toBe(false);
    botonDialogo('Asistió').click();
    await tick();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledWith(102, { estado: 'ASISTIO' });
    expect(anuncioAgenda()).toBe('Asistencia registrada.');
  });

  it('"Ausente" en un turno iniciado envía {estado: "AUSENTE"}', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    abrirAcciones(100);
    botonDialogo('Ausente').click();
    await tick();
    expect(llamadasEstado(ctx)).toEqual([{ estado: 'AUSENTE' }]);
    expect(anuncioAgenda()).toBe('Ausencia registrada.');
  });

  it('el límite es el instante: justo al empezar ya se puede marcar; un segundo antes no', async () => {
    vi.setSystemTime(new Date('2026-11-24T13:00:00Z')); // 10:00 en punto
    await montarConTimers('ADMIN', { turnos: [PASADO] });
    abrirAcciones(100);
    expect(botonDialogo('Asistió').hasAttribute('aria-disabled')).toBe(false);
    escape();
    vi.setSystemTime(new Date('2026-11-24T12:59:59Z'));
    abrirAcciones(100);
    expect(botonDialogo('Asistió').getAttribute('aria-disabled')).toBe('true');
  });

  it('la comparación es por instantes: no depende de la zona horaria del entorno', async () => {
    const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
    const original = env['TZ'];
    env['TZ'] = 'Asia/Tokyo';
    try {
      await montarConTimers('ADMIN', { turnos: [PASADO, FUTURO_CONFIRMADO] });
      abrirAcciones(100);
      expect(botonDialogo('Asistió').hasAttribute('aria-disabled')).toBe(false);
      escape();
      abrirAcciones(101);
      expect(botonDialogo('Asistió').getAttribute('aria-disabled')).toBe('true');
    } finally {
      if (original === undefined) delete env['TZ'];
      else env['TZ'] = original;
    }
  });

  it('Confirmar envía el PATCH correcto, recarga el rango, anuncia y deja el foco en el mismo turno', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...PASADO, estado: 'CONFIRMADO' });
    ctx.turnos.listar.mockResolvedValue([{ ...PASADO, estado: 'CONFIRMADO' }]);
    bloqueDe(100).focus();
    abrirAcciones(100);
    botonDialogo('Confirmar').click();
    await tick();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledWith(100, { estado: 'CONFIRMADO' });
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
    expect(dialogo()).toBeNull();
    expect(anuncioAgenda()).toBe('Turno confirmado.');
    expect(document.activeElement).toBe(bloqueDe(100));
    expect(bloqueDe(100).textContent).toContain('Confirmado');
    expect(bloqueDe(100).getAttribute('tabindex')).toBe('0');
  });

  it('Escape cierra el diálogo y el foco vuelve al bloque; desde la lista, al botón "Acciones"', async () => {
    await montarConTimers('ADMIN', { turnos: [PASADO] });
    bloqueDe(100).focus();
    abrirAcciones(100);
    escape();
    expect(dialogo()).toBeNull();
    expect(document.activeElement).toBe(bloqueDe(100));
    const acciones = document.querySelector<HTMLButtonElement>('.lista-turnos button');
    acciones?.focus();
    acciones?.click();
    escape();
    expect(document.activeElement).toBe(acciones);
  });

  it('mientras envía, las acciones se deshabilitan y un doble clic hace una sola request', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    const respuesta = deferred<Turno>();
    ctx.turnos.cambiarEstado.mockReturnValue(respuesta.promise);
    abrirAcciones(100);
    const confirmar = botonDialogo('Confirmar');
    confirmar.click();
    confirmar.click();
    botonDialogo('Ausente').click();
    await tick();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledTimes(1);
    expect(confirmar.disabled).toBe(true);
    respuesta.resolve({ ...PASADO, estado: 'CONFIRMADO' });
    await tick();
    expect(dialogo()).toBeNull();
  });

  it('un 403 muestra el mensaje fijo, la agenda no cambia ni se recarga', async () => {
    const { ctx } = await montarConTimers('RECEPCION', { turnos: [PASADO] });
    ctx.turnos.cambiarEstado.mockRejectedValue(http(403));
    cancelarConMotivo('Ya no viene');
    await tick();
    expect(alertaAccion()).toContain('No tenés permiso para realizar esta acción.');
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
    expect(dialogo()).not.toBeNull();
    expect(bloqueDe(100).textContent).toContain('Programado');
  });

  it('XSS: las notas y el motivo del turno se ven como texto en el detalle, sin script ni img', async () => {
    await montarConTimers('ADMIN', { turnos: [TURNO_MALICIOSO] });
    abrirAcciones(109);
    expect(dialogo()?.textContent).toContain('<script>alert(1)</script>');
    expect(dialogo()?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('6.2 cancelación con motivo', () => {
  it('"Cancelar" abre el paso del motivo con foco en el campo; "Volver" regresa a las acciones sin enviar', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    abrirAcciones(100);
    botonDialogo('Cancelar').click();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Cancelar turno');
    expect(document.activeElement).toBe(motivo());
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    botonDialogo('Volver').click();
    expect(textosBotonesDialogo()).toContain('Reprogramar');
    expect(ctx.turnos.cambiarEstado).not.toHaveBeenCalled();
  });

  it('motivo válido recortado: envía {estado: "CANCELADO", motivoCancelacion} exactos', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...PASADO, estado: 'CANCELADO' });
    ctx.turnos.listar.mockResolvedValue([]);
    cancelarConMotivo('  Paciente avisó  ');
    await tick();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledTimes(1);
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledWith(100, { estado: 'CANCELADO', motivoCancelacion: 'Paciente avisó' });
  });

  it.each(['', '   ', '\n\t'])('motivo vacío o de solo espacios (%j): error en el campo y ninguna request', async (texto) => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    cancelarConMotivo(texto);
    await tick();
    expect(ctx.turnos.cambiarEstado).not.toHaveBeenCalled();
    expect(motivo().getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(motivo().getAttribute('aria-describedby') ?? '')?.textContent).toBe('Indicá el motivo de la cancelación.');
    expect(dialogo()).not.toBeNull();
  });

  it('127 ñ y una a (255 bytes) es válido y se envía', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...PASADO, estado: 'CANCELADO' });
    const texto = 'ñ'.repeat(127) + 'a';
    cancelarConMotivo(texto);
    await tick();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledWith(100, { estado: 'CANCELADO', motivoCancelacion: texto });
  });

  it('128 ñ (128 caracteres, 256 bytes) es inválido: error de largo y sin request', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    cancelarConMotivo('ñ'.repeat(128));
    await tick();
    expect(ctx.turnos.cambiarEstado).not.toHaveBeenCalled();
    expect(document.getElementById(motivo().getAttribute('aria-describedby') ?? '')?.textContent).toContain('demasiado largo');
  });

  it('252 a y un emoji (256 bytes) es inválido; 251 a y un emoji (255 bytes) es válido', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...PASADO, estado: 'CANCELADO' });
    cancelarConMotivo('a'.repeat(252) + '😀');
    await tick();
    expect(ctx.turnos.cambiarEstado).not.toHaveBeenCalled();
    escribirMotivo('a'.repeat(251) + '😀');
    botonDialogo('Confirmar cancelación').click();
    await tick();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledTimes(1);
  });

  it('255 a es válido y 256 a no', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    cancelarConMotivo('a'.repeat(256));
    await tick();
    expect(ctx.turnos.cambiarEstado).not.toHaveBeenCalled();
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...PASADO, estado: 'CANCELADO' });
    escribirMotivo('a'.repeat(255));
    botonDialogo('Confirmar cancelación').click();
    await tick();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledTimes(1);
  });

  it('el campo no usa maxlength (cuenta UTF-16, no bytes): la validación es la del envío', async () => {
    await montarConTimers('ADMIN', { turnos: [PASADO] });
    abrirAcciones(100);
    botonDialogo('Cancelar').click();
    expect(motivo().hasAttribute('maxlength')).toBe(false);
  });

  it('tras cancelar con cancelados ocultos el turno desaparece y se anuncia "Turno cancelado."', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    ctx.turnos.cambiarEstado.mockResolvedValue({ ...PASADO, estado: 'CANCELADO' });
    ctx.turnos.listar.mockResolvedValue([{ ...PASADO, estado: 'CANCELADO' }]);
    cancelarConMotivo('No viene');
    await tick();
    expect(document.querySelector('[data-turno-id="100"]')).toBeNull();
    expect(anuncioAgenda()).toBe('Turno cancelado.');
    expect(dialogo()).toBeNull();
  });

  it('un 400 sobre el motivo se muestra en el campo y el texto se conserva', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    ctx.turnos.cambiarEstado.mockRejectedValue(http(400, { errores: [{ campo: 'motivoCancelacion', mensaje: 'demasiado largo' }] }));
    cancelarConMotivo('Texto del motivo');
    await tick();
    expect(document.getElementById(motivo().getAttribute('aria-describedby') ?? '')?.textContent).toBe('demasiado largo');
    expect(motivo().value).toBe('Texto del motivo');
  });

  it('"Volver" y reentrar conserva el motivo escrito', async () => {
    await montarConTimers('ADMIN', { turnos: [PASADO] });
    abrirAcciones(100);
    botonDialogo('Cancelar').click();
    escribirMotivo('Lo que escribí');
    botonDialogo('Volver').click();
    botonDialogo('Cancelar').click();
    expect(motivo().value).toBe('Lo que escribí');
  });

  it('el envío doble de la cancelación hace una sola request', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    const respuesta = deferred<Turno>();
    ctx.turnos.cambiarEstado.mockReturnValue(respuesta.promise);
    cancelarConMotivo('Motivo');
    botonDialogo('Confirmar cancelación').click();
    dialogo()?.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledTimes(1);
    respuesta.resolve({ ...PASADO, estado: 'CANCELADO' });
    await tick();
  });
});

describe('6.4 errores sin recarga automática', () => {
  const casos: readonly (readonly [string, () => ReturnType<typeof http>, string])[] = [
    ['409 sin conflicto', () => http(409, PROBLEM_409_GENERICO), 'No se pudo completar la acción. Es posible que el turno haya cambiado.'],
    ['404', () => http(404), 'El turno ya no existe.'],
    ['500', () => http(500, { title: 'Error interno' }), 'Ocurrió un error inesperado. Probá de nuevo o recargá la agenda.'],
  ];

  describe.each([
    ['confirmar', () => botonDialogo('Confirmar').click()],
    ['cancelar', () => {
      botonDialogo('Cancelar').click();
      escribirMotivo('Motivo conservado');
      botonDialogo('Confirmar cancelación').click();
    }],
  ] as const)('al %s', (_accion, ejecutar) => {
    it.each(casos)('%s: mensaje fijo y "Recargar agenda", el diálogo conserva sus datos y listar no se vuelve a llamar', async (_n, error, mensaje) => {
      const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
      ctx.turnos.cambiarEstado.mockRejectedValue(error());
      abrirAcciones(100);
      ejecutar();
      await tick();
      expect(alertaAccion()).toContain(mensaje);
      expect(textosBotonesDialogo()).toContain('Recargar agenda');
      expect(dialogo()).not.toBeNull();
      if (_accion === 'cancelar') expect(motivo().value).toBe('Motivo conservado');
      await tick(120_000);
      expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).not.toContain('Error interno');
      expect(document.body.textContent).not.toContain('Modificación concurrente');
    });

    it('"Recargar agenda" cierra el diálogo, pide el rango una sola vez y devuelve el foco con focoTrasCambio', async () => {
      const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
      ctx.turnos.cambiarEstado.mockRejectedValue(http(409, PROBLEM_409_GENERICO));
      bloqueDe(100).focus();
      abrirAcciones(100);
      ejecutar();
      await tick();
      botonDialogo('Recargar agenda').click();
      await tick();
      expect(dialogo()).toBeNull();
      expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
      expect(document.activeElement).toBe(bloqueDe(100));
    });
  });

  it('un error con datos que no requieren recarga manual (403) no ofrece "Recargar agenda"', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    ctx.turnos.cambiarEstado.mockRejectedValue(http(403));
    abrirAcciones(100);
    botonDialogo('Confirmar').click();
    await tick();
    expect(textosBotonesDialogo()).not.toContain('Recargar agenda');
  });

  it('tras un error se puede reintentar la acción y el éxito sí recarga', async () => {
    const { ctx } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    ctx.turnos.cambiarEstado.mockRejectedValueOnce(http(500)).mockResolvedValueOnce({ ...PASADO, estado: 'CONFIRMADO' });
    abrirAcciones(100);
    botonDialogo('Confirmar').click();
    await tick();
    expect(alertaAccion()).not.toBe('');
    botonDialogo('Confirmar').click();
    await tick();
    expect(alertaAccion()).toBe('');
    expect(dialogo()).toBeNull();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
  });

  it('una respuesta que llega con la página ya cerrada se ignora: ni recarga ni anuncio', async () => {
    const { ctx, page } = await montarConTimers('ADMIN', { turnos: [PASADO] });
    const respuesta = deferred<Turno>();
    ctx.turnos.cambiarEstado.mockReturnValue(respuesta.promise);
    abrirAcciones(100);
    botonDialogo('Confirmar').click();
    await tick();
    page.dispose?.();
    respuesta.resolve({ ...PASADO, estado: 'CONFIRMADO' });
    await tick();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
    expect(anuncioAgenda()).toBe('');
  });
});
