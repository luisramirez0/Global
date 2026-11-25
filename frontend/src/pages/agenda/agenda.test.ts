import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOQUEO_SILLON, HORARIO_LUNES, SILLON_1, SILLON_2, SILLON_INACTIVO } from '../../api/__fixtures__/agendaConfig';
import {
  TURNO_CANCELADO,
  TURNO_CONFIRMADO,
  TURNO_MALICIOSO,
  TURNO_NOCTURNO,
  TURNO_PROGRAMADO,
  TURNO_SILLON_INACTIVO,
  TURNO_SOBRETURNO,
} from '../../api/__fixtures__/turnos';
import { ApiError } from '../../api/errors';
import type { Horario, Turno } from '../../api/types';
import { bloqueDe, boton, dialogo, montarAgenda } from '../../test-support/agenda';
import { createLoggedContext, deferred, flush } from '../../test-support/pages';

// Vitest corre en Node: `process.env.TZ` cambia la zona local del proceso en caliente (patrón de C-11).
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env['TZ'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-24T15:00:00Z')); // martes 24/11, 12:00 en Argentina
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  sessionStorage.clear();
  if (ORIGINAL_TZ === undefined) delete env['TZ'];
  else env['TZ'] = ORIGINAL_TZ;
});

const ctxAdmin = () => createLoggedContext('ADMIN');
const titulos = (): string[] => [...document.querySelectorAll('.grilla-titulo')].map((t) => t.textContent ?? '');
const bloquesIds = (): string[] => [...document.querySelectorAll<HTMLElement>('.grilla [data-turno-id]')].map((b) => b.dataset['turnoId'] ?? '');
const rango = (): string => document.querySelector('.rango-visible')?.textContent ?? '';
const listarArgs = (ctx: ReturnType<typeof ctxAdmin>, i = 0): unknown => ctx.turnos.listar.mock.calls[i]?.[0];
const T2: Turno = { ...TURNO_PROGRAMADO, id: 200, sillonId: 2, inicio: '2026-11-24T14:00:00Z', fin: '2026-11-24T14:30:00Z' };

