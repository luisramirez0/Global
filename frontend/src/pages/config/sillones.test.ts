import { afterEach, describe, expect, it } from 'vitest';
import { SILLON_1, SILLON_2, SILLON_INACTIVO } from '../../api/__fixtures__/agendaConfig';
import { ApiError } from '../../api/errors';
import {
  buttonLabeled,
  buttons,
  createLoggedContext,
  createTestContext,
  deferred,
  errorOf,
  fill,
  flush,
  input,
  submit,
  type TestContext,
} from '../../test-support/pages';
import { MSG_LIMITE_SILLONES, MSG_NO_EXISTE, MSG_SIN_PERMISO, MSG_SOLO_LECTURA, MSG_ULTIMO_SILLON } from './mensajes';
import { renderSillones } from './sillones';

async function setup(ctx: TestContext = createLoggedContext('ADMIN')) {
  if (ctx.agenda.listarSillones.getMockImplementation() === undefined) {
    ctx.agenda.listarSillones.mockResolvedValue([SILLON_1, SILLON_2]);
  }
  const page = renderSillones(ctx);
  document.body.replaceChildren(page.element);
  await flush();
  return { ctx, page, root: page.element };
}

const estado = (root: ParentNode): string => root.querySelector('.estado')?.textContent ?? '';
const alertaForm = (root: ParentNode): string => root.querySelector('form [role="alert"]')?.textContent ?? '';
const alertaLista = (root: ParentNode): string => root.querySelector('.alerta-lista')?.textContent ?? '';
const filas = (root: ParentNode): string[][] =>
  [...root.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].slice(0, 2).map((td) => td.textContent ?? ''));

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
});

describe('estructura', () => {
  it('h1, navegación de configuración con la sección actual y título de página', async () => {
    const { root, page } = await setup();
    expect(page.title).toBe('Sillones');
    expect(root.querySelector('h1')?.textContent).toBe('Sillones');
    const nav = root.querySelector('nav[aria-label="Secciones de configuración"]');
    expect([...(nav?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'))).toEqual([
      '#/config/sillones',
      '#/config/prestaciones',
      '#/config/horarios',
      '#/config/bloqueos',
    ]);
    expect(nav?.querySelector('[aria-current="page"]')?.textContent).toBe('Sillones');
  });

  it('formulario accesible con label y novalidate', async () => {
    const { root } = await setup();
    const nombre = input(root, 'nombre');
    expect(root.querySelector(`label[for="${nombre.id}"]`)?.textContent).toBe('Nombre');
    expect(root.querySelector('form')?.hasAttribute('novalidate')).toBe(true);
  });
});

describe('listado', () => {
  it('muestra carga y después los sillones con su estado', async () => {
    const ctx = createLoggedContext('ADMIN');
    const pending = deferred<typeof SILLON_1[]>();
    ctx.agenda.listarSillones.mockReturnValue(pending.promise);
    const page = renderSillones(ctx);
    expect(page.element.querySelector('.cargando')?.textContent).toBe('Cargando…');
    pending.resolve([SILLON_1, SILLON_INACTIVO]);
    await flush();
    expect(filas(page.element)).toEqual([
      ['Sillón 1', 'Activo'],
      ['Sillón viejo', 'Inactivo'],
    ]);
    expect(ctx.agenda.listarSillones).toHaveBeenCalledWith(false);
  });

  it('sin sillones muestra un aviso', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.agenda.listarSillones.mockResolvedValue([]);
    const { root } = await setup(ctx);
    expect(root.querySelector('.vacio')?.textContent).toBe('Todavía no hay sillones.');
  });

  it('error de red: mensaje y "Reintentar" vuelve a pedir', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.agenda.listarSillones.mockRejectedValueOnce(new ApiError('network')).mockResolvedValue([SILLON_1]);
    const { root } = await setup(ctx);
    expect(root.querySelector('.error-carga')?.textContent).toContain('No se pudo conectar con el servidor.');
    buttons(root, 'Reintentar')[0]?.click();
    await flush();
    expect(filas(root)).toEqual([['Sillón 1', 'Activo']]);
  });

  it('"Mostrar inactivos" vuelve a pedir con incluirInactivos', async () => {
    const { root, ctx } = await setup();
    const check = input(root, 'incluirInactivos');
    expect(root.querySelector(`label[for="${check.id}"]`)?.textContent).toBe('Mostrar inactivos');
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    await flush();
    expect(ctx.agenda.listarSillones).toHaveBeenLastCalledWith(true);
  });

  it('una respuesta vieja no pisa a la más nueva', async () => {
    const ctx = createLoggedContext('ADMIN');
    const vieja = deferred<typeof SILLON_1[]>();
    ctx.agenda.listarSillones.mockReturnValueOnce(vieja.promise).mockResolvedValueOnce([SILLON_INACTIVO]);
    const { root } = await setup(ctx);
    const check = input(root, 'incluirInactivos');
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    await flush();
    vieja.resolve([SILLON_1]);
    await flush();
    expect(filas(root)).toEqual([['Sillón viejo', 'Inactivo']]);
  });

  it('nombre malicioso: texto literal sin crear nodos', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.agenda.listarSillones.mockResolvedValue([{ id: 9, nombre: '<img src=x onerror=alert(1)>', activo: true }]);
    const { root } = await setup(ctx);
    expect(filas(root)[0]?.[0]).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
    expect(buttonLabeled(root, 'Editar <img src=x onerror=alert(1)>')).toBeDefined();
  });
});

