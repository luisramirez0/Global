/**
 * Pruebas de integración de la página `#/recordatorios` (tareas 4.1 a 4.5 de C-14): se renderiza la página real con
 * sus componentes y dominio reales; solo la API está simulada con los mocks de test-support.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENLACE_WHATSAPP,
  PROBLEM_502,
  RECORDATORIO_EMAIL,
  TURNO_PENDIENTE_CON_ERROR,
  TURNO_PENDIENTE_MALICIOSO,
  TURNO_PENDIENTE_SIN_CONTACTO,
  TURNO_PENDIENTE_SIN_ULTIMO,
} from '../../api/__fixtures__/recordatorios';
import { ApiError, toApiError } from '../../api/errors';
import { TURNO_PROGRAMADO } from '../../api/__fixtures__/turnos';
import type { Rol, Turno, TurnoPendiente } from '../../api/types';
import { createLoggedContext, deferred, flush, type TestContext } from '../../test-support/pages';
import { renderRecordatorios } from './recordatorios';

// Vitest corre en Node: `process.env.TZ` cambia la zona local del proceso en caliente (patrón de C-11 y C-13).
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env['TZ'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-25T14:00:00Z')); // 11:00 del miércoles 25/11 en Argentina
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  sessionStorage.clear();
  localStorage.clear();
  if (ORIGINAL_TZ === undefined) delete env['TZ'];
  else env['TZ'] = ORIGINAL_TZ;
});

const http = (status: number, body?: unknown): ApiError => toApiError(status, new Headers(), body);

/** 10:00 (id 7) y 12:30 (id 8) del 26/11 en Argentina. */
const P1: TurnoPendiente = TURNO_PENDIENTE_SIN_ULTIMO;
const P2: TurnoPendiente = TURNO_PENDIENTE_SIN_CONTACTO;

async function montar(
  pendientes: TurnoPendiente[] = [P1, P2],
  rol: Rol = 'RECEPCION',
): Promise<{ ctx: TestContext; root: HTMLElement; page: ReturnType<typeof renderRecordatorios> }> {
  const ctx = createLoggedContext(rol);
  ctx.recordatorios.pendientes.mockResolvedValue(pendientes);
  const page = renderRecordatorios(ctx);
  document.body.replaceChildren(page.element);
  await flush();
  return { ctx, root: page.element, page };
}

const itemDe = (id: number): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`li[data-turno-id="${id}"]`);
  if (el === null) throw new Error(`sin ítem del turno ${id}`);
  return el;
};
const idsListados = (): string[] => [...document.querySelectorAll<HTMLElement>('li[data-turno-id]')].map((li) => li.dataset['turnoId'] ?? '');
function botonEn(raiz: ParentNode, texto: string): HTMLButtonElement {
  const found = [...raiz.querySelectorAll('button')].filter((b) => b.textContent === texto);
  if (found.length !== 1 || found[0] === undefined) throw new Error(`Se esperaba un botón "${texto}" y hay ${found.length}`);
  return found[0];
}
const selectorFecha = (): HTMLInputElement => {
  const el = document.querySelector<HTMLInputElement>('input[name="fecha"]');
  if (el === null) throw new Error('sin selector de fecha');
  return el;
};
const fechasPedidas = (ctx: TestContext): unknown[] => ctx.recordatorios.pendientes.mock.calls.map((c) => c[0]);

