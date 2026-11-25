/** Anamnesis con control de versión (C-12b, tasks 5.4; design D5 y A-D5). */
import { afterEach, describe, expect, it } from 'vitest';
import { FICHA_V3, FICHA_VACIA } from '../../api/__fixtures__/ficha';
import { ApiError } from '../../api/errors';
import type { Ficha } from '../../api/types';
import { contextoFicha, enviar, montarFicha, seccion, textarea, type Montada } from '../../test-support/ficha';
import { buttons, deferred, errorOf, flush, select } from '../../test-support/pages';
import { MSG_CHECK_FIELDS } from '../auth/messages';
import {
  MSG_CONFIRMAR_RECARGA,
  MSG_CONSENTIMIENTO_REQUERIDO,
  MSG_FICHA_ACTUALIZADA,
  MSG_FICHA_DESACTUALIZADA,
  MSG_FICHA_GUARDADA,
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

function form(root: HTMLElement): HTMLFormElement {
  const f = seccion(root, 'Anamnesis')?.querySelector('form');
  if (!(f instanceof HTMLFormElement)) throw new Error('sin formulario de anamnesis');
  return f;
}

function anamnesis(root: HTMLElement): HTMLElement {
  const s = seccion(root, 'Anamnesis');
  if (s === null) throw new Error('sin anamnesis');
  return s;
}

const CONFLICTO = (): ApiError => new ApiError('conflict', { status: 409, codigo: 'FICHA_DESACTUALIZADA' });

describe('formulario', () => {
  it('seis áreas de texto con label, sin maxlength (no cortan en silencio, A-D5b), y embarazo de tres estados', async () => {
    const { root } = await montar();
    for (const name of ['alergias', 'medicacionActual', 'antecedentesMedicos', 'enfermedadesRelevantes', 'motivoConsulta', 'observaciones']) {
      const t = textarea(root, name);
      expect(root.querySelector(`label[for="${t.id}"]`), name).not.toBeNull();
      expect(t.hasAttribute('maxlength'), name).toBe(false);
    }
    expect([...select(root, 'embarazo').options].map((o) => [o.value, o.textContent])).toEqual([
      ['', 'Sin dato'],
      ['si', 'Sí'],
      ['no', 'No'],
    ]);
    expect(form(root).querySelector('button[type="submit"]')?.textContent).toBe('Guardar ficha');
  });

  it('se completa con la ficha del servidor; null queda vacío', async () => {
    const { root } = await montar();
    expect(textarea(root, 'alergias').value).toBe('Penicilina');
    expect(textarea(root, 'antecedentesMedicos').value).toBe('');
    expect(select(root, 'embarazo').value).toBe('no');
    expect(anamnesis(root).textContent).toContain('Última actualización: 21/11/2026 12:00');
  });

  it('ficha no cargada: campos vacíos, "Sin dato" y aviso de que no fue cargada', async () => {
    const { root } = await montar({ ficha: FICHA_VACIA });
    expect(textarea(root, 'alergias').value).toBe('');
    expect(select(root, 'embarazo').value).toBe('');
    expect(anamnesis(root).textContent).toContain('La ficha todavía no fue cargada.');
  });
});

describe('guardar', () => {
  it('primera carga: PUT con version null y los blancos en null', async () => {
    const ctx = contextoFicha({ ficha: FICHA_VACIA });
    ctx.ficha.guardarFicha.mockResolvedValue({ ...FICHA_VACIA, alergias: 'Látex', version: 0, actualizadaEn: '2026-11-25T13:00:00Z' });
    const { root } = await montar({ ficha: FICHA_VACIA }, ctx);
    textarea(root, 'alergias').value = 'Látex';
    textarea(root, 'observaciones').value = '   ';
    enviar(form(root));
    await flush();
    expect(ctx.ficha.guardarFicha).toHaveBeenCalledWith(7, {
      alergias: 'Látex',
      medicacionActual: null,
      antecedentesMedicos: null,
      enfermedadesRelevantes: null,
      embarazo: null,
      motivoConsulta: null,
      observaciones: null,
      version: null,
    });
  });

  it('guarda con la version leída y después usa la version nueva de la respuesta', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha
      .mockResolvedValueOnce({ ...FICHA_V3, alergias: 'Penicilina, látex', version: 4 })
      .mockResolvedValueOnce({ ...FICHA_V3, version: 5 });
    const { root } = await montar({}, ctx);
    textarea(root, 'alergias').value = 'Penicilina, látex';
    enviar(form(root));
    await flush();
    expect(ctx.ficha.guardarFicha.mock.calls[0]?.[1].version).toBe(3);
    expect(root.querySelector('[role="status"]')?.textContent).toBe(MSG_FICHA_GUARDADA);
    expect(textarea(root, 'alergias').value).toBe('Penicilina, látex');
    enviar(form(root));
    await flush();
    expect(ctx.ficha.guardarFicha.mock.calls[1]?.[1].version).toBe(4);
  });

  it.each([
    ['si', true],
    ['no', false],
    ['', null],
  ] as const)('embarazo %j se envía como %s', async (valor, esperado) => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockResolvedValue(FICHA_V3);
    const { root } = await montar({}, ctx);
    select(root, 'embarazo').value = valor;
    enviar(form(root));
    await flush();
    expect(ctx.ficha.guardarFicha.mock.calls[0]?.[1].embarazo).toBe(esperado);
  });

  it('un campo de más de 4000 no se envía y marca el error', async () => {
    const { ctx, root } = await montar();
    textarea(root, 'observaciones').value = 'x'.repeat(4001);
    enviar(form(root));
    await flush();
    expect(ctx.ficha.guardarFicha).not.toHaveBeenCalled();
    expect(errorOf(root, 'observaciones')).toMatch('4000');
  });

  it('un 400 del servidor marca sus campos y conserva lo escrito (A-D9)', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(
      new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'alergias', mensaje: 'el tamaño debe estar entre 0 y 4000' }] }),
    );
    const { root } = await montar({}, ctx);
    textarea(root, 'alergias').value = 'Nuevo texto';
    enviar(form(root));
    await flush();
    expect(errorOf(root, 'alergias')).toBe('el tamaño debe estar entre 0 y 4000');
    expect(anamnesis(root).querySelector('[role="alert"]')?.textContent).toBe(MSG_CHECK_FIELDS);
    expect(textarea(root, 'alergias').value).toBe('Nuevo texto');
  });

  it('un doble envío guarda una sola vez', async () => {
    const ctx = contextoFicha();
    const d = deferred<Ficha>();
    ctx.ficha.guardarFicha.mockReturnValue(d.promise);
    const { root } = await montar({}, ctx);
    enviar(form(root));
    enviar(form(root));
    d.resolve(FICHA_V3);
    await flush();
    expect(ctx.ficha.guardarFicha).toHaveBeenCalledTimes(1);
  });
});

