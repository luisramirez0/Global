import { afterEach, describe, expect, it, vi } from 'vitest';
import { PACIENTE_ANA, PACIENTE_INACTIVO, PACIENTE_LUIS, pagina } from '../../api/__fixtures__/pacientesAbm';
import { ApiError } from '../../api/errors';
import type { Paciente, Pagina, Rol } from '../../api/types';
import type { Page } from '../../router/router';
import { buttonLabeled, buttons, createLoggedContext, deferred, flush, type TestContext } from '../../test-support/pages';
import { renderPacientes } from './lista';
import { MSG_BAJA_OK, MSG_NO_EXISTE, MSG_REACTIVADO, MSG_SIN_PERMISO, MSG_SIN_RESULTADOS } from './mensajes';

let page: Page | null = null;

afterEach(() => {
  page?.dispose?.();
  page = null;
  document.body.replaceChildren();
});

async function montar(rol: Rol, respuesta: Pagina<Paciente> = pagina([PACIENTE_ANA, PACIENTE_INACTIVO])) {
  const ctx = createLoggedContext(rol);
  ctx.pacientes.buscar.mockResolvedValue(respuesta);
  page = renderPacientes(ctx);
  document.body.append(page.element);
  await flush();
  return { ctx, root: page.element };
}

function filas(root: HTMLElement): HTMLTableRowElement[] {
  return [...root.querySelectorAll('tbody tr')].filter((r): r is HTMLTableRowElement => r instanceof HTMLTableRowElement);
}

