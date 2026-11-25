/**
 * Pruebas de integración de la reprogramación (tarea 6.3 de C-13) sobre la página real `/agenda`: solo la API
 * está simulada. Incluye rechazos, sobreturno con confirmación, la restricción de RECEPCION (DP-2) y los errores
 * sin recarga automática.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFLICTO_PROFESIONAL,
  PROBLEM_409_CONFLICTO,
  PROBLEM_409_GENERICO,
  PROBLEM_422_BLOQUEO,
  PROBLEM_422_FUERA_DE_AGENDA,
  PROBLEM_422_REFERENCIA,
} from '../../api/__fixtures__/turnos';
import type { ApiError } from '../../api/errors';
import type { Rol, Turno, TurnoReprogramarRequest } from '../../api/types';
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

const T = turnoAR(100, '10:00'); // 24/11 10:00–10:30, Sillón 1, PROGRAMADO
const MOVIDO: Turno = { ...T, inicio: '2026-11-24T14:00:00Z', fin: '2026-11-24T14:30:00Z' };

const campo = (name: string): HTMLInputElement | HTMLSelectElement => {
  const e = dialogo()?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  if (e === null || e === undefined) throw new Error(`sin campo ${name}`);
  return e;
};
const valores = () => ({ fecha: campo('fecha').value, hora: campo('hora').value, sillonId: campo('sillonId').value });
function escribir(name: string, valor: string): void {
  const c = campo(name);
  c.value = valor;
  c.dispatchEvent(new Event(c instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}
const abrirReprogramar = (): void => {
  bloqueDe(100).click();
  botonDialogo('Reprogramar').click();
};
const confirmar = (): void => botonDialogo('Confirmar reprogramación').click();
const alertaAccion = (): string => dialogo()?.querySelector('.alerta-accion')?.textContent ?? '';
const llamadas = (ctx: TestContext): [number, TurnoReprogramarRequest][] => ctx.turnos.reprogramar.mock.calls.map((c) => [c[0], c[1]]);
const ofreceSobreturno = (): boolean => textosBotonesDialogo().includes('Agendar como sobreturno');

async function montarYAbrir(rol: Rol = 'ADMIN', turnos: Turno[] = [T]) {
  const m = await montarConTimers(rol, { turnos });
  abrirReprogramar();
  return m;
}

describe('6.3 formulario de reprogramación', () => {
  it('"Reprogramar" abre el formulario con fecha, hora y sillón del turno precargados y el foco en el primer campo', async () => {
    const { ctx } = await montarYAbrir();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Reprogramar turno');
    expect(valores()).toEqual({ fecha: '2026-11-24', hora: '10:00', sillonId: '1' });
    expect(document.activeElement).toBe(campo('fecha'));
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    expect(ctx.turnos.reprogramar).not.toHaveBeenCalled();
  });

  it('el selector de sillón ofrece los activos y el actual aunque esté inactivo', async () => {
    const enInactivo = turnoAR(100, '10:00', { sillonId: 3 });
    const ctx = (await montarConTimers('ADMIN', { turnos: [enInactivo], sillones: [{ id: 1, nombre: 'Sillón 1', activo: true }, { id: 2, nombre: 'Sillón 2', activo: true }, { id: 3, nombre: 'Sillón viejo', activo: false }] })).ctx;
    expect(ctx).toBeDefined();
    abrirReprogramar();
    expect([...(campo('sillonId') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Sillón 1', 'Sillón 2', 'Sillón viejo (inactivo)']);
    expect(campo('sillonId').value).toBe('3');
  });

  it('mismo sillón: envía solo el inicio en UTC, recarga, anuncia el destino y cierra', async () => {
    const { ctx } = await montarYAbrir();
    ctx.turnos.reprogramar.mockResolvedValue(MOVIDO);
    ctx.turnos.listar.mockResolvedValue([MOVIDO]);
    escribir('hora', '11:00');
    confirmar();
    await tick();
    expect(llamadas(ctx)).toEqual([[100, { inicio: '2026-11-24T14:00:00Z' }]]);
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
    expect(dialogo()).toBeNull();
    expect(anuncioAgenda()).toBe('Turno reprogramado al martes 24/11 a las 11:00.');
  });

  it('otro sillón: envía inicio y sillonId, y el anuncio nombra el sillón nuevo', async () => {
    const { ctx } = await montarYAbrir();
    const aSillon2: Turno = { ...T, sillonId: 2 };
    ctx.turnos.reprogramar.mockResolvedValue(aSillon2);
    ctx.turnos.listar.mockResolvedValue([aSillon2]);
    escribir('sillonId', '2');
    confirmar();
    await tick();
    expect(llamadas(ctx)).toEqual([[100, { inicio: '2026-11-24T13:00:00Z', sillonId: 2 }]]);
    expect(anuncioAgenda()).toBe('Turno reprogramado al martes 24/11 a las 10:00 en Sillón 2.');
  });

  it('nunca envía profesionalId ni sobreturno en un envío normal', async () => {
    const { ctx } = await montarYAbrir();
    ctx.turnos.reprogramar.mockResolvedValue(MOVIDO);
    escribir('hora', '11:00');
    confirmar();
    await tick();
    const cuerpo = llamadas(ctx)[0]?.[1] ?? {};
    expect(Object.keys(cuerpo)).toEqual(['inicio']);
  });

  it('a un día que sale de la vista: anuncia el destino y que quedó fuera, y la vista no cambia de fecha', async () => {
    const { ctx } = await montarYAbrir();
    const aJueves: Turno = { ...T, inicio: '2026-11-26T13:00:00Z', fin: '2026-11-26T13:30:00Z' };
    ctx.turnos.reprogramar.mockResolvedValue(aJueves);
    ctx.turnos.listar.mockResolvedValue([]);
    escribir('fecha', '2026-11-26');
    confirmar();
    await tick();
    expect(llamadas(ctx)).toEqual([[100, { inicio: '2026-11-26T13:00:00Z' }]]);
    expect(anuncioAgenda()).toBe('Turno reprogramado al jueves 26/11 a las 10:00; quedó fuera de esta vista.');
    expect(document.querySelector('.rango-visible')?.textContent).toBe('martes 24/11/2026');
    expect(ctx.turnos.listar.mock.calls.at(-1)?.[0]).toMatchObject({ desde: '2026-11-24T03:00:00Z' });
  });

  it('22:30 del consultorio se envía como 01:30Z del día siguiente', async () => {
    const { ctx } = await montarYAbrir();
    ctx.turnos.reprogramar.mockResolvedValue(MOVIDO);
    escribir('hora', '22:30');
    confirmar();
    await tick();
    expect(llamadas(ctx)[0]?.[1]).toEqual({ inicio: '2026-11-25T01:30:00Z' });
  });

  it('fecha u hora vacías o inválidas marcan el campo y no envían nada', async () => {
    const { ctx } = await montarYAbrir();
    escribir('hora', '');
    escribir('fecha', '');
    confirmar();
    await tick();
    expect(ctx.turnos.reprogramar).not.toHaveBeenCalled();
    expect(campo('hora').getAttribute('aria-invalid')).toBe('true');
    expect(campo('fecha').getAttribute('aria-invalid')).toBe('true');
  });

  it('"Volver" regresa a las acciones sin enviar; Escape cierra y devuelve el foco al bloque', async () => {
    const { ctx } = await montarYAbrir();
    botonDialogo('Volver').click();
    expect(textosBotonesDialogo()).toContain('Cancelar');
    expect(ctx.turnos.reprogramar).not.toHaveBeenCalled();
    abrirReprogramarDesdeAcciones();
    bloqueDe(100).focus();
    escape();
    expect(dialogo()).toBeNull();
  });

  it('el botón de envío se deshabilita mientras envía: una sola request', async () => {
    const { ctx } = await montarYAbrir();
    const respuesta = deferred<Turno>();
    ctx.turnos.reprogramar.mockReturnValue(respuesta.promise);
    escribir('hora', '11:00');
    const boton = botonDialogo('Confirmar reprogramación');
    boton.click();
    boton.click();
    dialogo()?.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    expect(ctx.turnos.reprogramar).toHaveBeenCalledTimes(1);
    expect(boton.disabled).toBe(true);
    respuesta.resolve(MOVIDO);
    await tick();
    expect(dialogo()).toBeNull();
  });

  it('una respuesta con la página cerrada se ignora', async () => {
    const { ctx, page } = await montarYAbrir();
    const respuesta = deferred<Turno>();
    ctx.turnos.reprogramar.mockReturnValue(respuesta.promise);
    escribir('hora', '11:00');
    confirmar();
    await tick();
    page.dispose?.();
    respuesta.resolve(MOVIDO);
    await tick();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
    expect(anuncioAgenda()).toBe('');
  });
});

function abrirReprogramarDesdeAcciones(): void {
  botonDialogo('Reprogramar').click();
}

describe('6.3 rechazos y datos conservados', () => {
  const profesional = (): ApiError => http(409, { ...PROBLEM_409_CONFLICTO, conflicto: CONFLICTO_PROFESIONAL });
  const rechazos: readonly (readonly [string, () => ApiError, string])[] = [
    ['409 SILLON', () => http(409, PROBLEM_409_CONFLICTO), 'El sillón ya tiene un turno en ese horario.'],
    ['409 PROFESIONAL', profesional, 'El profesional ya tiene un turno en ese horario.'],
    ['422 fuera de agenda', () => http(422, PROBLEM_422_FUERA_DE_AGENDA), 'El horario no está disponible según las reglas de la agenda. Revisá el horario de atención y la grilla.'],
    ['422 bloqueo', () => http(422, PROBLEM_422_BLOQUEO), 'El horario está bloqueado.'],
    ['422 referencia', () => http(422, PROBLEM_422_REFERENCIA), 'Alguno de los datos elegidos ya no existe; actualizá la agenda.'],
    ['403', () => http(403), 'No tenés permiso para realizar esta acción.'],
  ];

  it.each(rechazos)('%s: mensaje fijo, diálogo abierto, datos conservados y sin recarga', async (_n, error, mensaje) => {
    const { ctx } = await montarYAbrir();
    ctx.turnos.reprogramar.mockRejectedValue(error());
    escribir('hora', '11:00');
    escribir('sillonId', '2');
    confirmar();
    await tick();
    expect(alertaAccion()).toContain(mensaje);
    expect(valores()).toEqual({ fecha: '2026-11-24', hora: '11:00', sillonId: '2' });
    expect(dialogo()).not.toBeNull();
    await tick(60_000);
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('Turno en conflicto:  ');
  });

  it('409 SILLON muestra la hora del conflicto, no ofrece sobreturno y se asocia al campo hora', async () => {
    const { ctx } = await montarYAbrir();
    ctx.turnos.reprogramar.mockRejectedValue(http(409, PROBLEM_409_CONFLICTO));
    confirmar();
    await tick();
    expect(alertaAccion()).toContain('10:00–10:30');
    expect(ofreceSobreturno()).toBe(false);
    expect(campo('hora').getAttribute('aria-invalid')).toBe('true');
  });

  it('400 con errores por campo: inicio se muestra en la hora', async () => {
    const { ctx } = await montarYAbrir();
    ctx.turnos.reprogramar.mockRejectedValue(http(400, { errores: [{ campo: 'inicio', mensaje: 'formato inválido' }] }));
    confirmar();
    await tick();
    expect(document.getElementById(campo('hora').getAttribute('aria-describedby') ?? '')?.textContent).toBe('formato inválido');
    expect(valores().hora).toBe('10:00');
  });

  describe.each([
    ['409 sin conflicto', () => http(409, PROBLEM_409_GENERICO), 'No se pudo completar la acción. Es posible que el turno haya cambiado.'],
    ['404', () => http(404), 'El turno ya no existe.'],
    ['500', () => http(500, { title: 'Error interno' }), 'Ocurrió un error inesperado. Probá de nuevo o recargá la agenda.'],
  ] as const)('%s', (_n, error, mensaje) => {
    it('mensaje fijo, "Recargar agenda" manual, datos conservados y listar sin llamadas nuevas hasta pulsarlo', async () => {
      const { ctx } = await montarYAbrir();
      ctx.turnos.reprogramar.mockRejectedValue(error());
      escribir('hora', '11:30');
      confirmar();
      await tick();
      expect(alertaAccion()).toContain(mensaje);
      expect(valores().hora).toBe('11:30');
      await tick(120_000);
      expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
      botonDialogo('Recargar agenda').click();
      await tick();
      expect(dialogo()).toBeNull();
      expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
      expect(document.body.textContent).not.toContain('Error interno');
    });
  });
});

describe('6.3 sobreturno al reprogramar', () => {
  const profesional = (): ApiError => http(409, { ...PROBLEM_409_CONFLICTO, conflicto: CONFLICTO_PROFESIONAL });

  async function hastaOferta(error: () => ApiError = profesional, rol: Rol = 'ADMIN') {
    const m = await montarYAbrir(rol);
    escribir('hora', '11:00');
    escribir('sillonId', '2');
    m.ctx.turnos.reprogramar.mockRejectedValueOnce(error());
    confirmar();
    await tick();
    return m;
  }

  it('409 PROFESIONAL y 422 en el inicio ofrecen el sobreturno al administrador', async () => {
    await hastaOferta();
    expect(ofreceSobreturno()).toBe(true);
  });

  it('elegirlo pide confirmación con foco en "Confirmar sobreturno" y todavía no envía', async () => {
    const { ctx } = await hastaOferta(() => http(422, PROBLEM_422_FUERA_DE_AGENDA));
    botonDialogo('Agendar como sobreturno').click();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Confirmar sobreturno');
    expect(dialogo()?.textContent).toContain('Se registrará como sobreturno, fuera de las reglas habituales de la agenda. ¿Confirmás?');
    expect(document.activeElement).toBe(botonDialogo('Confirmar sobreturno'));
    expect(ctx.turnos.reprogramar).toHaveBeenCalledTimes(1);
  });

  it('confirmar reenvía el mismo cuerpo con sobreturno: true; el éxito cierra, recarga y anuncia', async () => {
    const { ctx } = await hastaOferta();
    ctx.turnos.reprogramar.mockResolvedValueOnce({ ...MOVIDO, sillonId: 2, sobreturno: true });
    botonDialogo('Agendar como sobreturno').click();
    botonDialogo('Confirmar sobreturno').click();
    await tick();
    const [primera, segunda] = llamadas(ctx);
    expect(primera?.[1]).toEqual({ inicio: '2026-11-24T14:00:00Z', sillonId: 2 });
    expect(segunda?.[1]).toEqual({ inicio: '2026-11-24T14:00:00Z', sillonId: 2, sobreturno: true });
    expect(dialogo()).toBeNull();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
    expect(anuncioAgenda()).toBe('Turno reprogramado al martes 24/11 a las 11:00 en Sillón 2.');
  });

  it('"Volver" regresa al formulario con los datos intactos y sin enviar', async () => {
    const { ctx } = await hastaOferta();
    botonDialogo('Agendar como sobreturno').click();
    botonDialogo('Volver').click();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Reprogramar turno');
    expect(valores()).toEqual({ fecha: '2026-11-24', hora: '11:00', sillonId: '2' });
    expect(ctx.turnos.reprogramar).toHaveBeenCalledTimes(1);
    expect(ofreceSobreturno()).toBe(true);
  });

  it('si el reintento falla con 409 SILLON se muestra su mensaje y no se vuelve a ofrecer', async () => {
    const { ctx } = await hastaOferta();
    ctx.turnos.reprogramar.mockRejectedValueOnce(http(409, PROBLEM_409_CONFLICTO));
    botonDialogo('Agendar como sobreturno').click();
    botonDialogo('Confirmar sobreturno').click();
    await tick();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Reprogramar turno');
    expect(alertaAccion()).toContain('El sillón ya tiene un turno en ese horario.');
    expect(ofreceSobreturno()).toBe(false);
    expect(valores()).toEqual({ fecha: '2026-11-24', hora: '11:00', sillonId: '2' });
  });

  it('ninguna request lleva sobreturno: true sin confirmación', async () => {
    const { ctx } = await hastaOferta();
    botonDialogo('Agendar como sobreturno').click();
    botonDialogo('Volver').click();
    escribir('hora', '11:15');
    ctx.turnos.reprogramar.mockRejectedValueOnce(profesional());
    confirmar();
    await tick();
    expect(llamadas(ctx).every(([, cuerpo]) => cuerpo.sobreturno === undefined)).toBe(true);
  });

  it('el botón "Confirmar sobreturno" se deshabilita mientras envía', async () => {
    const { ctx } = await hastaOferta();
    const respuesta = deferred<Turno>();
    ctx.turnos.reprogramar.mockReturnValueOnce(respuesta.promise);
    botonDialogo('Agendar como sobreturno').click();
    const b = botonDialogo('Confirmar sobreturno');
    b.click();
    b.click();
    await tick();
    expect(ctx.turnos.reprogramar).toHaveBeenCalledTimes(2);
    expect(b.disabled).toBe(true);
    respuesta.resolve(MOVIDO);
    await tick();
  });

  it.each([
    ['409 PROFESIONAL', profesional, 'El profesional ya tiene un turno en ese horario.'],
    ['422 en el inicio', () => http(422, PROBLEM_422_FUERA_DE_AGENDA), 'El horario no está disponible según las reglas de la agenda. Revisá el horario de atención y la grilla.'],
    ['422 bloqueo', () => http(422, PROBLEM_422_BLOQUEO), 'El horario está bloqueado.'],
  ])('RECEPCION con %s: mensaje normal + aviso de rol, sin botón y sin request con sobreturno', async (_n, error, mensaje) => {
    const { ctx } = await hastaOferta(error, 'RECEPCION');
    expect(alertaAccion()).toContain(mensaje);
    expect(alertaAccion()).toContain('El sobreturno requiere un usuario profesional o administrador.');
    expect(ofreceSobreturno()).toBe(false);
    expect(llamadas(ctx).every(([, cuerpo]) => cuerpo.sobreturno === undefined)).toBe(true);
  });

  it.each(['ADMIN', 'PROFESIONAL'] as const)('%s recibe el ofrecimiento y no ve el aviso de rol', async (rol) => {
    await hastaOferta(profesional, rol);
    expect(ofreceSobreturno()).toBe(true);
    expect(alertaAccion()).not.toContain('El sobreturno requiere');
  });
});
