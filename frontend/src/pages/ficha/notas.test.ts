/** Notas clínicas inmutables (C-12b, tasks 5.5; design D7, PA-08). */
import { afterEach, describe, expect, it } from 'vitest';
import { pagina } from '../../api/__fixtures__/pacientes';
import { ApiError } from '../../api/errors';
import type { Nota } from '../../api/types';
import { contextoFicha, enviar, montarFicha, seccion, textarea, type Montada } from '../../test-support/ficha';
import { buttons, deferred, errorOf, flush } from '../../test-support/pages';
import { MSG_CHECK_FIELDS } from '../auth/messages';
import { MSG_REQUIRED } from '../auth/validation';
import {
  MSG_CONSENTIMIENTO_REQUERIDO,
  MSG_NOTA_AGREGADA,
  MSG_NOTAS_INMUTABLES,
  MSG_PROFESIONAL_NO_VINCULADO,
  MSG_SIN_NOTAS,
} from './mensajes';

let actual: Montada | null = null;

afterEach(() => {
  actual?.page.dispose?.();
  actual = null;
  document.body.replaceChildren();
});

async function montar(...args: Parameters<typeof montarFicha>): Promise<Montada> {
  actual = await montarFicha(...args);
  return actual;
}

function notas(root: HTMLElement): HTMLElement {
  const s = seccion(root, 'Notas clínicas');
  if (s === null) throw new Error('sin sección de notas');
  return s;
}

function items(root: HTMLElement): HTMLLIElement[] {
  return [...notas(root).querySelectorAll('li.nota')].filter((li): li is HTMLLIElement => li instanceof HTMLLIElement);
}

function formNota(root: HTMLElement): HTMLFormElement {
  const f = notas(root).querySelector('form');
  if (!(f instanceof HTMLFormElement)) throw new Error('sin formulario de nota');
  return f;
}

function pegar(t: HTMLTextAreaElement, valor: string): void {
  t.value = valor;
  t.dispatchEvent(new Event('input', { bubbles: true }));
}

const nota = (id: number, texto = `Nota ${id}`): Nota => ({ id, fecha: '2026-11-01T12:00:00Z', profesionalId: 5, turnoId: null, texto });

describe('listado', () => {
  it('muestra cada nota con fecha en hora de Argentina, autor por id y texto literal, en el orden recibido', async () => {
    const { root } = await montar();
    const [primera, segunda] = items(root);
    expect(primera?.querySelector('.nota-meta')?.textContent).toBe('21/11/2026 12:10 · Profesional #5');
    expect(primera?.querySelector('.texto-clinico')?.textContent).toBe('Control de rutina.');
    expect(segunda?.querySelector('.texto-clinico')?.textContent).toBe('Limpieza.\nSin novedades.');
  });

  it('sin notas: "Todavía no hay notas."', async () => {
    const { root } = await montar({ notas: pagina([]) });
    expect(notas(root).textContent).toContain(MSG_SIN_NOTAS);
    expect(items(root)).toHaveLength(0);
  });

  it('ninguna nota tiene botones de editar ni de borrar (PA-08)', async () => {
    const { root } = await montar();
    for (const li of items(root)) {
      expect(li.querySelectorAll('button, a')).toHaveLength(0);
    }
    expect(notas(root).textContent).toContain(MSG_NOTAS_INMUTABLES);
  });
});