describe('4.1 carga inicial', () => {
  it('muestra "Cargando…" con aria-busy mientras responde y luego la grilla', async () => {
    const ctx = ctxAdmin();
    const pendiente = deferred<Turno[]>();
    const { configurarAgenda } = await import('../../test-support/agenda');
    configurarAgenda(ctx);
    ctx.turnos.listar.mockReturnValue(pendiente.promise);
    const { renderAgenda } = await import('./agenda');
    const page = renderAgenda(ctx);
    document.body.replaceChildren(page.element);
    await flush();
    expect(page.element.textContent).toContain('Cargando…');
    expect(page.element.getAttribute('aria-busy')).toBe('true');
    pendiente.resolve([TURNO_PROGRAMADO]);
    await flush();
    expect(page.element.textContent).not.toContain('Cargando…');
    expect(page.element.hasAttribute('aria-busy')).toBe(false);
    expect(bloquesIds()).toEqual(['100']);
  });

  it('tiene h1 "Agenda" y título de página', async () => {
    const { page, root } = await montarAgenda(ctxAdmin());
    expect(page.title).toBe('Agenda');
    expect(root.querySelector('h1')?.textContent).toBe('Agenda');
  });

  it('pide el día de hoy en la zona del consultorio y la config una sola vez', async () => {
    const ctx = ctxAdmin();
    await montarAgenda(ctx);
    expect(listarArgs(ctx)).toEqual({ desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' });
    expect(ctx.agenda.listarSillones).toHaveBeenCalledWith(true);
    expect(ctx.agenda.listarPrestaciones).toHaveBeenCalledWith(false);
    expect(ctx.agenda.listarHorarios).toHaveBeenCalledTimes(1);
    expect(ctx.agenda.listarBloqueos).toHaveBeenCalledWith({ desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' });
    expect(rango()).toBe('martes 24/11/2026');
  });

  it('hoy cerca de medianoche: 23:30 en Argentina sigue siendo el 24/11', async () => {
    vi.setSystemTime(new Date('2026-11-25T02:30:00Z'));
    const ctx = ctxAdmin();
    await montarAgenda(ctx);
    expect(rango()).toBe('martes 24/11/2026');
    expect(listarArgs(ctx)).toEqual({ desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' });
  });

  it('vista diaria: una columna por sillón activo con su turno', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_PROGRAMADO, T2] });
    expect(titulos()).toEqual(['Sillón 1', 'Sillón 2']);
    expect(bloquesIds()).toEqual(['100', '200']);
  });

  it('rango sin turnos: grilla vacía y aviso "No hay turnos en este rango."', async () => {
    const { root } = await montarAgenda(ctxAdmin(), { turnos: [] });
    expect(root.textContent).toContain('No hay turnos en este rango.');
    expect(titulos()).toEqual(['Sillón 1', 'Sillón 2']);
  });

  it('un turno nocturno (01:30Z) se muestra el 24/11 a las 22:30', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_NOCTURNO] });
    expect(bloqueDe(106).textContent).toContain('22:30–23:00');
  });

  it('error de red al cargar: mensaje fijo y "Reintentar" repite el mismo rango', async () => {
    const ctx = ctxAdmin();
    const { configurarAgenda } = await import('../../test-support/agenda');
    configurarAgenda(ctx);
    ctx.turnos.listar.mockRejectedValueOnce(new ApiError('network'));
    const { renderAgenda } = await import('./agenda');
    const page = renderAgenda(ctx);
    document.body.replaceChildren(page.element);
    await flush();
    expect(page.element.querySelector('[role="alert"]')?.textContent).toContain('No se pudo conectar con el servidor.');
    ctx.turnos.listar.mockResolvedValue([TURNO_PROGRAMADO]);
    boton('Reintentar').click();
    await flush();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
    expect(listarArgs(ctx, 1)).toEqual(listarArgs(ctx, 0));
    expect(bloquesIds()).toEqual(['100']);
    expect(page.element.querySelector('[role="alert"]')?.textContent ?? '').toBe('');
  });

  it('el error nunca muestra el title ni el detail del servidor', async () => {
    const ctx = ctxAdmin();
    const { configurarAgenda } = await import('../../test-support/agenda');
    configurarAgenda(ctx);
    ctx.turnos.listar.mockRejectedValue(new ApiError('server', { status: 500, title: 'TITULO-INTERNO' }));
    const { renderAgenda } = await import('./agenda');
    const page = renderAgenda(ctx);
    document.body.replaceChildren(page.element);
    await flush();
    expect(document.body.textContent).not.toContain('TITULO-INTERNO');
    expect(boton('Reintentar')).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('4.2 vistas y navegación', () => {
  it('"Día" y "Semana" con aria-pressed; Semana pide la semana lunes a lunes y muestra siete columnas', async () => {
    vi.setSystemTime(new Date('2026-11-25T15:00:00Z')); // miércoles
    const ctx = ctxAdmin();
    await montarAgenda(ctx);
    expect(boton('Día').getAttribute('aria-pressed')).toBe('true');
    boton('Semana').click();
    await flush();
    expect(boton('Semana').getAttribute('aria-pressed')).toBe('true');
    expect(boton('Día').getAttribute('aria-pressed')).toBe('false');
    expect(listarArgs(ctx, 1)).toEqual({ desde: '2026-11-23T03:00:00Z', hasta: '2026-11-30T03:00:00Z' });
    expect(titulos()).toHaveLength(7);
    expect(titulos()[0]).toBe('lunes 23/11');
    expect(titulos()[6]).toBe('domingo 29/11');
    expect(rango()).toBe('Semana del 23/11/2026 al 29/11/2026');
  });

  it('"Siguiente" mueve un día y pide ese día; "Anterior" vuelve; "Hoy" regresa a hoy', async () => {
    const ctx = ctxAdmin();
    await montarAgenda(ctx);
    boton('Siguiente').click();
    await flush();
    expect(rango()).toBe('miércoles 25/11/2026');
    expect(listarArgs(ctx, 1)).toEqual({ desde: '2026-11-25T03:00:00Z', hasta: '2026-11-26T03:00:00Z' });
    boton('Anterior').click();
    boton('Anterior').click();
    await flush();
    expect(rango()).toBe('lunes 23/11/2026');
    boton('Hoy').click();
    await flush();
    expect(rango()).toBe('martes 24/11/2026');
  });

  it('en la vista semanal Siguiente y Anterior mueven siete días', async () => {
    const ctx = ctxAdmin();
    await montarAgenda(ctx);
    boton('Semana').click();
    await flush();
    boton('Siguiente').click();
    await flush();
    expect(rango()).toBe('Semana del 30/11/2026 al 06/12/2026');
    expect(listarArgs(ctx, 2)).toEqual({ desde: '2026-11-30T03:00:00Z', hasta: '2026-12-07T03:00:00Z' });
    boton('Anterior').click();
    boton('Anterior').click();
    await flush();
    expect(rango()).toBe('Semana del 16/11/2026 al 22/11/2026');
  });

  it('la configuración (sillones, prestaciones, horarios) no se vuelve a pedir al navegar', async () => {
    const ctx = ctxAdmin();
    await montarAgenda(ctx);
    boton('Siguiente').click();
    await flush();
    expect(ctx.agenda.listarSillones).toHaveBeenCalledTimes(1);
    expect(ctx.agenda.listarHorarios).toHaveBeenCalledTimes(1);
    expect(ctx.agenda.listarBloqueos).toHaveBeenCalledTimes(2);
  });

  it('respuesta tardía descartada al navegar rápido: gana la última pedida', async () => {
    const ctx = ctxAdmin();
    await montarAgenda(ctx);
    const dia24 = deferred<Turno[]>();
    const dia25 = deferred<Turno[]>();
    ctx.turnos.listar.mockReturnValueOnce(dia24.promise).mockReturnValueOnce(dia25.promise);
    boton('Siguiente').click(); // pide 25 (primera mock)
    boton('Siguiente').click(); // pide 26 (segunda mock)
    await flush();
    dia25.resolve([{ ...TURNO_CONFIRMADO, id: 301, inicio: '2026-11-26T14:00:00Z', fin: '2026-11-26T14:15:00Z' }]);
    await flush();
    dia24.resolve([{ ...TURNO_PROGRAMADO, id: 300, inicio: '2026-11-25T13:00:00Z', fin: '2026-11-25T13:30:00Z' }]);
    await flush();
    expect(rango()).toBe('jueves 26/11/2026');
    expect(bloquesIds()).toEqual(['301']);
  });

  it('dispose ignora las respuestas que llegan después', async () => {
    const ctx = ctxAdmin();
    const { page } = await montarAgenda(ctx);
    const pendiente = deferred<Turno[]>();
    ctx.turnos.listar.mockReturnValueOnce(pendiente.promise);
    boton('Siguiente').click();
    await flush();
    page.dispose?.();
    pendiente.resolve([{ ...TURNO_PROGRAMADO, id: 999 }]);
    await flush();
    expect(document.querySelector('[data-turno-id="999"]')).toBeNull();
  });
});

describe('4.3 filtro, cancelados, franja y sillón inactivo', () => {
  it('filtro por sillón: la request lleva sillonId y queda solo esa columna (vista diaria)', async () => {
    const ctx = ctxAdmin();
    await montarAgenda(ctx, { turnos: [TURNO_PROGRAMADO, T2] });
    const select = document.querySelector<HTMLSelectElement>('select[name="sillon"]');
    expect([...(select?.options ?? [])].map((o) => o.textContent)).toEqual(['Todos', 'Sillón 1', 'Sillón 2']);
    ctx.turnos.listar.mockResolvedValue([T2]);
    if (select !== null) {
      select.value = '2';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await flush();
    expect(listarArgs(ctx, 1)).toEqual({ desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z', sillonId: 2 });
    expect(titulos()).toEqual(['Sillón 2']);
    expect(bloquesIds()).toEqual(['200']);
  });

  it('el filtro se aplica también en la vista semanal', async () => {
    const ctx = ctxAdmin();
    await montarAgenda(ctx, { turnos: [TURNO_PROGRAMADO, T2] });
    boton('Semana').click();
    await flush();
    const select = document.querySelector<HTMLSelectElement>('select[name="sillon"]');
    ctx.turnos.listar.mockResolvedValue([T2]);
    if (select !== null) {
      select.value = '2';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await flush();
    expect(listarArgs(ctx, 2)).toMatchObject({ sillonId: 2 });
    expect(titulos()).toHaveLength(7);
    expect(bloquesIds()).toEqual(['200']);
  });

  it('cancelados ocultos por defecto: la request no los pide y aunque el servidor los mande no se muestran', async () => {
    const ctx = ctxAdmin();
    await montarAgenda(ctx, { turnos: [TURNO_PROGRAMADO, TURNO_CANCELADO] });
    expect(listarArgs(ctx)).not.toHaveProperty('incluirCancelados');
    expect(bloquesIds()).toEqual(['100']);
  });

  it('"Mostrar cancelados": pide incluirCancelados=true y el cancelado se ve con su etiqueta', async () => {
    const ctx = ctxAdmin();
    await montarAgenda(ctx, { turnos: [TURNO_PROGRAMADO, TURNO_CANCELADO] });
    const check = document.querySelector<HTMLInputElement>('input[name="cancelados"]');
    expect(check?.checked).toBe(false);
    check?.click();
    await flush();
    expect(listarArgs(ctx, 1)).toMatchObject({ incluirCancelados: true });
    expect(bloqueDe(102).textContent).toContain('Cancelado');
  });

  it('un sobreturno fuera de horario expande la franja (hasta 19:45) y sigue siendo operable', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_SOBRETURNO] });
    // Horarios 09:00–18:00 + sobreturno hasta 19:45: (19:45 − 09:00) / 15 = 43 filas.
    expect(document.querySelector('.grilla-columna')?.querySelectorAll('.celda')).toHaveLength(43);
    expect(bloqueDe(105).textContent).toContain('19:00–19:45');
  });

  it('sin turnos la franja sigue a los horarios: 09:00 a 18:00 son 36 filas', async () => {
    await montarAgenda(ctxAdmin());
    expect(document.querySelector('.grilla-columna')?.querySelectorAll('.celda')).toHaveLength(36);
  });

  it('sin horarios configurados: 08:00 a 20:00', async () => {
    await montarAgenda(ctxAdmin(), { horarios: [] });
    expect(document.querySelector('.grilla-columna')?.querySelectorAll('.celda')).toHaveLength(48);
  });

  it('turno en un sillón inactivo: tiene su columna y aparece en el filtro', async () => {
    await montarAgenda(ctxAdmin(), { sillones: [SILLON_1, SILLON_2, SILLON_INACTIVO], turnos: [TURNO_SILLON_INACTIVO] });
    expect(titulos()).toEqual(['Sillón 1', 'Sillón 2', 'Sillón viejo (inactivo)']);
    expect(bloquesIds()).toEqual(['108']);
    const opciones = [...(document.querySelector<HTMLSelectElement>('select[name="sillon"]')?.options ?? [])].map((o) => o.textContent);
    expect(opciones).toContain('Sillón viejo (inactivo)');
  });

  it('bloqueo del Sillón 2 de 12:00 a 13:00: sombreado solo en su columna', async () => {
    await montarAgenda(ctxAdmin(), { bloqueos: [{ ...BLOQUEO_SILLON, sillonId: 2, inicio: '2026-11-24T15:00:00Z', fin: '2026-11-24T16:00:00Z' }] });
    const cols = [...document.querySelectorAll('.grilla-columna')];
    expect(cols[0]?.querySelector('.bloqueo')).toBeNull();
    expect(cols[1]?.querySelector('.bloqueo')?.textContent).toContain('Bloqueado');
  });

  it('la lista tiene todos los turnos visibles, también el que está fuera de horario', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_PROGRAMADO, TURNO_CONFIRMADO, T2, TURNO_SOBRETURNO, TURNO_NOCTURNO] });
    expect(document.querySelectorAll('.lista-turnos li')).toHaveLength(5);
    expect(document.querySelectorAll('.grilla [data-turno-id]')).toHaveLength(5);
  });
});

