import { afterEach, describe, expect, it } from 'vitest';
import { PRESTACION_CONTROL, PRESTACION_INACTIVA, PRESTACION_LIMPIEZA } from '../../api/__fixtures__/agendaConfig';
import { ApiError } from '../../api/errors';
import { buttonLabeled, buttons, createLoggedContext, errorOf, fill, flush, input, submit, type TestContext } from '../../test-support/pages';
import { renderPrestaciones } from './prestaciones';
import { MSG_DURACION_GRILLA } from './validacion';

async function setup(ctx: TestContext = createLoggedContext('ADMIN')) {
  if (ctx.agenda.listarPrestaciones.getMockImplementation() === undefined) {
    ctx.agenda.listarPrestaciones.mockResolvedValue([PRESTACION_CONTROL, PRESTACION_LIMPIEZA]);
  }
  const page = renderPrestaciones(ctx);
  document.body.replaceChildren(page.element);
  await flush();
  return { ctx, page, root: page.element };
}

const filas = (root: ParentNode): string[][] =>
  [...root.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].slice(0, 3).map((td) => td.textContent ?? ''));

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
});

describe('prestaciones', () => {
  it('lista nombre, duración y estado', async () => {
    const { root, page } = await setup();
    expect(page.title).toBe('Prestaciones');
    expect(root.querySelector('[aria-current="page"]')?.textContent).toBe('Prestaciones');
    expect(filas(root)).toEqual([
      ['Control', '15 min', 'Activa'],
      ['Limpieza', '30 min', 'Activa'],
    ]);
  });

  it('el campo de duración sugiere teclado numérico y explica la grilla', async () => {
    const { root } = await setup();
    const duracion = input(root, 'duracionMinutos');
    expect(duracion.getAttribute('inputmode')).toBe('numeric');
    expect(root.querySelector(`label[for="${duracion.id}"]`)?.textContent).toBe('Duración (minutos, múltiplo de 15)');
  });

  it('duración fuera de la grilla: error de campo y sin request', async () => {
    const { root, ctx } = await setup();
    fill(root, { nombre: 'Consulta', duracionMinutos: '20' });
    submit(root);
    expect(errorOf(root, 'duracionMinutos')).toBe(MSG_DURACION_GRILLA);
    expect(document.activeElement).toBe(input(root, 'duracionMinutos'));
    expect(ctx.agenda.crearPrestacion).not.toHaveBeenCalled();
  });

  it('alta con duración entera', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.crearPrestacion.mockResolvedValue(PRESTACION_LIMPIEZA);
    fill(root, { nombre: ' Limpieza ', duracionMinutos: '30' });
    submit(root);
    await flush();
    expect(ctx.agenda.crearPrestacion).toHaveBeenCalledWith({ nombre: 'Limpieza', duracionMinutos: 30 });
    expect(root.querySelector('.estado')?.textContent).toBe('Prestación agregada.');
  });

  it('edición carga la duración y envía PUT sin activo', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.editarPrestacion.mockResolvedValue(PRESTACION_CONTROL);
    buttonLabeled(root, 'Editar Control').click();
    expect(input(root, 'duracionMinutos').value).toBe('15');
    fill(root, { duracionMinutos: '45' });
    submit(root);
    await flush();
    expect(ctx.agenda.editarPrestacion).toHaveBeenCalledWith(10, { nombre: 'Control', duracionMinutos: 45 });
  });

  it('400 del servidor en duracionMinutos se marca en el campo', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.crearPrestacion.mockRejectedValue(
      new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'duracionMinutos', mensaje: 'fuera de la grilla' }] }),
    );
    fill(root, { nombre: 'x', duracionMinutos: '15' });
    submit(root);
    await flush();
    expect(errorOf(root, 'duracionMinutos')).toBe('fuera de la grilla');
  });

  it('baja con confirmación', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.borrarPrestacion.mockResolvedValue(undefined);
    buttonLabeled(root, 'Dar de baja Limpieza').click();
    buttonLabeled(root, 'Confirmar: Dar de baja Limpieza').click();
    await flush();
    expect(ctx.agenda.borrarPrestacion).toHaveBeenCalledWith(11);
    expect(root.querySelector('.estado')?.textContent).toBe('Prestación dada de baja.');
  });

  it('"Mostrar inactivas" y "Reactivar" con activo: true y la duración actual', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.listarPrestaciones.mockResolvedValue([PRESTACION_CONTROL, PRESTACION_INACTIVA]);
    const check = input(root, 'incluirInactivas');
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    await flush();
    expect(ctx.agenda.listarPrestaciones).toHaveBeenLastCalledWith(true);
    expect(filas(root)[1]).toEqual(['Blanqueamiento', '60 min', 'Inactiva']);
    ctx.agenda.editarPrestacion.mockResolvedValue({ ...PRESTACION_INACTIVA, activo: true });
    buttonLabeled(root, 'Reactivar Blanqueamiento').click();
    await flush();
    expect(ctx.agenda.editarPrestacion).toHaveBeenCalledWith(12, { nombre: 'Blanqueamiento', duracionMinutos: 60, activo: true });
    expect(root.querySelector('.estado')?.textContent).toBe('Prestación reactivada.');
  });

  it('V-D3: RECEPCION no tiene formulario, campos ni acciones', async () => {
    const { root } = await setup(createLoggedContext('RECEPCION'));
    expect(filas(root)).toHaveLength(2);
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('input[name="duracionMinutos"]')).toBeNull();
    for (const texto of ['Editar', 'Dar de baja', 'Reactivar', 'Agregar']) expect(buttons(root, texto)).toHaveLength(0);
  });

  it('nombre malicioso como texto', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.agenda.listarPrestaciones.mockResolvedValue([{ ...PRESTACION_CONTROL, nombre: '<img src=x onerror=alert(1)>' }]);
    const { root } = await setup(ctx);
    expect(filas(root)[0]?.[0]).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });
});
