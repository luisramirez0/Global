import { afterEach, describe, expect, it } from 'vitest';
import { ENTRADA_EXPORT, ENTRADA_FICHA, ENTRADA_LOGIN, paginaDe } from '../../api/__fixtures__/auditoria';
import { ApiError } from '../../api/errors';
import type { EntradaAuditoria, Pagina } from '../../api/types';
import { buttons, createLoggedContext, deferred, fill, flush, input, select, type TestContext } from '../../test-support/pages';
import { MSG_AUDITORIA_FILTROS, MSG_AUDITORIA_SIN_PERMISO, MSG_AUDITORIA_VACIA, renderAuditoria } from './auditoria';

const MALICIOSO = '<img src=x onerror=alert(1)>';

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
});

function montar(ctx: TestContext) {
  const page = renderAuditoria(ctx);
  document.body.append(page.element);
  return page;
}

function filtrosForm(): HTMLFormElement {
  const form = document.querySelector('form[aria-label="Filtrar auditoría"]');
  if (!(form instanceof HTMLFormElement)) throw new Error('sin formulario de filtros');
  return form;
}

function enviar(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function filas(): string[][] {
  return [...document.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? ''));
}

function conLista(pagina: Pagina<EntradaAuditoria>): TestContext {
  const ctx = createLoggedContext('ADMIN');
  ctx.auditoria.listar.mockResolvedValue(pagina);
  return ctx;
}

describe('log de auditoría (spec frontend-audit-log)', () => {
  it('pide la página 0 sin filtros y muestra una fila por entrada', async () => {
    const ctx = conLista(paginaDe([ENTRADA_FICHA, ENTRADA_LOGIN]));
    const page = montar(ctx);
    await flush();

    expect(page.title).toBe('Auditoría');
    expect(ctx.auditoria.listar).toHaveBeenCalledWith({ page: 0 });
    const [ficha, login] = filas();
    expect(ficha).toEqual(['24/11/2026 10:05', '2', 'Modificación', 'Ficha clínica', '7', 'fichaId: 3, version: 1', '127.0.0.1']);
    expect(login).toEqual(['24/11/2026 09:00', '—', 'Inicio de sesión', 'Usuario', '—', '—', '—']);
  });

  it('la fila del export muestra sus conteos', async () => {
    montar(conLista(paginaDe([ENTRADA_EXPORT])));
    await flush();
    expect(filas()[0]).toContain('consentimientos: 1, ficha: true, notas: 2, turnos: 0');
    expect(filas()[0]).toContain('Exportación');
  });

  it('una entidad o detalle maliciosos se ven como texto literal', async () => {
    montar(conLista(paginaDe([{ ...ENTRADA_FICHA, entidad: MALICIOSO, detalle: { codigo: MALICIOSO } }])));
    await flush();
    expect(document.querySelector('tbody')?.textContent).toContain(MALICIOSO);
    expect(document.querySelector('img')).toBeNull();
  });

  it('sin entradas muestra el mensaje de vacío', async () => {
    montar(conLista(paginaDe([])));
    await flush();
    expect(document.body.textContent).toContain(MSG_AUDITORIA_VACIA);
    expect(document.querySelector('tbody tr')).toBeNull();
  });

  it('muestra el estado de carga mientras espera', () => {
    const ctx = createLoggedContext('PROFESIONAL');
    ctx.auditoria.listar.mockReturnValue(deferred<Pagina<EntradaAuditoria>>().promise);
    montar(ctx);
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Cargando…');
  });

  it('un error de red ofrece Reintentar y vuelve a pedir la misma página', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.auditoria.listar.mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(paginaDe([ENTRADA_FICHA]));
    montar(ctx);
    await flush();

    expect(document.body.textContent).toContain('No se pudo conectar con el servidor.');
    buttons(document.body, 'Reintentar')[0]?.click();
    await flush();

    expect(ctx.auditoria.listar).toHaveBeenNthCalledWith(2, { page: 0 });
    expect(filas()).toHaveLength(1);
  });

  it('un 400 muestra el mensaje fijo de filtros inválidos', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.auditoria.listar.mockRejectedValue(new ApiError('validation', { status: 400 }));
    montar(ctx);
    await flush();
    expect(document.body.textContent).toContain(MSG_AUDITORIA_FILTROS);
  });

  it('un 403 muestra el mensaje de sin permiso', async () => {
    const ctx = createLoggedContext('PROFESIONAL');
    ctx.auditoria.listar.mockRejectedValue(new ApiError('forbidden', { status: 403 }));
    montar(ctx);
    await flush();
    expect(document.body.textContent).toContain(MSG_AUDITORIA_SIN_PERMISO);
  });

  it('Siguiente y Anterior piden la página con los mismos filtros', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.auditoria.listar.mockImplementation((f) => Promise.resolve(paginaDe([ENTRADA_FICHA], { pagina: f.page, totalPaginas: 3, totalElementos: 41 })));
    montar(ctx);
    await flush();
    select(document.body, 'accion').value = 'READ';
    enviar(filtrosForm());
    await flush();

    expect(document.body.textContent).toContain('Página 1 de 3');
    expect(buttons(document.body, 'Anterior')[0]?.disabled).toBe(true);
    buttons(document.body, 'Siguiente')[0]?.click();
    await flush();
    expect(ctx.auditoria.listar).toHaveBeenLastCalledWith({ accion: 'READ', page: 1 });
    expect(document.body.textContent).toContain('Página 2 de 3');

    buttons(document.body, 'Anterior')[0]?.click();
    await flush();
    expect(ctx.auditoria.listar).toHaveBeenLastCalledWith({ accion: 'READ', page: 0 });
  });

  it('en la última página Siguiente queda deshabilitado', async () => {
    montar(conLista(paginaDe([ENTRADA_FICHA], { pagina: 0, totalPaginas: 1 })));
    await flush();
    expect(buttons(document.body, 'Siguiente')[0]?.disabled).toBe(true);
  });

  it('descarta una respuesta vieja que llega después de la nueva', async () => {
    const ctx = createLoggedContext('ADMIN');
    const vieja = deferred<Pagina<EntradaAuditoria>>();
    ctx.auditoria.listar.mockReturnValueOnce(vieja.promise).mockResolvedValueOnce(paginaDe([ENTRADA_LOGIN]));
    montar(ctx);
    enviar(filtrosForm());
    await flush();
    vieja.resolve(paginaDe([ENTRADA_FICHA, ENTRADA_EXPORT]));
    await flush();

    expect(filas()).toHaveLength(1);
    expect(filas()[0]).toContain('Inicio de sesión');
  });
});