describe('4.4 independencia de la zona horaria del navegador', () => {
  it.each(['Asia/Tokyo', 'America/Los_Angeles'])('con TZ=%s pide el mismo rango y muestra las mismas horas', async (zona) => {
    env['TZ'] = zona;
    const ctx = ctxAdmin();
    await montarAgenda(ctx, { turnos: [TURNO_PROGRAMADO, TURNO_NOCTURNO] });
    expect(listarArgs(ctx)).toEqual({ desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' });
    expect(bloqueDe(100).textContent).toContain('10:00–10:30');
    expect(bloqueDe(106).textContent).toContain('22:30–23:00');
    expect(rango()).toBe('martes 24/11/2026');
  });

  it('el proceso realmente cambió de zona (el offset difiere entre Tokyo y Los Ángeles)', () => {
    const offset = (zona: string): number => {
      env['TZ'] = zona;
      return new Date(Date.UTC(2026, 10, 24, 12, 0)).getTimezoneOffset();
    };
    expect(new Set([offset('Asia/Tokyo'), offset('America/Los_Angeles'), offset('UTC')]).size).toBe(3);
  });
});

describe('4.5 varios profesionales (DP-1, opción A)', () => {
  const dosProfesionales: Horario[] = [{ ...HORARIO_LUNES, profesionalId: 7 }, { ...HORARIO_LUNES, id: 99, profesionalId: 8, diaSemana: 2 }];

  it('con horarios de dos profesionales: aviso persistente en role="status" y "Nuevo turno" con aria-disabled', async () => {
    await montarAgenda(ctxAdmin(), { horarios: dosProfesionales });
    const aviso = [...document.querySelectorAll('[role="status"]')].find((e) => e.textContent === 'La agenda con varios profesionales no está disponible en esta versión.');
    expect(aviso).toBeDefined();
    const nuevo = boton('Nuevo turno');
    expect(nuevo.getAttribute('aria-disabled')).toBe('true');
    expect(nuevo.getAttribute('aria-describedby')).toBe(aviso?.id);
    expect(nuevo.hasAttribute('disabled')).toBe(false);
  });

  it('activar "Nuevo turno" o hacer clic en un hueco no abre el alta', async () => {
    await montarAgenda(ctxAdmin(), { horarios: dosProfesionales });
    boton('Nuevo turno').click();
    document.querySelector<HTMLElement>('.celda')?.click();
    await flush();
    expect(dialogo()).toBeNull();
  });

  it('con un solo profesional no hay aviso y "Nuevo turno" está habilitado', async () => {
    await montarAgenda(ctxAdmin(), { horarios: [{ ...HORARIO_LUNES }] });
    expect(document.body.textContent).not.toContain('varios profesionales');
    expect(boton('Nuevo turno').hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('4.6 teclado en la página', () => {
  it('una sola parada de Tab en la grilla, antes de la lista (cuyos botones se recorren con Tab)', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_PROGRAMADO, TURNO_CONFIRMADO, T2, TURNO_SOBRETURNO, TURNO_NOCTURNO] });
    const tabbables = [...document.querySelectorAll<HTMLElement>('.grilla [data-turno-id], .lista-turnos button')].filter(
      (el) => el.getAttribute('tabindex') !== '-1',
    );
    const enGrilla = tabbables.filter((el) => el.closest('.grilla') !== null);
    expect(enGrilla).toHaveLength(1);
    expect(tabbables[0]).toBe(enGrilla[0]);
    expect(tabbables.slice(1).every((el) => el.closest('.lista-turnos') !== null)).toBe(true);
    expect(tabbables).toHaveLength(6);
  });

  it('Enter (activación nativa del botón) sobre un bloque abre el diálogo de acciones de ese turno', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_PROGRAMADO, TURNO_CONFIRMADO] });
    bloqueDe(101).focus();
    bloqueDe(101).click();
    const d = dialogo();
    expect(d).not.toBeNull();
    expect(d?.textContent).toContain('Gómez, Luis');
    expect(d?.textContent).not.toContain('Pérez, Ana');
  });

  it('el botón "Acciones" de la lista abre el mismo diálogo y Escape devuelve el foco a ese botón', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_PROGRAMADO] });
    const acciones = document.querySelector<HTMLButtonElement>('.lista-turnos button');
    acciones?.focus();
    acciones?.click();
    expect(dialogo()).not.toBeNull();
    dialogo()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(dialogo()).toBeNull();
    expect(document.activeElement).toBe(acciones);
  });

  it('Escape desde el diálogo abierto con un bloque devuelve el foco al bloque del turno', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_PROGRAMADO] });
    bloqueDe(100).focus();
    bloqueDe(100).click();
    dialogo()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(bloqueDe(100));
  });

  it('el detalle muestra las notas como texto literal, sin agregar script ni img', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_MALICIOSO] });
    bloqueDe(109).click();
    expect(dialogo()?.textContent).toContain('<script>alert(1)</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('contenido seguro en la página', () => {
  it('nombre de paciente malicioso en grilla y lista: texto literal y ningún img', async () => {
    await montarAgenda(ctxAdmin(), { turnos: [TURNO_MALICIOSO] });
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