function busqueda(root: HTMLElement): { q: HTMLInputElement; inactivos: HTMLInputElement; form: HTMLFormElement } {
  const q = root.querySelector('input[name="q"]');
  const inactivos = root.querySelector('input[name="incluirInactivos"]');
  const form = q?.closest('form');
  if (!(q instanceof HTMLInputElement) || !(inactivos instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) {
    throw new Error('sin formulario de búsqueda');
  }
  return { q, inactivos, form };
}

function buscar(root: HTMLElement, q: string, incluirInactivos = false): void {
  const b = busqueda(root);
  b.q.value = q;
  b.inactivos.checked = incluirInactivos;
  b.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function filtroDe(ctx: TestContext, index: number) {
  return ctx.pacientes.buscar.mock.calls[index]?.[0];
}

describe('carga inicial', () => {
  it('muestra "Cargando…" y después la tabla con apellido y nombre, DNI, teléfono y estado', async () => {
    const ctx = createLoggedContext('ADMIN');
    const d = deferred<Pagina<Paciente>>();
    ctx.pacientes.buscar.mockReturnValue(d.promise);
    page = renderPacientes(ctx);
    expect(page.element.querySelector('h1')?.textContent).toBe('Pacientes');
    expect(page.element.textContent).toContain('Cargando…');
    d.resolve(pagina([PACIENTE_ANA, PACIENTE_INACTIVO]));
    await flush();
    const [ana, rosa] = filas(page.element);
    expect(ana?.textContent).toContain('Pérez, Ana');
    expect(ana?.textContent).toContain('30111222');
    expect(ana?.textContent).toContain('+5491123456789');
    expect(ana?.textContent).toContain('Activo');
    expect(rosa?.textContent).toContain('Dado de baja');
    expect(rosa?.textContent).toContain('—');
    expect(filtroDe(ctx, 0)).toEqual({ q: '', incluirInactivos: false, page: 0, size: 20 });
  });

  it('vacío: muestra que no hay resultados y no crea la tabla', async () => {
    const { root } = await montar('ADMIN', pagina([]));
    expect(root.textContent).toContain(MSG_SIN_RESULTADOS);
    expect(root.querySelector('table')).toBeNull();
  });

  it('error de red: mensaje y "Reintentar", que vuelve a pedir', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.pacientes.buscar.mockRejectedValueOnce(new ApiError('network')).mockResolvedValue(pagina([PACIENTE_ANA]));
    page = renderPacientes(ctx);
    await flush();
    expect(page.element.querySelector('[role="alert"]')?.textContent).toBe('No se pudo conectar con el servidor.');
    const [reintentar] = buttons(page.element, 'Reintentar');
    reintentar?.click();
    await flush();
    expect(ctx.pacientes.buscar).toHaveBeenCalledTimes(2);
    expect(filas(page.element)).toHaveLength(1);
  });

  it('enlace a "Nuevo paciente"', async () => {
    const { root } = await montar('RECEPCION');
    expect(root.querySelector('a[href="#/pacientes/nuevo"]')?.textContent).toBe('Nuevo paciente');
  });
});

describe('búsqueda', () => {
  it('busca al enviar con el texto y la casilla, desde la página 0', async () => {
    const { ctx, root } = await montar('ADMIN');
    buscar(root, '30.111', true);
    await flush();
    expect(filtroDe(ctx, 1)).toEqual({ q: '30.111', incluirInactivos: true, page: 0, size: 20 });
  });

  it('no busca al tipear', async () => {
    const { ctx, root } = await montar('ADMIN');
    const { q } = busqueda(root);
    q.value = 'ana';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(ctx.pacientes.buscar).toHaveBeenCalledTimes(1);
  });

  it('el término buscado no va a la URL ni al título', async () => {
    const { root } = await montar('ADMIN');
    const antes = window.location.href;
    buscar(root, 'Pérez');
    await flush();
    expect(window.location.href).toBe(antes);
    expect(document.title).not.toContain('Pérez');
  });

  it('descarta la respuesta de una búsqueda anterior que llega tarde', async () => {
    const ctx = createLoggedContext('ADMIN');
    const vieja = deferred<Pagina<Paciente>>();
    const nueva = deferred<Pagina<Paciente>>();
    ctx.pacientes.buscar.mockResolvedValueOnce(pagina([])).mockReturnValueOnce(vieja.promise).mockReturnValueOnce(nueva.promise);
    page = renderPacientes(ctx);
    await flush();
    buscar(page.element, 'a');
    buscar(page.element, 'b');
    nueva.resolve(pagina([PACIENTE_LUIS]));
    await flush();
    vieja.resolve(pagina([PACIENTE_ANA]));
    await flush();
    expect(filas(page.element).map((f) => f.textContent)).toEqual([expect.stringContaining('Gómez, Luis')]);
  });
});

describe('paginación', () => {
  it('"Página N de M" y "Siguiente" pide la próxima con el mismo filtro', async () => {
    const { ctx, root } = await montar('ADMIN', pagina([PACIENTE_ANA], { totalPaginas: 3, totalElementos: 41 }));
    buscar(root, 'a', true);
    await flush();
    expect(root.textContent).toContain('Página 1 de 3');
    const [anterior] = buttons(root, 'Anterior');
    expect(anterior?.disabled).toBe(true);
    buttons(root, 'Siguiente')[0]?.click();
    await flush();
    expect(filtroDe(ctx, 2)).toEqual({ q: 'a', incluirInactivos: true, page: 1, size: 20 });
  });

  it('en la última página "Siguiente" está deshabilitado y "Anterior" vuelve', async () => {
    const { ctx, root } = await montar('ADMIN', pagina([PACIENTE_ANA], { pagina: 2, totalPaginas: 3 }));
    expect(root.textContent).toContain('Página 3 de 3');
    expect(buttons(root, 'Siguiente')[0]?.disabled).toBe(true);
    buttons(root, 'Anterior')[0]?.click();
    await flush();
    expect(filtroDe(ctx, 1)?.page).toBe(1);
  });

  it('con una sola página no muestra la paginación', async () => {
    const { root } = await montar('ADMIN', pagina([PACIENTE_ANA]));
    expect(buttons(root, 'Siguiente')).toHaveLength(0);
  });
});

describe('baja y reactivación (GESTION)', () => {
  it('"Dar de baja" pide confirmación; "Confirmar" da de baja, avisa y recarga', async () => {
    const { ctx, root } = await montar('PROFESIONAL');
    ctx.pacientes.darDeBaja.mockResolvedValue(undefined);
    buttonLabeled(root, 'Dar de baja a Pérez, Ana').click();
    expect(ctx.pacientes.darDeBaja).not.toHaveBeenCalled();
    expect(root.textContent).toContain('¿Dar de baja a Pérez, Ana?');
    buttonLabeled(root, 'Confirmar baja de Pérez, Ana').click();
    await flush();
    expect(ctx.pacientes.darDeBaja).toHaveBeenCalledWith(7);
    expect(root.querySelector('[role="status"]')?.textContent).toBe(MSG_BAJA_OK);
    expect(ctx.pacientes.buscar).toHaveBeenCalledTimes(2);
  });

  it('"Cancelar" no envía nada y vuelve a mostrar el botón', async () => {
    const { ctx, root } = await montar('ADMIN');
    buttonLabeled(root, 'Dar de baja a Pérez, Ana').click();
    buttonLabeled(root, 'Cancelar baja de Pérez, Ana').click();
    await flush();
    expect(ctx.pacientes.darDeBaja).not.toHaveBeenCalled();
    expect(buttonLabeled(root, 'Dar de baja a Pérez, Ana')).toBeDefined();
  });

  it('"Reactivar" en el inactivo reactiva, avisa y recarga', async () => {
    const { ctx, root } = await montar('ADMIN');
    ctx.pacientes.reactivar.mockResolvedValue(undefined);
    buttonLabeled(root, 'Reactivar a Díaz, Rosa').click();
    await flush();
    expect(ctx.pacientes.reactivar).toHaveBeenCalledWith(9);
    expect(root.querySelector('[role="status"]')?.textContent).toBe(MSG_REACTIVADO);
    expect(ctx.pacientes.buscar).toHaveBeenCalledTimes(2);
  });

  it('404 en la baja: avisa que ya no existe y recarga', async () => {
    const { ctx, root } = await montar('ADMIN');
    ctx.pacientes.darDeBaja.mockRejectedValue(new ApiError('unexpected', { status: 404 }));
    buttonLabeled(root, 'Dar de baja a Pérez, Ana').click();
    buttonLabeled(root, 'Confirmar baja de Pérez, Ana').click();
    await flush();
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(MSG_NO_EXISTE);
    expect(ctx.pacientes.buscar).toHaveBeenCalledTimes(2);
  });

  it('403 en la reactivación: mensaje fijo, sin recargar', async () => {
    const { ctx, root } = await montar('ADMIN');
    ctx.pacientes.reactivar.mockRejectedValue(new ApiError('forbidden', { status: 403, title: '<b>Prohibido</b>' }));
    buttonLabeled(root, 'Reactivar a Díaz, Rosa').click();
    await flush();
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(MSG_SIN_PERMISO);
    expect(root.textContent).not.toContain('Prohibido');
    expect(ctx.pacientes.buscar).toHaveBeenCalledTimes(1);
  });
});

describe('botones por rol (D2)', () => {
  it('RECEPCION: "Editar" en cada fila, sin "Dar de baja" ni "Reactivar"', async () => {
    const { root } = await montar('RECEPCION');
    expect(root.querySelector('a[href="#/pacientes/7"]')?.textContent).toBe('Editar');
    expect(root.querySelector('a[href="#/pacientes/9"]')?.textContent).toBe('Editar');
    expect(buttons(root, 'Dar de baja')).toHaveLength(0);
    expect(buttons(root, 'Reactivar')).toHaveLength(0);
  });

  it.each(['ADMIN', 'PROFESIONAL'] as const)('%s: "Dar de baja" en el activo y "Reactivar" en el inactivo', async (rol) => {
    const { root } = await montar(rol);
    expect(buttons(root, 'Dar de baja')).toHaveLength(1);
    expect(buttons(root, 'Reactivar')).toHaveLength(1);
    expect(buttonLabeled(root, 'Dar de baja a Pérez, Ana')).toBeDefined();
    expect(buttonLabeled(root, 'Reactivar a Díaz, Rosa')).toBeDefined();
  });

  it.each(['ADMIN', 'PROFESIONAL'] as const)(
    'C-12b (5.9, reemplaza el caso de C-12a): %s ve el enlace "Ficha" en cada fila, al /ficha de ese paciente',
    async (rol) => {
      const { root } = await montar(rol);
      const enlaces = [...root.querySelectorAll('a')].filter((a) => a.textContent === 'Ficha');
      expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['#/pacientes/7/ficha', '#/pacientes/9/ficha']);
      expect(enlaces.map((a) => a.getAttribute('aria-label'))).toEqual(['Ficha de Pérez, Ana', 'Ficha de Díaz, Rosa']);
    },
  );

  it('C-12b (5.9): RECEPCION no ve enlace ni botón "Ficha" ni un href a /ficha', async () => {
    const { root } = await montar('RECEPCION');
    expect([...root.querySelectorAll('a, button')].filter((el) => el.textContent === 'Ficha')).toHaveLength(0);
    expect([...root.querySelectorAll('a')].filter((a) => (a.getAttribute('href') ?? '').endsWith('/ficha'))).toHaveLength(0);
  });
});

describe('dispose', () => {
  it('una respuesta que llega después de salir no se renderiza', async () => {
    const ctx = createLoggedContext('ADMIN');
    const d = deferred<Pagina<Paciente>>();
    ctx.pacientes.buscar.mockReturnValue(d.promise);
    const p = renderPacientes(ctx);
    p.dispose?.();
    d.resolve(pagina([PACIENTE_ANA]));
    await flush();
    expect(p.element.textContent).not.toContain('Pérez');
    expect(vi.isMockFunction(ctx.pacientes.buscar)).toBe(true);
  });
});