describe('4.1 carga de la página', () => {
  it('pide la fecha de mañana en la zona del consultorio aunque el proceso esté en Asia/Tokyo', async () => {
    env['TZ'] = 'Asia/Tokyo';
    const { ctx } = await montar();
    expect(fechasPedidas(ctx)).toEqual(['2026-11-26']);
    expect(selectorFecha().value).toBe('2026-11-26');
  });

  it.each([
    ['2026-11-26T02:30:00Z', '2026-11-26'], // 25/11 23:30 en Argentina
    ['2026-11-25T02:59:00Z', '2026-11-25'], // 24/11 23:59 en Argentina
    ['2026-11-25T03:00:00Z', '2026-11-26'], // 25/11 00:00 en Argentina
  ])('con el reloj en %s pide %s', async (ahora, esperada) => {
    vi.setSystemTime(new Date(ahora));
    const { ctx } = await montar();
    expect(fechasPedidas(ctx)).toEqual([esperada]);
    expect(selectorFecha().value).toBe(esperada);
  });

  it('lista ordenada por inicio con hora, "Apellido, Nombre", profesional y estado', async () => {
    const { root } = await montar([P2, P1]);
    expect(idsListados()).toEqual(['7', '8']);
    const primero = itemDe(7).textContent ?? '';
    expect(primero).toContain('10:00');
    expect(primero).toContain('Pérez, Ana');
    expect(primero).toContain('Ríos, Marta');
    expect(primero).toContain('Programado');
    const segundo = itemDe(8).textContent ?? '';
    expect(segundo).toContain('12:30');
    expect(segundo).toContain('Gómez, Luis');
    expect(segundo).toContain('Confirmado');
    expect(root.querySelector('ul')).not.toBeNull();
  });

  it('lista vacía: mensaje fijo y ninguna lista', async () => {
    const { root } = await montar([]);
    expect(root.textContent).toContain('No hay turnos pendientes de recordatorio para esta fecha.');
    expect(idsListados()).toEqual([]);
  });

  it('error de red: role="alert" con "Reintentar", sin lista vacía; Reintentar vuelve a pedir', async () => {
    const ctx = createLoggedContext('RECEPCION');
    ctx.recordatorios.pendientes.mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce([P1]);
    const page = renderRecordatorios(ctx);
    document.body.replaceChildren(page.element);
    await flush();
    const alerta = page.element.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('No se pudo conectar con el servidor.');
    expect(page.element.textContent).not.toContain('No hay turnos pendientes');
    botonEn(page.element, 'Reintentar').click();
    await flush();
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(2);
    expect(idsListados()).toEqual(['7']);
    expect(page.element.querySelector('.error-carga')).toBeNull();
  });

  it('un error 403 al cargar muestra el mensaje de falta de permiso', async () => {
    const ctx = createLoggedContext('RECEPCION');
    ctx.recordatorios.pendientes.mockRejectedValue(http(403));
    const page = renderRecordatorios(ctx);
    document.body.replaceChildren(page.element);
    await flush();
    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('No tenés permiso para realizar esta acción.');
  });

  it('último envío por email fallido: texto fijo; sin intento previo no hay aviso', async () => {
    await montar([TURNO_PENDIENTE_CON_ERROR, P1]);
    expect(itemDe(9).textContent).toContain('El último envío por email falló.');
    expect(itemDe(7).textContent).not.toContain('falló');
  });

  it('tiene un h1 "Recordatorios" enfocable y título de página', async () => {
    const { root, page } = await montar();
    const h1 = root.querySelector('h1');
    expect(h1?.textContent).toBe('Recordatorios');
    expect(h1?.getAttribute('tabindex')).toBe('-1');
    expect(page.title).toBe('Recordatorios');
  });

  it('el botón "WhatsApp" tiene un nombre accesible con la hora y "Apellido, Nombre"', async () => {
    await montar();
    const nombre = [...itemDe(7).querySelectorAll('button')].find((b) => b.textContent === 'WhatsApp')?.getAttribute('aria-label') ?? '';
    expect(nombre).toContain('10:00');
    expect(nombre).toContain('Pérez, Ana');
    const email = [...itemDe(8).querySelectorAll('button')].find((b) => b.textContent === 'Email')?.getAttribute('aria-label') ?? '';
    expect(email).toContain('12:30');
    expect(email).toContain('Gómez, Luis');
  });

  it('montar no llama a enlaceWhatsApp ni a enviarEmail', async () => {
    const { ctx } = await montar();
    expect(ctx.recordatorios.enlaceWhatsApp).not.toHaveBeenCalled();
    expect(ctx.recordatorios.enviarEmail).not.toHaveBeenCalled();
  });

  it('mientras carga muestra "Cargando…" en una región de estado', async () => {
    const ctx = createLoggedContext('RECEPCION');
    const pendiente = deferred<TurnoPendiente[]>();
    ctx.recordatorios.pendientes.mockReturnValue(pendiente.promise);
    const page = renderRecordatorios(ctx);
    document.body.replaceChildren(page.element);
    await flush();
    expect(page.element.querySelector('.cargando')?.textContent).toBe('Cargando…');
    expect(page.element.querySelector('.cargando')?.getAttribute('role')).toBe('status');
    pendiente.resolve([P1]);
    await flush();
    expect(page.element.textContent).not.toContain('Cargando…');
  });
});


function cambiarFecha(valor: string): void {
  selectorFecha().value = valor;
  selectorFecha().dispatchEvent(new Event('change', { bubbles: true }));
}
const errorFecha = (): string => {
  const id = selectorFecha().getAttribute('aria-describedby');
  return id === null ? '' : (document.getElementById(id)?.textContent ?? '');
};