describe('alta', () => {
  it('nombre vacío: error de campo y sin request', async () => {
    const { root, ctx } = await setup();
    fill(root, { nombre: '   ' });
    submit(root);
    expect(errorOf(root, 'nombre')).toBe('Este campo es obligatorio.');
    expect(document.activeElement).toBe(input(root, 'nombre'));
    expect(ctx.agenda.crearSillon).not.toHaveBeenCalled();
  });

  it('crea con el nombre recortado, anuncia, limpia y recarga', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.crearSillon.mockResolvedValue(SILLON_2);
    fill(root, { nombre: ' Sillón 2 ' });
    submit(root);
    await flush();
    expect(ctx.agenda.crearSillon).toHaveBeenCalledWith({ nombre: 'Sillón 2' });
    expect(estado(root)).toBe('Sillón agregado.');
    expect(input(root, 'nombre').value).toBe('');
    expect(ctx.agenda.listarSillones).toHaveBeenCalledTimes(2);
  });

  it('409 al crear: límite de 2 sillones activos', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.crearSillon.mockRejectedValue(new ApiError('conflict', { status: 409, title: 'Límite de sillones activos' }));
    fill(root, { nombre: 'Sillón 3' });
    submit(root);
    await flush();
    expect(alertaForm(root)).toBe(MSG_LIMITE_SILLONES);
    expect(input(root, 'nombre').value).toBe('Sillón 3');
  });

  it('400 del servidor: el mensaje va al campo', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.crearSillon.mockRejectedValue(
      new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'nombre', mensaje: 'el tamaño debe estar entre 0 y 100' }] }),
    );
    fill(root, { nombre: 'x' });
    submit(root);
    await flush();
    expect(errorOf(root, 'nombre')).toBe('el tamaño debe estar entre 0 y 100');
    expect(alertaForm(root)).toBe('Revisá los datos ingresados.');
  });

  it('un segundo envío mientras el primero está en curso se ignora', async () => {
    const { root, ctx } = await setup();
    const pending = deferred<typeof SILLON_2>();
    ctx.agenda.crearSillon.mockReturnValue(pending.promise);
    fill(root, { nombre: 'Sillón 2' });
    submit(root);
    submit(root);
    expect(ctx.agenda.crearSillon).toHaveBeenCalledTimes(1);
    expect(root.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    pending.resolve(SILLON_2);
    await flush();
    expect(root.querySelector('form')?.hasAttribute('aria-busy')).toBe(false);
  });
});