describe('"Ver más"', () => {
  it('con más páginas pide la siguiente y la agrega al final', async () => {
    const ctx = contextoFicha({ notas: pagina([nota(10), nota(9)], { totalPaginas: 2, totalElementos: 3 }) });
    ctx.ficha.listarNotas.mockResolvedValueOnce(pagina([nota(10), nota(9)], { totalPaginas: 2, totalElementos: 3 }));
    ctx.ficha.listarNotas.mockResolvedValueOnce(pagina([nota(8)], { pagina: 1, totalPaginas: 2, totalElementos: 3 }));
    const { root } = await montar({}, ctx);
    buttons(root, 'Ver más')[0]?.click();
    await flush();
    expect(ctx.ficha.listarNotas.mock.calls[1]).toEqual([7, 1, 20]);
    expect(items(root).map((li) => li.querySelector('.texto-clinico')?.textContent)).toEqual(['Nota 10', 'Nota 9', 'Nota 8']);
    expect(buttons(root, 'Ver más')).toHaveLength(0);
  });

  it('con una sola página no aparece', async () => {
    const { root } = await montar();
    expect(buttons(root, 'Ver más')).toHaveLength(0);
  });

  it('un error al pedir más deja las notas cargadas, avisa y permite reintentar', async () => {
    const ctx = contextoFicha();
    ctx.ficha.listarNotas
      .mockResolvedValueOnce(pagina([nota(10)], { totalPaginas: 2 }))
      .mockRejectedValueOnce(new ApiError('network'))
      .mockResolvedValueOnce(pagina([nota(9)], { pagina: 1, totalPaginas: 2 }));
    const { root } = await montar({}, ctx);
    buttons(root, 'Ver más')[0]?.click();
    await flush();
    expect(notas(root).querySelector('[role="alert"]')?.textContent).toBe('No se pudo conectar con el servidor.');
    expect(items(root)).toHaveLength(1);
    const verMas = buttons(root, 'Ver más')[0];
    expect(verMas?.disabled).toBe(false);
    verMas?.click();
    await flush();
    expect(items(root)).toHaveLength(2);
  });

  it('no duplica una nota que ya se muestra (p. ej. tras agregar una nueva)', async () => {
    const ctx = contextoFicha();
    ctx.ficha.listarNotas
      .mockResolvedValueOnce(pagina([nota(10), nota(9)], { totalPaginas: 2 }))
      .mockResolvedValueOnce(pagina([nota(9), nota(8)], { pagina: 1, totalPaginas: 2 }));
    const { root } = await montar({}, ctx);
    buttons(root, 'Ver más')[0]?.click();
    await flush();
    expect(items(root).map((li) => li.querySelector('.texto-clinico')?.textContent)).toEqual(['Nota 10', 'Nota 9', 'Nota 8']);
  });

  it('mientras pide, el botón queda deshabilitado y un segundo clic no pide de nuevo', async () => {
    const ctx = contextoFicha();
    const d = deferred<ReturnType<typeof pagina<Nota>>>();
    ctx.ficha.listarNotas.mockResolvedValueOnce(pagina([nota(10)], { totalPaginas: 2 })).mockReturnValueOnce(d.promise);
    const { root } = await montar({}, ctx);
    const verMas = buttons(root, 'Ver más')[0];
    verMas?.click();
    verMas?.click();
    expect(verMas?.disabled).toBe(true);
    d.resolve(pagina([nota(9)], { pagina: 1, totalPaginas: 2 }));
    await flush();
    expect(ctx.ficha.listarNotas).toHaveBeenCalledTimes(2);
  });

  it('un 409 CONSENTIMIENTO_REQUERIDO al pedir más vuelve al bloqueo', async () => {
    const ctx = contextoFicha();
    ctx.ficha.listarNotas
      .mockResolvedValueOnce(pagina([nota(10)], { totalPaginas: 2 }))
      .mockRejectedValueOnce(new ApiError('conflict', { status: 409, codigo: 'CONSENTIMIENTO_REQUERIDO' }));
    const { root } = await montar({}, ctx);
    buttons(root, 'Ver más')[0]?.click();
    await flush();
    expect(seccion(root, 'Notas clínicas')).toBeNull();
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(MSG_CONSENTIMIENTO_REQUERIDO);
  });
});