describe('4.2 selector de fecha', () => {
  it('cambiar a 2026-11-27 pide esa fecha y muestra sus turnos', async () => {
    const { ctx } = await montar([P1]);
    ctx.recordatorios.pendientes.mockResolvedValue([P2]);
    cambiarFecha('2026-11-27');
    await flush();
    expect(fechasPedidas(ctx)).toEqual(['2026-11-26', '2026-11-27']);
    expect(idsListados()).toEqual(['8']);
  });

  it('otra fecha distinta (2026-12-01) también se pide tal cual', async () => {
    const { ctx } = await montar([]);
    cambiarFecha('2026-12-01');
    await flush();
    expect(fechasPedidas(ctx)).toEqual(['2026-11-26', '2026-12-01']);
  });

  it.each(['', '2026-13-45', '2026-02-30', 'no-es-fecha'])('la fecha %j marca error en el campo y no pide', async (valor) => {
    const { ctx } = await montar([P1]);
    cambiarFecha(valor);
    await flush();
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(1);
    expect(errorFecha()).toBe('Ingresá una fecha válida.');
    expect(selectorFecha().getAttribute('aria-invalid')).toBe('true');
  });

  it('volver a una fecha válida limpia el error y pide', async () => {
    const { ctx } = await montar([P1]);
    cambiarFecha('');
    cambiarFecha('2026-11-27');
    await flush();
    expect(errorFecha()).toBe('');
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(2);
  });

  it('"Actualizar" vuelve a pedir la fecha elegida', async () => {
    const { ctx, root } = await montar([P1]);
    cambiarFecha('2026-11-27');
    await flush();
    botonEn(root.querySelector('.filtro-fecha') ?? root, 'Actualizar').click();
    await flush();
    expect(fechasPedidas(ctx)).toEqual(['2026-11-26', '2026-11-27', '2026-11-27']);
  });

  it('respuesta tardía del 26 tras la del 27: se muestra solo el 27', async () => {
    const ctx = createLoggedContext('RECEPCION');
    const del26 = deferred<TurnoPendiente[]>();
    const del27 = deferred<TurnoPendiente[]>();
    ctx.recordatorios.pendientes.mockReturnValueOnce(del26.promise).mockReturnValueOnce(del27.promise);
    const page = renderRecordatorios(ctx);
    document.body.replaceChildren(page.element);
    await flush();
    cambiarFecha('2026-11-27');
    await flush();
    del27.resolve([P2]);
    await flush();
    del26.resolve([P1]);
    await flush();
    expect(idsListados()).toEqual(['8']);
  });

  it('un error tardío del pedido anterior tampoco pisa la lista nueva', async () => {
    const ctx = createLoggedContext('RECEPCION');
    const viejo = deferred<TurnoPendiente[]>();
    ctx.recordatorios.pendientes.mockReturnValueOnce(viejo.promise).mockResolvedValueOnce([P2]);
    const page = renderRecordatorios(ctx);
    document.body.replaceChildren(page.element);
    await flush();
    cambiarFecha('2026-11-27');
    await flush();
    viejo.reject(new ApiError('network'));
    await flush();
    expect(idsListados()).toEqual(['8']);
    expect(page.element.querySelector('.error-carga')).toBeNull();
  });
});