describe('edición', () => {
  it('"Editar" carga el formulario y "Guardar cambios" envía PUT sin activo', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.editarSillon.mockResolvedValue({ ...SILLON_1, nombre: 'Principal' });
    buttonLabeled(root, 'Editar Sillón 1').click();
    expect(root.querySelector('.formulario h2')?.textContent).toBe('Editar sillón');
    expect(input(root, 'nombre').value).toBe('Sillón 1');
    expect(document.activeElement).toBe(input(root, 'nombre'));
    fill(root, { nombre: 'Principal' });
    buttons(root, 'Guardar cambios')[0]?.closest('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    expect(ctx.agenda.editarSillon).toHaveBeenCalledWith(1, { nombre: 'Principal' });
    expect(estado(root)).toBe('Sillón actualizado.');
    expect(root.querySelector('.formulario h2')?.textContent).toBe('Nuevo sillón');
  });

  it('"Cancelar edición" vuelve al alta sin request', async () => {
    const { root, ctx } = await setup();
    buttonLabeled(root, 'Editar Sillón 2').click();
    buttons(root, 'Cancelar edición')[0]?.click();
    expect(input(root, 'nombre').value).toBe('');
    expect(buttons(root, 'Agregar')).toHaveLength(1);
    expect(buttons(root, 'Cancelar edición')[0]?.hidden).toBe(true);
    expect(ctx.agenda.editarSillon).not.toHaveBeenCalled();
  });

  it('404 al guardar: avisa que ya no existe, sale de la edición y recarga', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.editarSillon.mockRejectedValue(new ApiError('unexpected', { status: 404 }));
    buttonLabeled(root, 'Editar Sillón 2').click();
    submit(root);
    await flush();
    expect(alertaForm(root)).toBe(MSG_NO_EXISTE);
    expect(buttons(root, 'Agregar')).toHaveLength(1);
    expect(ctx.agenda.listarSillones).toHaveBeenCalledTimes(2);
  });
});

