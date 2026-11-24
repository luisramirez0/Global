import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BLOQUEO_CONSULTORIO,
  BLOQUEO_PROFESIONAL,
  BLOQUEO_SILLON,
  SILLON_1,
  SILLON_2,
  SILLON_INACTIVO,
} from '../../api/__fixtures__/agendaConfig';
import type { Bloqueo } from '../../api/types';
import { buttonLabeled, buttons, createLoggedContext, errorOf, fill, flush, input, select, submit, type TestContext } from '../../test-support/pages';
import { renderBloqueos } from './bloqueos';
import { MSG_FIN_ORDEN, MSG_MOTIVO_LARGO, MSG_RANGO } from './validacion';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env['TZ'];

/** 23:30 del 24/11 en Argentina = 02:30 UTC del 25/11. */
const NOCHE_AR = '2026-11-25T02:30:00Z';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOCHE_AR));
});

afterEach(() => {
  vi.useRealTimers();
  if (ORIGINAL_TZ === undefined) delete env['TZ'];
  else env['TZ'] = ORIGINAL_TZ;
  document.body.replaceChildren();
  sessionStorage.clear();
});

async function setup(ctx: TestContext = createLoggedContext('ADMIN'), bloqueos: Bloqueo[] = [BLOQUEO_CONSULTORIO, BLOQUEO_SILLON, BLOQUEO_PROFESIONAL]) {
  if (ctx.agenda.listarBloqueos.getMockImplementation() === undefined) ctx.agenda.listarBloqueos.mockResolvedValue(bloqueos);
  if (ctx.agenda.listarSillones.getMockImplementation() === undefined) {
    ctx.agenda.listarSillones.mockResolvedValue([SILLON_1, SILLON_2, SILLON_INACTIVO]);
  }
  const page = renderBloqueos(ctx);
  document.body.replaceChildren(page.element);
  await flush();
  return { ctx, page, root: page.element };
}

const filas = (root: ParentNode): string[][] =>
  [...root.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].slice(0, 4).map((td) => td.textContent ?? ''));

const formAlert = (root: ParentNode): string => root.querySelector('form [role="alert"]')?.textContent ?? '';

describe('filtro por defecto (V-D8: "hoy" en Argentina, no en UTC)', () => {
  it('a las 23:30 AR el filtro arranca el 24/11 y pide desde las 00:00 AR (03:00 UTC)', async () => {
    const { root, ctx } = await setup();
    expect(input(root, 'filtroDesde').value).toBe('2026-11-24');
    expect(input(root, 'filtroHasta').value).toBe('');
    expect(ctx.agenda.listarBloqueos).toHaveBeenCalledWith({ desde: '2026-11-24T03:00:00Z' });
  });

  it('desde las 00:00 AR ya es el día siguiente', async () => {
    vi.setSystemTime(new Date('2026-11-25T03:00:00Z'));
    const { root, ctx } = await setup();
    expect(input(root, 'filtroDesde').value).toBe('2026-11-25');
    expect(ctx.agenda.listarBloqueos).toHaveBeenCalledWith({ desde: '2026-11-25T03:00:00Z' });
  });

  it('con el proceso en otra zona (Tokio) el día sigue siendo el de Argentina', async () => {
    env['TZ'] = 'Asia/Tokyo';
    const { root, ctx } = await setup();
    expect(input(root, 'filtroDesde').value).toBe('2026-11-24');
    expect(ctx.agenda.listarBloqueos).toHaveBeenCalledWith({ desde: '2026-11-24T03:00:00Z' });
  });

  it('"Filtrar" aplica desde y hasta (inclusivo)', async () => {
    const { root, ctx } = await setup();
    fill(root, { filtroDesde: '2026-12-01', filtroHasta: '2026-12-31' });
    buttons(root, 'Filtrar')[0]?.click();
    await flush();
    expect(ctx.agenda.listarBloqueos).toHaveBeenLastCalledWith({ desde: '2026-12-01T03:00:00Z', hasta: '2027-01-01T03:00:00Z' });
  });

  it('rango invertido: error de campo y sin request', async () => {
    const { root, ctx } = await setup();
    fill(root, { filtroDesde: '2026-12-10', filtroHasta: '2026-12-01' });
    buttons(root, 'Filtrar')[0]?.click();
    await flush();
    expect(errorOf(root, 'filtroHasta')).toBe(MSG_RANGO);
    expect(ctx.agenda.listarBloqueos).toHaveBeenCalledTimes(1);
  });
});