describe('409 FICHA_DESACTUALIZADA (A-D5)', () => {
  async function conConflicto(): Promise<Montada> {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(CONFLICTO());
    const m = await montar({}, ctx);
    textarea(m.root, 'alergias').value = 'Lo que escribí yo';
    textarea(m.root, 'motivoConsulta').value = 'Dolor de muela';
    select(m.root, 'embarazo').value = 'si';
    enviar(form(m.root));
    await flush();
    return m;
  }

  it('avisa que otra persona la modificó y ofrece "Cargar la versión actual"', async () => {
    const { root } = await conConflicto();
    expect(anamnesis(root).textContent).toContain(MSG_FICHA_DESACTUALIZADA);
    expect(buttons(root, 'Cargar la versión actual')).toHaveLength(1);
  });

  it('lo escrito se conserva y no se vuelve a pedir la ficha', async () => {
    const { ctx, root } = await conConflicto();
    expect(textarea(root, 'alergias').value).toBe('Lo que escribí yo');
    expect(textarea(root, 'motivoConsulta').value).toBe('Dolor de muela');
    expect(select(root, 'embarazo').value).toBe('si');
    expect(ctx.ficha.obtenerFicha).toHaveBeenCalledTimes(1);
  });

  it('no se pisa la version: un nuevo guardado vuelve a mandar la 3', async () => {
    const { ctx, root } = await conConflicto();
    enviar(form(root));
    await flush();
    expect(ctx.ficha.guardarFicha.mock.calls.map((c) => c[1].version)).toEqual([3, 3]);
  });

  it('"Cargar la versión actual" primero pide confirmación y no pide nada todavía', async () => {
    const { ctx, root } = await conConflicto();
    buttons(root, 'Cargar la versión actual')[0]?.click();
    await flush();
    expect(anamnesis(root).textContent).toContain(MSG_CONFIRMAR_RECARGA);
    expect(buttons(root, 'Cargar y descartar mis cambios')).toHaveLength(1);
    expect(ctx.ficha.obtenerFicha).toHaveBeenCalledTimes(1);
    expect(textarea(root, 'alergias').value).toBe('Lo que escribí yo');
  });

  it('"Cancelar" en la confirmación no pide nada y deja lo escrito', async () => {
    const { ctx, root } = await conConflicto();
    buttons(root, 'Cargar la versión actual')[0]?.click();
    buttons(root, 'Cancelar')[0]?.click();
    await flush();
    expect(ctx.ficha.obtenerFicha).toHaveBeenCalledTimes(1);
    expect(textarea(root, 'alergias').value).toBe('Lo que escribí yo');
    expect(buttons(root, 'Cargar la versión actual')).toHaveLength(1);
  });

  it('confirmar carga la versión actual: reemplaza el formulario y la version, y quita el aviso', async () => {
    const { ctx, root } = await conConflicto();
    const otra: Ficha = { ...FICHA_V3, alergias: 'Lo que guardó otra persona', motivoConsulta: null, embarazo: null, version: 7 };
    ctx.ficha.obtenerFicha.mockResolvedValueOnce(otra);
    ctx.ficha.guardarFicha.mockResolvedValueOnce({ ...otra, version: 8 });
    buttons(root, 'Cargar la versión actual')[0]?.click();
    buttons(root, 'Cargar y descartar mis cambios')[0]?.click();
    await flush();
    expect(ctx.ficha.obtenerFicha).toHaveBeenCalledTimes(2);
    expect(textarea(root, 'alergias').value).toBe('Lo que guardó otra persona');
    expect(textarea(root, 'motivoConsulta').value).toBe('');
    expect(select(root, 'embarazo').value).toBe('');
    expect(anamnesis(root).textContent).not.toContain(MSG_FICHA_DESACTUALIZADA);
    expect(root.querySelector('[role="status"]')?.textContent).toBe(MSG_FICHA_ACTUALIZADA);
    enviar(form(root));
    await flush();
    expect(ctx.ficha.guardarFicha.mock.calls.at(-1)?.[1].version).toBe(7);
  });

  it('un guardado exitoso posterior también quita el aviso', async () => {
    const { ctx, root } = await conConflicto();
    ctx.ficha.guardarFicha.mockResolvedValueOnce({ ...FICHA_V3, version: 4 });
    enviar(form(root));
    await flush();
    expect(anamnesis(root).textContent).not.toContain(MSG_FICHA_DESACTUALIZADA);
  });

  it('un 409 sin código no es FICHA_DESACTUALIZADA: mensaje genérico, sin "Cargar la versión actual"', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(new ApiError('conflict', { status: 409 }));
    const { root } = await montar({}, ctx);
    enviar(form(root));
    await flush();
    expect(buttons(root, 'Cargar la versión actual')).toHaveLength(0);
    expect(anamnesis(root).querySelector('[role="alert"]')?.textContent).toBe('Ocurrió un error. Intentá de nuevo.');
  });
});