const botonItem = (id: number, texto: string): HTMLButtonElement => {
  const found = [...itemDe(id).querySelectorAll('button')].filter((b) => b.textContent === texto);
  if (found.length !== 1 || found[0] === undefined) throw new Error(`Se esperaba un botón "${texto}" en el turno ${id} y hay ${found.length}`);
  return found[0];
};
const barraFecha = (): HTMLElement => document.querySelector<HTMLElement>('.filtro-fecha') ?? document.body;
const avisoDe = (b: HTMLElement): string =>
  (b.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((i) => i !== '')
    .map((i) => document.getElementById(i)?.textContent ?? '')
    .join(' ');

describe('4.3 recordatorio dentro de la lista', () => {
  it('tras generar el enlace el ítem sigue y dice "Recordatorio por WhatsApp generado." sin recargar la lista', async () => {
    const { ctx } = await montar([P1, P2]);
    ctx.recordatorios.enlaceWhatsApp.mockResolvedValue(ENLACE_WHATSAPP);
    botonItem(7, 'WhatsApp').click();
    await flush();
    expect(itemDe(7).textContent).toContain('Recordatorio por WhatsApp generado.');
    expect(itemDe(8).textContent).not.toContain('Recordatorio por WhatsApp generado.');
    expect(idsListados()).toEqual(['7', '8']);
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(1);
  });

  it('tras enviar el email el ítem dice "Recordatorio enviado por email." sin recargar la lista', async () => {
    const { ctx } = await montar([P1, P2]);
    ctx.recordatorios.enviarEmail.mockResolvedValue(RECORDATORIO_EMAIL);
    botonItem(7, 'Email').click();
    await flush();
    expect(itemDe(7).textContent).toContain('Recordatorio enviado por email.');
    expect(itemDe(8).textContent).not.toContain('Recordatorio enviado por email.');
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(1);
  });

  it('"Actualizar" vuelve a pedir la lista y el backend ya no devuelve el turno recordado', async () => {
    const { ctx } = await montar([P1, P2]);
    ctx.recordatorios.enviarEmail.mockResolvedValue(RECORDATORIO_EMAIL);
    botonItem(7, 'Email').click();
    await flush();
    ctx.recordatorios.pendientes.mockResolvedValue([P2]);
    botonEn(barraFecha(), 'Actualizar').click();
    await flush();
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(2);
    expect(idsListados()).toEqual(['8']);
  });

  it('email 500: tras Actualizar y tras cambiar de fecha ida y vuelta, el turno 7 sigue con "Email" bloqueado', async () => {
    const { ctx } = await montar([P1, P2]);
    ctx.recordatorios.enviarEmail.mockRejectedValue(http(500));
    botonItem(7, 'Email').click();
    await flush();
    expect(botonItem(7, 'Email').disabled).toBe(true);
    botonEn(barraFecha(), 'Actualizar').click();
    await flush();
    const aviso = 'Envío por email sin confirmar: verificá con el paciente.';
    expect(botonItem(7, 'Email').disabled).toBe(true);
    expect(avisoDe(botonItem(7, 'Email'))).toBe(aviso);
    expect(botonItem(7, 'WhatsApp').disabled).toBe(false);
    cambiarFecha('2026-11-27');
    await flush();
    cambiarFecha('2026-11-26');
    await flush();
    expect(botonItem(7, 'Email').disabled).toBe(true);
    expect(avisoDe(botonItem(7, 'Email'))).toBe(aviso);
    // El turno 8 no se ve afectado.
    expect(itemDe(8).textContent).not.toContain('sin confirmar');
  });

  it('email 502: tras Actualizar el "Email" vuelve habilitado', async () => {
    const { ctx } = await montar([P1]);
    ctx.recordatorios.enviarEmail.mockRejectedValue(http(502, PROBLEM_502));
    botonItem(7, 'Email').click();
    await flush();
    expect(itemDe(7).textContent).toContain('No se pudo enviar el email. Probá más tarde o usá WhatsApp.');
    botonEn(barraFecha(), 'Actualizar').click();
    await flush();
    expect(botonItem(7, 'Email').disabled).toBe(false);
    expect(itemDe(7).textContent).not.toContain('No se pudo enviar el email');
  });

  it('409 en un recordatorio ofrece "Actualizar" en el ítem y recién al pulsarlo se vuelve a pedir la lista', async () => {
    const { ctx } = await montar([P1]);
    ctx.recordatorios.enlaceWhatsApp.mockRejectedValue(http(409));
    botonItem(7, 'WhatsApp').click();
    await flush();
    expect(itemDe(7).textContent).toContain('El turno ya no admite recordatorios (cambió de estado).');
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(1);
    botonItem(7, 'Actualizar').click();
    await flush();
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(2);
  });
});

const turnoCon = (id: number, estado: Turno['estado']): Turno => ({ ...TURNO_PROGRAMADO, id, estado });
const anuncioPagina = (): string => document.querySelector('.anuncio-pagina')?.textContent ?? '';
const dialogo = (): HTMLDialogElement | null => document.querySelector('dialog');
const motivo = (): HTMLTextAreaElement => {
  const e = dialogo()?.querySelector<HTMLTextAreaElement>('[name="motivoCancelacion"]');
  if (e === null || e === undefined) throw new Error('sin campo motivo');
  return e;
};
const escribirMotivo = (texto: string): void => {
  motivo().value = texto;
  motivo().dispatchEvent(new Event('input', { bubbles: true }));
};
const botonDialogo = (texto: string): HTMLButtonElement => botonEn(dialogo() ?? document.body, texto);
const errorMotivo = (): string => {
  const id = motivo().getAttribute('aria-describedby');
  return id === null ? '' : (document.getElementById(id)?.textContent ?? '');
};
const textosBotonesItem = (id: number): string[] => [...itemDe(id).querySelectorAll('button')].map((b) => b.textContent ?? '');

describe('4.4 confirmar o cancelar según la respuesta del paciente', () => {
  it('"Confirmar" solo aparece en PROGRAMADO; "Cancelar" en PROGRAMADO y CONFIRMADO', async () => {
    await montar([P1, P2]);
    expect(textosBotonesItem(7)).toEqual(['WhatsApp', 'Email', 'Confirmar', 'Cancelar']);
    expect(textosBotonesItem(8)).toEqual(['WhatsApp', 'Email', 'Cancelar']);
  });

  it('Confirmar envía CONFIRMADO, anuncia, muestra "Confirmado" y quita "Confirmar"', async () => {
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockResolvedValue(turnoCon(7, 'CONFIRMADO'));
    botonItem(7, 'Confirmar').click();
    await flush();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledWith(7, { estado: 'CONFIRMADO' });
    expect(anuncioPagina()).toBe('Turno confirmado.');
    expect(itemDe(7).textContent).toContain('Confirmado');
    expect(itemDe(7).textContent).not.toContain('Programado');
    expect(textosBotonesItem(7)).toEqual(['WhatsApp', 'Email', 'Cancelar']);
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(1);
  });

  it('doble clic en Confirmar: un solo pedido', async () => {
    const pedido = deferred<Turno>();
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockReturnValue(pedido.promise);
    const b = botonItem(7, 'Confirmar');
    b.click();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledTimes(1);
    pedido.resolve(turnoCon(7, 'CONFIRMADO'));
    await flush();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledTimes(1);
  });

  it.each([7, 8] as const)('Cancelar en el turno %s (7 PROGRAMADO, 8 CONFIRMADO): diálogo accesible con motivo y envío válido', async (id) => {
    const { ctx } = await montar([P1, P2]);
    ctx.turnos.cambiarEstado.mockResolvedValue(turnoCon(id, 'CANCELADO'));
    botonItem(id, 'Cancelar').click();
    const d = dialogo();
    expect(d).not.toBeNull();
    const titulo = document.getElementById(d?.getAttribute('aria-labelledby') ?? '');
    expect(titulo?.textContent).toBe('Cancelar turno');
    expect(d?.querySelector('label')?.textContent).toBe('Motivo de la cancelación');
    escribirMotivo('  No puede venir  ');
    botonDialogo('Confirmar cancelación').click();
    await flush();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledWith(id, { estado: 'CANCELADO', motivoCancelacion: 'No puede venir' });
    expect(anuncioPagina()).toBe('Turno cancelado.');
    expect(dialogo()).toBeNull();
    expect(itemDe(id).textContent).toContain('Cancelado');
    expect(textosBotonesItem(id)).toEqual([]);
  });

  it('motivo vacío o solo espacios: error en el campo y ninguna request', async () => {
    const { ctx } = await montar([P1]);
    botonItem(7, 'Cancelar').click();
    botonDialogo('Confirmar cancelación').click();
    expect(errorMotivo()).toBe('Indicá el motivo de la cancelación.');
    escribirMotivo('   ');
    botonDialogo('Confirmar cancelación').click();
    expect(errorMotivo()).toBe('Indicá el motivo de la cancelación.');
    expect(ctx.turnos.cambiarEstado).not.toHaveBeenCalled();
  });

  it('el límite es en bytes UTF-8: 127 "ñ" (254 bytes) pasa y 128 (256 bytes) no', async () => {
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockResolvedValue(turnoCon(7, 'CANCELADO'));
    botonItem(7, 'Cancelar').click();
    escribirMotivo('ñ'.repeat(128));
    botonDialogo('Confirmar cancelación').click();
    expect(errorMotivo()).toContain('demasiado largo');
    expect(ctx.turnos.cambiarEstado).not.toHaveBeenCalled();
    escribirMotivo('ñ'.repeat(127));
    botonDialogo('Confirmar cancelación').click();
    await flush();
    expect(ctx.turnos.cambiarEstado).toHaveBeenCalledTimes(1);
  });

  it('"Cerrar" cancela el diálogo sin pedir y deja el turno intacto', async () => {
    const { ctx } = await montar([P1]);
    botonItem(7, 'Cancelar').click();
    botonDialogo('Cerrar').click();
    expect(dialogo()).toBeNull();
    expect(ctx.turnos.cambiarEstado).not.toHaveBeenCalled();
    expect(textosBotonesItem(7)).toContain('Cancelar');
  });

  it('409 al confirmar: mensaje fijo y "Actualizar" en el ítem, sin recargar la lista sola', async () => {
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockRejectedValue(http(409, { title: 'Texto del servidor' }));
    botonItem(7, 'Confirmar').click();
    await flush();
    expect(itemDe(7).textContent).toContain('No se pudo completar la acción. Es posible que el turno haya cambiado.');
    expect(itemDe(7).textContent).not.toContain('Texto del servidor');
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(1);
    botonItem(7, 'Actualizar').click();
    await flush();
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(2);
  });

  it('409 al cancelar: el diálogo queda abierto con el mensaje fijo y "Actualizar" recarga y lo cierra', async () => {
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockRejectedValue(http(409));
    botonItem(7, 'Cancelar').click();
    escribirMotivo('No viene');
    botonDialogo('Confirmar cancelación').click();
    await flush();
    expect(dialogo()?.textContent).toContain('No se pudo completar la acción. Es posible que el turno haya cambiado.');
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(1);
    botonDialogo('Actualizar').click();
    await flush();
    expect(dialogo()).toBeNull();
    expect(ctx.recordatorios.pendientes).toHaveBeenCalledTimes(2);
  });

  it('error de red al confirmar: mensaje de conexión y el botón sigue disponible', async () => {
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(turnoCon(7, 'CONFIRMADO'));
    botonItem(7, 'Confirmar').click();
    await flush();
    expect(itemDe(7).textContent).toContain('No se pudo conectar con el servidor.');
    botonItem(7, 'Confirmar').click();
    await flush();
    expect(anuncioPagina()).toBe('Turno confirmado.');
  });
});

describe('4.5 roles y contenido seguro', () => {
  it.each(['ADMIN', 'PROFESIONAL', 'RECEPCION'] as const)('el rol %s ve WhatsApp, Email, Confirmar y Cancelar', async (rol) => {
    await montar([P1], rol);
    expect(textosBotonesItem(7)).toEqual(['WhatsApp', 'Email', 'Confirmar', 'Cancelar']);
    for (const b of itemDe(7).querySelectorAll('button')) expect(b.disabled).toBe(false);
  });

  it('403 al pedir el enlace, al enviar el email y al confirmar muestra el mensaje fijo de falta de permiso', async () => {
    const { ctx } = await montar([P1, P2]);
    ctx.recordatorios.enlaceWhatsApp.mockRejectedValue(http(403, { title: 'Texto del servidor' }));
    ctx.recordatorios.enviarEmail.mockRejectedValue(http(403));
    ctx.turnos.cambiarEstado.mockRejectedValue(http(403));
    botonItem(7, 'WhatsApp').click();
    await flush();
    expect(itemDe(7).textContent).toContain('No tenés permiso para realizar esta acción.');
    expect(itemDe(7).textContent).not.toContain('Texto del servidor');
    botonItem(7, 'Email').click();
    await flush();
    expect(itemDe(7).textContent).toContain('No tenés permiso para realizar esta acción.');
    expect(itemDe(8).textContent).not.toContain('No tenés permiso');
    botonItem(7, 'Confirmar').click();
    await flush();
    const alertas = [...itemDe(7).querySelectorAll('[role="alert"]')].map((a) => a.textContent ?? '');
    expect(alertas.filter((t) => t.includes('No tenés permiso para realizar esta acción.'))).toHaveLength(2);
  });

  it('paciente y profesional con nombres maliciosos se muestran como texto literal, sin nodos img ni b', async () => {
    await montar([TURNO_PENDIENTE_MALICIOSO]);
    const texto = itemDe(10).textContent ?? '';
    expect(texto).toContain('<b>Malo</b>, <img src=x onerror=alert(1)>');
    expect(texto).toContain('<img src=y onerror=alert(2)>');
    expect(document.querySelector('img')).toBeNull();
    expect(itemDe(10).querySelector('b')).toBeNull();
    const nombre = [...itemDe(10).querySelectorAll('button')].find((b) => b.textContent === 'WhatsApp')?.getAttribute('aria-label') ?? '';
    expect(nombre).toContain('<img src=x onerror=alert(1)>');
  });

  it('el enlace y los nombres no llegan a la consola ni al almacenamiento al generar un enlace y fallar un email', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const { ctx } = await montar([TURNO_PENDIENTE_MALICIOSO]);
    ctx.recordatorios.enlaceWhatsApp.mockResolvedValue(ENLACE_WHATSAPP);
    ctx.recordatorios.enviarEmail.mockRejectedValue(http(500));
    botonItem(10, 'WhatsApp').click();
    await flush();
    botonItem(10, 'Email').click();
    await flush();
    for (const espia of espias) expect(espia).not.toHaveBeenCalled();
    // La sesión vive en sessionStorage (C-03); lo que no puede aparecer es el enlace, los nombres ni el registro.
    const guardado = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    for (const prohibido of ['wa.me', 'onerror', 'Malo', 'sinConfirmar', 'enviosSinConfirmar']) expect(guardado).not.toContain(prohibido);
    expect(localStorage.length).toBe(0);
    expect(location.hash).not.toContain('wa.me');
    expect(ctx.enviosSinConfirmar.tiene(10)).toBe(true);
  });
});