describe('baja y reactivación', () => {
  it('"Dar de baja" pide confirmación; "Cancelar" restituye la fila sin request', async () => {
    const { root, ctx } = await setup();
    buttonLabeled(root, 'Dar de baja Sillón 2').click();
    expect(document.activeElement).toBe(buttonLabeled(root, 'Confirmar: Dar de baja Sillón 2'));
    expect(ctx.agenda.borrarSillon).not.toHaveBeenCalled();
    buttonLabeled(root, 'Cancelar: Dar de baja Sillón 2').click();
    expect(document.activeElement).toBe(buttonLabeled(root, 'Dar de baja Sillón 2'));
    expect(ctx.agenda.borrarSillon).not.toHaveBeenCalled();
  });

  it('"Confirmar" da de baja, anuncia y recarga', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.borrarSillon.mockResolvedValue(undefined);
    buttonLabeled(root, 'Dar de baja Sillón 2').click();
    buttonLabeled(root, 'Confirmar: Dar de baja Sillón 2').click();
    await flush();
    expect(ctx.agenda.borrarSillon).toHaveBeenCalledWith(2);
    expect(estado(root)).toBe('Sillón dado de baja.');
    expect(ctx.agenda.listarSillones).toHaveBeenCalledTimes(2);
  });

  it('409 al dar de baja: debe quedar al menos uno activo', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.borrarSillon.mockRejectedValue(new ApiError('conflict', { status: 409 }));
    buttonLabeled(root, 'Dar de baja Sillón 1').click();
    buttonLabeled(root, 'Confirmar: Dar de baja Sillón 1').click();
    await flush();
    expect(alertaLista(root)).toBe(MSG_ULTIMO_SILLON);
    expect(buttonLabeled(root, 'Dar de baja Sillón 1')).toBeDefined();
  });

  it('los inactivos no tienen "Dar de baja" sino "Reactivar", que envía activo: true', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.agenda.listarSillones.mockResolvedValue([SILLON_1, SILLON_INACTIVO]);
    ctx.agenda.editarSillon.mockResolvedValue({ ...SILLON_INACTIVO, activo: true });
    const { root } = await setup(ctx);
    expect(() => buttonLabeled(root, 'Dar de baja Sillón viejo')).toThrow();
    expect(() => buttonLabeled(root, 'Reactivar Sillón 1')).toThrow();
    buttonLabeled(root, 'Reactivar Sillón viejo').click();
    await flush();
    expect(ctx.agenda.editarSillon).toHaveBeenCalledWith(3, { nombre: 'Sillón viejo', activo: true });
    expect(estado(root)).toBe('Sillón reactivado.');
  });

  it('409 al reactivar: límite de sillones activos', async () => {
    const ctx = createLoggedContext('PROFESIONAL');
    ctx.agenda.listarSillones.mockResolvedValue([SILLON_1, SILLON_2, SILLON_INACTIVO]);
    ctx.agenda.editarSillon.mockRejectedValue(new ApiError('conflict', { status: 409 }));
    const { root } = await setup(ctx);
    buttonLabeled(root, 'Reactivar Sillón viejo').click();
    await flush();
    expect(alertaLista(root)).toBe(MSG_LIMITE_SILLONES);
  });

  it('403 inesperado: mensaje de permiso', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.borrarSillon.mockRejectedValue(new ApiError('forbidden', { status: 403 }));
    buttonLabeled(root, 'Dar de baja Sillón 2').click();
    buttonLabeled(root, 'Confirmar: Dar de baja Sillón 2').click();
    await flush();
    expect(alertaLista(root)).toBe(MSG_SIN_PERMISO);
  });
});

describe('permisos (V-D3)', () => {
  it('RECEPCION: lista, pero no hay form, campos ni acciones', async () => {
    const ctx = createLoggedContext('RECEPCION');
    ctx.agenda.listarSillones.mockResolvedValue([SILLON_1, SILLON_INACTIVO]);
    const { root } = await setup(ctx);
    expect(filas(root)).toHaveLength(2);
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('input[name="nombre"]')).toBeNull();
    expect(root.querySelector('td.acciones')).toBeNull();
    expect([...root.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Nombre', 'Estado']);
    for (const texto of ['Editar', 'Dar de baja', 'Reactivar', 'Agregar']) expect(buttons(root, texto)).toHaveLength(0);
    expect(root.querySelector('.solo-lectura')?.textContent).toBe(MSG_SOLO_LECTURA);
    expect(root.querySelector('input[name="incluirInactivos"]')).not.toBeNull();
  });

  it('sin perfil: solo lectura', async () => {
    const { root } = await setup(createTestContext());
    expect(root.querySelector('form')).toBeNull();
    expect(buttons(root, 'Editar')).toHaveLength(0);
  });

  it('PROFESIONAL: formulario y acciones', async () => {
    const { root } = await setup(createLoggedContext('PROFESIONAL'));
    expect(root.querySelector('form')).not.toBeNull();
    expect(root.querySelector('.solo-lectura')).toBeNull();
    expect(buttons(root, 'Editar')).toHaveLength(2);
  });
});

describe('dispose', () => {
  it('ignora respuestas que llegan después de salir de la página', async () => {
    const ctx = createLoggedContext('ADMIN');
    const pending = deferred<typeof SILLON_1[]>();
    ctx.agenda.listarSillones.mockReturnValue(pending.promise);
    const page = renderSillones(ctx);
    page.dispose?.();
    pending.resolve([SILLON_1]);
    await flush();
    expect(page.element.querySelector('tbody')).toBeNull();
  });
});