describe('nota nueva', () => {
  it('formulario con "Nueva nota", sin maxlength (A-D5b) y "Agregar nota"', async () => {
    const { root } = await montar();
    const t = textarea(root, 'texto');
    expect(root.querySelector(`label[for="${t.id}"]`)?.textContent).toBe('Nueva nota');
    expect(t.hasAttribute('maxlength')).toBe(false);
    expect(formNota(root).querySelector('button[type="submit"]')?.textContent).toBe('Agregar nota');
  });

  it('envía el texto tal cual, sin turnoId; la nota aparece primera y el campo se vacía', async () => {
    const ctx = contextoFicha();
    const nueva = nota(60, '  Paciente refiere dolor.\n');
    ctx.ficha.crearNota.mockResolvedValue(nueva);
    const { root } = await montar({}, ctx);
    textarea(root, 'texto').value = '  Paciente refiere dolor.\n';
    enviar(formNota(root));
    await flush();
    expect(ctx.ficha.crearNota).toHaveBeenCalledWith(7, '  Paciente refiere dolor.\n');
    expect(ctx.ficha.crearNota.mock.calls[0]).toHaveLength(2);
    expect(items(root)[0]?.querySelector('.texto-clinico')?.textContent).toBe('  Paciente refiere dolor.\n');
    expect(items(root)).toHaveLength(3);
    expect(textarea(root, 'texto').value).toBe('');
    expect(root.querySelector('[role="status"]')?.textContent).toBe(MSG_NOTA_AGREGADA);
  });

  it('sin notas previas, la nueva reemplaza "Todavía no hay notas."', async () => {
    const ctx = contextoFicha({ notas: pagina([]) });
    ctx.ficha.crearNota.mockResolvedValue(nota(60));
    const { root } = await montar({ notas: pagina([]) }, ctx);
    textarea(root, 'texto').value = 'Primera';
    enviar(formNota(root));
    await flush();
    expect(notas(root).textContent).not.toContain(MSG_SIN_NOTAS);
    expect(items(root)).toHaveLength(1);
  });

  it.each(['', '   ', '\n'])('una nota en blanco %j no se envía y marca el error', async (texto) => {
    const { ctx, root } = await montar();
    textarea(root, 'texto').value = texto;
    enviar(formNota(root));
    await flush();
    expect(ctx.ficha.crearNota).not.toHaveBeenCalled();
    expect(errorOf(root, 'texto')).toBe(MSG_REQUIRED);
  });

  it('un texto pegado de más de 10000 avisa con la cuenta y no se envía (A-D5b)', async () => {
    const { ctx, root } = await montar();
    pegar(textarea(root, 'texto'), 'x'.repeat(10_050));
    expect(errorOf(root, 'texto')).toBe('Máximo 10000 caracteres (hay 10050).');
    enviar(formNota(root));
    await flush();
    expect(ctx.ficha.crearNota).not.toHaveBeenCalled();
    expect(textarea(root, 'texto').value).toHaveLength(10_050);
  });

  it('422 PROFESIONAL_NO_VINCULADO: mensaje fijo y lo escrito se conserva', async () => {
    const ctx = contextoFicha();
    ctx.ficha.crearNota.mockRejectedValue(new ApiError('validation', { status: 422, codigo: 'PROFESIONAL_NO_VINCULADO' }));
    const { root } = await montar({}, ctx);
    textarea(root, 'texto').value = 'Texto importante';
    enviar(formNota(root));
    await flush();
    expect(notas(root).querySelector('[role="alert"]')?.textContent).toBe(MSG_PROFESIONAL_NO_VINCULADO);
    expect(textarea(root, 'texto').value).toBe('Texto importante');
    expect(items(root)).toHaveLength(2);
  });

  it('un 400 del servidor con error en texto lo marca en el campo (A-D9)', async () => {
    const ctx = contextoFicha();
    ctx.ficha.crearNota.mockRejectedValue(
      new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'texto', mensaje: 'no debe estar vacío' }] }),
    );
    const { root } = await montar({}, ctx);
    textarea(root, 'texto').value = 'algo';
    enviar(formNota(root));
    await flush();
    expect(errorOf(root, 'texto')).toBe('no debe estar vacío');
    expect(notas(root).querySelector('[role="alert"]')?.textContent).toBe(MSG_CHECK_FIELDS);
  });

  it('un doble envío crea una sola nota', async () => {
    const ctx = contextoFicha();
    const d = deferred<Nota>();
    ctx.ficha.crearNota.mockReturnValue(d.promise);
    const { root } = await montar({}, ctx);
    textarea(root, 'texto').value = 'Una';
    enviar(formNota(root));
    enviar(formNota(root));
    d.resolve(nota(60));
    await flush();
    expect(ctx.ficha.crearNota).toHaveBeenCalledTimes(1);
    expect(items(root)).toHaveLength(3);
  });

  it('un 409 CONSENTIMIENTO_REQUERIDO al crear vuelve al bloqueo', async () => {
    const ctx = contextoFicha();
    ctx.ficha.crearNota.mockRejectedValue(new ApiError('conflict', { status: 409, codigo: 'CONSENTIMIENTO_REQUERIDO' }));
    const { root } = await montar({}, ctx);
    textarea(root, 'texto').value = 'x';
    enviar(formNota(root));
    await flush();
    expect(seccion(root, 'Notas clínicas')).toBeNull();
    expect(seccion(root, 'Anamnesis')).toBeNull();
  });
});