describe('4.3 (C-14 ajuste) email enviado sobrevive a Actualizar', () => {
  it('tras un 201, Actualizar con el turno devuelto otra vez como pendiente deja "Email" deshabilitado con "Recordatorio enviado por email."', async () => {
    const { ctx } = await montar([P1, P2]);
    ctx.recordatorios.enviarEmail.mockResolvedValue(RECORDATORIO_EMAIL);
    botonItem(7, 'Email').click();
    await flush();
    botonEn(barraFecha(), 'Actualizar').click();
    await flush();
    expect(botonItem(7, 'Email').disabled).toBe(true);
    expect(avisoDe(botonItem(7, 'Email'))).toBe('Recordatorio enviado por email.');
    expect(botonItem(7, 'WhatsApp').disabled).toBe(false);
    expect(ctx.recordatorios.enviarEmail).toHaveBeenCalledTimes(1);
  });

  it('también tras cambiar de fecha ida y vuelta; el otro turno no se ve afectado', async () => {
    const { ctx } = await montar([P1, TURNO_PENDIENTE_CON_ERROR]);
    ctx.recordatorios.enviarEmail.mockResolvedValue(RECORDATORIO_EMAIL);
    botonItem(7, 'Email').click();
    await flush();
    cambiarFecha('2026-11-27');
    await flush();
    cambiarFecha('2026-11-26');
    await flush();
    expect(botonItem(7, 'Email').disabled).toBe(true);
    expect(botonItem(9, 'Email').disabled).toBe(false);
  });

  it('un 502 no deja marca: tras Actualizar "Email" vuelve habilitado y el 2xx ilegible sí bloquea con el aviso de sin confirmar', async () => {
    const { ctx } = await montar([P1, TURNO_PENDIENTE_CON_ERROR]);
    ctx.recordatorios.enviarEmail.mockRejectedValueOnce(http(502, PROBLEM_502)).mockRejectedValueOnce(new ApiError('unexpected', { status: 201 }));
    botonItem(7, 'Email').click();
    await flush();
    botonItem(9, 'Email').click();
    await flush();
    botonEn(barraFecha(), 'Actualizar').click();
    await flush();
    expect(botonItem(7, 'Email').disabled).toBe(false);
    expect(botonItem(9, 'Email').disabled).toBe(true);
    expect(avisoDe(botonItem(9, 'Email'))).toBe('Envío por email sin confirmar: verificá con el paciente.');
  });
});