describe('texto pegado de más de 4000 (A-D5b)', () => {
  function pegar(t: HTMLTextAreaElement, valor: string): void {
    t.value = valor;
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('avisa en el momento con la cuenta y no corta el texto', async () => {
    const { root } = await montar();
    pegar(textarea(root, 'antecedentesMedicos'), 'a'.repeat(4500));
    expect(textarea(root, 'antecedentesMedicos').value).toHaveLength(4500);
    expect(errorOf(root, 'antecedentesMedicos')).toBe('Máximo 4000 caracteres (hay 4500).');
  });

  it('no se puede guardar mientras se pase: sin request y el aviso sigue', async () => {
    const { ctx, root } = await montar();
    pegar(textarea(root, 'antecedentesMedicos'), 'a'.repeat(4001));
    enviar(form(root));
    await flush();
    expect(ctx.ficha.guardarFicha).not.toHaveBeenCalled();
    expect(errorOf(root, 'antecedentesMedicos')).toBe('Máximo 4000 caracteres (hay 4001).');
    expect(textarea(root, 'antecedentesMedicos').value).toHaveLength(4001);
  });

  it('al recortarlo a 4000 se limpia el aviso y se guarda completo', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockResolvedValue(FICHA_V3);
    const { root } = await montar({}, ctx);
    pegar(textarea(root, 'antecedentesMedicos'), 'a'.repeat(4001));
    pegar(textarea(root, 'antecedentesMedicos'), 'a'.repeat(4000));
    expect(errorOf(root, 'antecedentesMedicos')).toBe('');
    enviar(form(root));
    await flush();
    expect(ctx.ficha.guardarFicha.mock.calls[0]?.[1].antecedentesMedicos).toHaveLength(4000);
  });
});

