/** Ficha restringida por rol en la UI (C-12b, tasks 5.7; design D2; supuesto PA-07). */
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import type { Page } from '../../router/router';
import { contextoFicha, llamadasClinicas, montarFicha, seccion, type Montada } from '../../test-support/ficha';
import { createTestContext, flush, type TestContext } from '../../test-support/pages';
import { renderFicha } from './ficha';
import { MSG_SIN_PERMISO, MSG_SIN_PERMISO_FICHA } from './mensajes';

let actual: Montada | null = null;
let suelta: Page | null = null;

afterEach(() => {
  actual?.page.dispose?.();
  suelta?.dispose?.();
  actual = null;
  suelta = null;
  document.body.replaceChildren();
});

/** Total de llamadas a cualquier API de pacientes o de historia clínica. */
function llamadas(ctx: TestContext): number {
  const pacientes = Object.values(ctx.pacientes).reduce((n, fn) => n + fn.mock.calls.length, 0);
  return pacientes + llamadasClinicas(ctx);
}

describe('RECEPCION', () => {
  it('ve el aviso fijo de falta de permiso y no se hace NINGUNA request', async () => {
    const { ctx, root, page } = (actual = await montarFicha({ rol: 'RECEPCION' }));
    expect(root.querySelector('h1')?.textContent).toBe('Ficha clínica');
    expect(page.title).toBe('Ficha clínica');
    expect(root.textContent).toContain(MSG_SIN_PERMISO_FICHA);
    expect(llamadas(ctx)).toBe(0);
  });

  it('no hay secciones, formularios ni datos del paciente', async () => {
    const { root } = (actual = await montarFicha({ rol: 'RECEPCION' }));
    expect(seccion(root, 'Consentimiento de datos de salud')).toBeNull();
    expect(seccion(root, 'Anamnesis')).toBeNull();
    expect(seccion(root, 'Notas clínicas')).toBeNull();
    expect(root.querySelectorAll('form, textarea, input, select')).toHaveLength(0);
    expect(root.textContent).not.toContain('Pérez');
  });

  it('tampoco hay requests después de un rato ni al salir', async () => {
    const { ctx, page } = (actual = await montarFicha({ rol: 'RECEPCION' }));
    await flush();
    page.dispose?.();
    actual = null;
    await flush();
    expect(llamadas(ctx)).toBe(0);
  });
});

describe('sin perfil cargado', () => {
  it('se trata como sin permiso: aviso y ninguna request', async () => {
    const ctx = createTestContext();
    ctx.session.start('token-de-prueba', 1800);
    suelta = renderFicha(ctx, { id: 7 });
    document.body.append(suelta.element);
    await flush();
    expect(suelta.element.textContent).toContain(MSG_SIN_PERMISO_FICHA);
    expect(llamadas(ctx)).toBe(0);
  });
});

describe.each(['ADMIN', 'PROFESIONAL'] as const)('%s', (rol) => {
  it('pide el paciente y sus consentimientos, y no ve el aviso de falta de permiso', async () => {
    const { ctx, root } = (actual = await montarFicha({ rol }));
    expect(ctx.pacientes.obtener).toHaveBeenCalledWith(7);
    expect(ctx.ficha.listarConsentimientos).toHaveBeenCalledWith(7);
    expect(root.textContent).not.toContain(MSG_SIN_PERMISO_FICHA);
    expect(seccion(root, 'Anamnesis')).not.toBeNull();
  });
});

describe('403 del backend (el backend sigue autorizando)', () => {
  it('muestra un mensaje fijo, sin el title del servidor y sin datos clínicos', async () => {
    const ctx = contextoFicha({ rol: 'PROFESIONAL' });
    ctx.ficha.listarConsentimientos.mockRejectedValue(new ApiError('forbidden', { status: 403, title: 'Acceso denegado al rol' }));
    const { root } = (actual = await montarFicha({ rol: 'PROFESIONAL' }, ctx));
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(MSG_SIN_PERMISO);
    expect(root.textContent).not.toContain('Acceso denegado');
    expect(seccion(root, 'Anamnesis')).toBeNull();
  });

  it('un 403 al pedir la ficha tampoco deja datos clínicos', async () => {
    const ctx = contextoFicha({ rol: 'ADMIN' });
    ctx.ficha.obtenerFicha.mockRejectedValue(new ApiError('forbidden', { status: 403 }));
    const { root } = (actual = await montarFicha({ rol: 'ADMIN' }, ctx));
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(MSG_SIN_PERMISO);
    expect(seccion(root, 'Anamnesis')).toBeNull();
  });
});