/** Como un navegador real: un botón enfocado que se deshabilita pierde el foco (jsdom no lo hace). */
function blurAlDeshabilitar(b: HTMLButtonElement): void {
  const desc = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');
  if (desc?.get === undefined || desc.set === undefined) throw new Error('sin descriptor');
  const { get, set } = desc;
  Object.defineProperty(b, 'disabled', {
    configurable: true,
    get: () => get.call(b) as boolean,
    set: (v: boolean) => {
      if (v && document.activeElement === b) b.blur();
      set.call(b, v);
    },
  });
}

describe('M1 (revisión) envío de email en curso compartido entre ítems reconstruidos', () => {
  it('Actualizar durante el pedido: el ítem nuevo nace con "Email" deshabilitado y ocupado y no se envía otro email', async () => {
    const pedido = deferred<typeof RECORDATORIO_EMAIL>();
    const { ctx } = await montar([P1]);
    ctx.recordatorios.enviarEmail.mockReturnValue(pedido.promise);
    botonItem(7, 'Email').click();
    await flush();
    botonEn(barraFecha(), 'Actualizar').click();
    await flush();
    const nuevo = botonItem(7, 'Email');
    expect(nuevo.disabled).toBe(true);
    expect(nuevo.getAttribute('aria-busy')).toBe('true');
    expect(avisoDe(nuevo)).toBe('Enviando email…');
    nuevo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(ctx.recordatorios.enviarEmail).toHaveBeenCalledTimes(1);
    pedido.resolve(RECORDATORIO_EMAIL);
    await flush();
    // En la próxima renderización el estado final (enviado) se refleja.
    botonEn(barraFecha(), 'Actualizar').click();
    await flush();
    expect(avisoDe(botonItem(7, 'Email'))).toBe('Recordatorio enviado por email.');
  });

  it('cambiar de fecha durante el pedido (y volver) tampoco permite un segundo envío', async () => {
    const pedido = deferred<typeof RECORDATORIO_EMAIL>();
    const { ctx } = await montar([P1]);
    ctx.recordatorios.enviarEmail.mockReturnValue(pedido.promise);
    botonItem(7, 'Email').click();
    await flush();
    cambiarFecha('2026-11-27');
    await flush();
    cambiarFecha('2026-11-26');
    await flush();
    expect(botonItem(7, 'Email').disabled).toBe(true);
    botonItem(7, 'Email').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(ctx.recordatorios.enviarEmail).toHaveBeenCalledTimes(1);
  });

  it('un 502 libera el envío en curso: tras la próxima renderización se puede reintentar', async () => {
    const pedido = deferred<typeof RECORDATORIO_EMAIL>();
    const { ctx } = await montar([P1]);
    ctx.recordatorios.enviarEmail.mockReturnValueOnce(pedido.promise).mockResolvedValueOnce(RECORDATORIO_EMAIL);
    botonItem(7, 'Email').click();
    await flush();
    pedido.reject(http(502, PROBLEM_502));
    await flush();
    expect(ctx.enviosSinConfirmar.enCurso(7)).toBe(false);
    botonEn(barraFecha(), 'Actualizar').click();
    await flush();
    expect(botonItem(7, 'Email').disabled).toBe(false);
    botonItem(7, 'Email').click();
    await flush();
    expect(ctx.recordatorios.enviarEmail).toHaveBeenCalledTimes(2);
  });
});