describe('listado', () => {
  it('ordenados por inicio, en hora de Argentina, con alcance y motivo', async () => {
    const { root } = await setup();
    expect(filas(root)).toEqual([
      ['26/11/2026 12:00', '26/11/2026 13:00', 'Sillón: Sillón 1', '—'],
      ['24/12/2026 09:00', '24/12/2026 20:00', 'Todo el consultorio', 'Nochebuena'],
      ['04/01/2027 00:00', '11/01/2027 00:00', 'Profesional', 'Vacaciones'],
    ]);
  });

  it('motivo malicioso como texto', async () => {
    const { root } = await setup(createLoggedContext('ADMIN'), [{ ...BLOQUEO_CONSULTORIO, motivo: '<img src=x onerror=alert(1)>' }]);
    expect(filas(root)[0]?.[3]).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });

  it('sin bloqueos en el rango', async () => {
    const { root } = await setup(createLoggedContext('ADMIN'), []);
    expect(root.querySelector('.vacio')?.textContent).toBe('No hay bloqueos en el rango elegido.');
  });
});

describe('alta', () => {
  it('alcance: todo el consultorio o un sillón activo', async () => {
    const { root } = await setup();
    expect([...select(root, 'alcance').options].map((o) => [o.value, o.textContent])).toEqual([
      ['consultorio', 'Todo el consultorio'],
      ['sillon-1', 'Sillón 1'],
      ['sillon-2', 'Sillón 2'],
    ]);
    expect(input(root, 'inicio').type).toBe('datetime-local');
  });

  it('21:00–23:59 AR se envían en UTC del día siguiente, sin motivo si está vacío', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.crearBloqueo.mockResolvedValue(BLOQUEO_SILLON);
    select(root, 'alcance').value = 'sillon-2';
    fill(root, { inicio: '2026-11-24T21:00', fin: '2026-11-24T23:59', motivo: '  ' });
    submit(root);
    await flush();
    expect(ctx.agenda.crearBloqueo).toHaveBeenCalledWith({
      sillonId: 2,
      profesionalId: null,
      inicio: '2026-11-25T00:00:00Z',
      fin: '2026-11-25T02:59:00Z',
    });
    expect(root.querySelector('.estado')?.textContent).toBe('Bloqueo agregado.');
  });

  it('V-D4: con el proceso en Los Ángeles se envía exactamente lo mismo', async () => {
    env['TZ'] = 'America/Los_Angeles';
    const { root, ctx } = await setup();
    ctx.agenda.crearBloqueo.mockResolvedValue(BLOQUEO_CONSULTORIO);
    fill(root, { inicio: '2026-11-24T22:30', fin: '2026-11-24T23:45', motivo: 'Guardia' });
    submit(root);
    await flush();
    expect(ctx.agenda.crearBloqueo).toHaveBeenCalledWith({
      sillonId: null,
      profesionalId: null,
      inicio: '2026-11-25T01:30:00Z',
      fin: '2026-11-25T02:45:00Z',
      motivo: 'Guardia',
    });
  });

  it('fin anterior al inicio y motivo de más de 255 bytes: errores de campo', async () => {
    const { root, ctx } = await setup();
    fill(root, { inicio: '2026-11-24T23:00', fin: '2026-11-24T22:00', motivo: 'ñ'.repeat(128) });
    submit(root);
    expect(errorOf(root, 'fin')).toBe(MSG_FIN_ORDEN);
    expect(errorOf(root, 'motivo')).toBe(MSG_MOTIVO_LARGO);
    expect(ctx.agenda.crearBloqueo).not.toHaveBeenCalled();
  });

  it('400 del servidor en fin se marca en el campo', async () => {
    const { root, ctx } = await setup();
    const { ApiError } = await import('../../api/errors');
    ctx.agenda.crearBloqueo.mockRejectedValue(new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'fin', mensaje: 'debe ser posterior' }] }));
    fill(root, { inicio: '2026-11-24T10:00', fin: '2026-11-24T11:00' });
    submit(root);
    await flush();
    expect(errorOf(root, 'fin')).toBe('debe ser posterior');
    expect(formAlert(root)).toBe('Revisá los datos ingresados.');
  });
});