describe('dispose limpia los datos clínicos (D8)', () => {
  it('tras un 409, al salir no queda en la página ni lo escrito ni la ficha ni el paciente', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(CONFLICTO());
    const { page, root } = await montar({}, ctx);
    textarea(root, 'alergias').value = 'Texto sin guardar tras el conflicto';
    enviar(form(root));
    await flush();
    expect(root.textContent).toContain(MSG_FICHA_DESACTUALIZADA);
    page.dispose?.();
    actual = null;
    expect(root.querySelectorAll('textarea, select, input')).toHaveLength(0);
    expect(seccion(root, 'Anamnesis')).toBeNull();
    expect(seccion(root, 'Notas clínicas')).toBeNull();
    const texto = root.textContent ?? '';
    for (const dato of ['Texto sin guardar', 'Penicilina', 'Hipertensión', 'Pérez', '30111222', 'Control de rutina']) {
      expect(texto, dato).not.toContain(dato);
    }
  });

  it('una recarga pendiente que llega después de salir no vuelve a pintar datos', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(CONFLICTO());
    const { page, root } = await montar({}, ctx);
    enviar(form(root));
    await flush();
    const pendiente = deferred<Ficha>();
    ctx.ficha.obtenerFicha.mockReturnValueOnce(pendiente.promise);
    buttons(root, 'Cargar la versión actual')[0]?.click();
    buttons(root, 'Cargar y descartar mis cambios')[0]?.click();
    page.dispose?.();
    actual = null;
    pendiente.resolve({ ...FICHA_V3, alergias: 'Llegó tarde' });
    await flush();
    expect(root.textContent).not.toContain('Llegó tarde');
    expect(root.querySelectorAll('textarea')).toHaveLength(0);
  });
});

describe('409 CONSENTIMIENTO_REQUERIDO al guardar', () => {
  it('vuelve al bloqueo: la anamnesis desaparece del DOM', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(new ApiError('conflict', { status: 409, codigo: 'CONSENTIMIENTO_REQUERIDO' }));
    const { root } = await montar({}, ctx);
    enviar(form(root));
    await flush();
    expect(seccion(root, 'Anamnesis')).toBeNull();
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(MSG_CONSENTIMIENTO_REQUERIDO);
  });
});