describe('B2 (revisión) foco tras un fallo de confirmar o de cancelar', () => {
  it.each([
    ['network', () => new ApiError('network')],
    ['409', () => http(409)],
  ])('Confirmar con %s: el foco vuelve al botón "Confirmar" re-habilitado', async (_n, crear) => {
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockRejectedValue(crear());
    const b = botonItem(7, 'Confirmar');
    blurAlDeshabilitar(b);
    b.focus();
    b.click();
    await flush();
    expect(b.disabled).toBe(false);
    expect(document.activeElement).toBe(b);
  });

  it('Confirmar sin foco previo en el botón no roba el foco', async () => {
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockRejectedValue(new ApiError('network'));
    const otro = botonItem(7, 'Cancelar');
    otro.focus();
    botonItem(7, 'Confirmar').click();
    await flush();
    expect(document.activeElement).toBe(otro);
  });

  it('cancelar con un error de red: el foco queda dentro del diálogo, en el botón de confirmar', async () => {
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockRejectedValue(new ApiError('network'));
    botonItem(7, 'Cancelar').click();
    escribirMotivo('No viene');
    const enviar = botonDialogo('Confirmar cancelación');
    blurAlDeshabilitar(enviar);
    enviar.focus();
    enviar.click();
    await flush();
    expect(dialogo()?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(enviar);
  });

  it('cancelar con 409: el foco pasa a "Actualizar" dentro del diálogo', async () => {
    const { ctx } = await montar([P1]);
    ctx.turnos.cambiarEstado.mockRejectedValue(http(409));
    botonItem(7, 'Cancelar').click();
    escribirMotivo('No viene');
    const enviar = botonDialogo('Confirmar cancelación');
    blurAlDeshabilitar(enviar);
    enviar.focus();
    enviar.click();
    await flush();
    expect(document.activeElement).toBe(botonDialogo('Actualizar'));
  });
});