describe('edición', () => {
  it('carga fecha y hora de Argentina y conserva el profesionalId', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.editarBloqueo.mockResolvedValue(BLOQUEO_PROFESIONAL);
    expect(root.querySelector('.aviso-profesional')?.hasAttribute('hidden')).toBe(true);
    buttonLabeled(root, 'Editar bloqueo del 04/01/2027 00:00').click();
    expect(input(root, 'inicio').value).toBe('2027-01-04T00:00');
    expect(input(root, 'fin').value).toBe('2027-01-11T00:00');
    expect(select(root, 'alcance').value).toBe('consultorio');
    expect(root.querySelector('.aviso-profesional')?.hasAttribute('hidden')).toBe(false);
    fill(root, { motivo: 'Vacaciones de verano' });
    submit(root);
    await flush();
    expect(ctx.agenda.editarBloqueo).toHaveBeenCalledWith(32, {
      sillonId: null,
      profesionalId: 7,
      inicio: '2027-01-04T03:00:00Z',
      fin: '2027-01-11T03:00:00Z',
      motivo: 'Vacaciones de verano',
    });
    expect(root.querySelector('.aviso-profesional')?.hasAttribute('hidden')).toBe(true);
  });

  it('un bloqueo de un sillón inactivo ofrece ese sillón al editarlo', async () => {
    const { root } = await setup(createLoggedContext('ADMIN'), [{ ...BLOQUEO_SILLON, sillonId: 3 }]);
    expect(filas(root)[0]?.[2]).toBe('Sillón: Sillón viejo');
    buttonLabeled(root, 'Editar bloqueo del 26/11/2026 12:00').click();
    expect(select(root, 'alcance').value).toBe('sillon-3');
    expect(select(root, 'alcance').selectedOptions[0]?.textContent).toBe('Sillón viejo (inactivo)');
  });
});

describe('borrado y permisos', () => {
  it('ADMIN elimina con confirmación', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.borrarBloqueo.mockResolvedValue(undefined);
    buttonLabeled(root, 'Eliminar bloqueo del 24/12/2026 09:00').click();
    buttonLabeled(root, 'Confirmar: Eliminar bloqueo del 24/12/2026 09:00').click();
    await flush();
    expect(ctx.agenda.borrarBloqueo).toHaveBeenCalledWith(30);
    expect(root.querySelector('.estado')?.textContent).toBe('Bloqueo eliminado.');
  });

  it('RECEPCION crea y edita, pero no ve "Eliminar"', async () => {
    const { root } = await setup(createLoggedContext('RECEPCION'));
    expect(root.querySelector('form')).not.toBeNull();
    expect(buttons(root, 'Editar')).toHaveLength(3);
    expect(buttons(root, 'Eliminar')).toHaveLength(0);
    expect(root.querySelector('.solo-lectura')).toBeNull();
  });

  it('error al cargar los sillones: mensaje y reintento', async () => {
    const ctx = createLoggedContext('ADMIN');
    const { ApiError } = await import('../../api/errors');
    ctx.agenda.listarSillones.mockRejectedValueOnce(new ApiError('server', { status: 500 })).mockResolvedValue([SILLON_1]);
    const { root } = await setup(ctx);
    expect(root.querySelector('.error-carga')?.textContent).toContain('Ocurrió un error. Intentá de nuevo.');
    buttons(root, 'Reintentar')[0]?.click();
    await flush();
    expect(filas(root)).toHaveLength(3);
  });
});