describe('filtros de la pantalla', () => {
  it('el id de entidad está deshabilitado hasta elegir una entidad', async () => {
    montar(conLista(paginaDe([])));
    await flush();
    expect(input(document.body, 'entidadId').disabled).toBe(true);

    const entidad = select(document.body, 'entidad');
    entidad.value = 'FichaClinica';
    entidad.dispatchEvent(new Event('change'));
    expect(input(document.body, 'entidadId').disabled).toBe(false);

    entidad.value = '';
    entidad.dispatchEvent(new Event('change'));
    expect(input(document.body, 'entidadId').disabled).toBe(true);
  });

  it('entidad + id + rango envían el pedido de la spec y vuelven a la página 0', async () => {
    const ctx = conLista(paginaDe([]));
    montar(ctx);
    await flush();
    const entidad = select(document.body, 'entidad');
    entidad.value = 'FichaClinica';
    entidad.dispatchEvent(new Event('change'));
    fill(document.body, { entidadId: '7', desde: '2026-11-24', hasta: '2026-11-24' });
    enviar(filtrosForm());
    await flush();

    expect(ctx.auditoria.listar).toHaveBeenLastCalledWith({
      desde: '2026-11-24T03:00:00Z',
      hasta: '2026-11-25T03:00:00Z',
      entidad: 'FichaClinica',
      entidadId: 7,
      page: 0,
    });
  });

  it('un filtro inválido marca el campo y no pide nada', async () => {
    const ctx = conLista(paginaDe([]));
    montar(ctx);
    await flush();
    fill(document.body, { usuarioId: 'abc' });
    enviar(filtrosForm());
    await flush();

    expect(ctx.auditoria.listar).toHaveBeenCalledTimes(1);
    expect(input(document.body, 'usuarioId').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('acceso por rol (spec frontend-audit-log)', () => {
  it('RECEPCION ve el mensaje de sin permiso y no se pide nada', async () => {
    const ctx = createLoggedContext('RECEPCION');
    montar(ctx);
    await flush();

    expect(document.body.textContent).toContain(MSG_AUDITORIA_SIN_PERMISO);
    expect(ctx.auditoria.listar).not.toHaveBeenCalled();
    expect(document.querySelector('table')).toBeNull();
    expect(buttons(document.body, 'Exportar')).toHaveLength(0);
  });

  it('ADMIN ve la sección de exportación y exporta por número de paciente', async () => {
    const ctx = conLista(paginaDe([]));
    ctx.auditoria.exportarPaciente.mockRejectedValue(new ApiError('unexpected', { status: 404 }));
    montar(ctx);
    await flush();

    expect(document.querySelector('h2')?.textContent).toBe('Exportar datos de un paciente');
    fill(document.body, { pacienteId: '7' });
    const form = document.querySelector('form[aria-label="Exportar datos de un paciente"]');
    if (!(form instanceof HTMLFormElement)) throw new Error('sin formulario de export');
    enviar(form);
    await flush();
    expect(ctx.auditoria.exportarPaciente).toHaveBeenCalledWith(7);
  });

  it('dispose ignora la respuesta pendiente', async () => {
    const ctx = createLoggedContext('ADMIN');
    const pendiente = deferred<Pagina<EntradaAuditoria>>();
    ctx.auditoria.listar.mockReturnValue(pendiente.promise);
    const page = montar(ctx);
    page.dispose?.();
    pendiente.resolve(paginaDe([ENTRADA_FICHA]));
    await flush();
    expect(filas()).toHaveLength(0);
  });
});
