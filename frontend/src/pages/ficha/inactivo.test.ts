/** Paciente dado de baja: historia clínica en solo lectura (C-12b, tasks 5.6; design D6). */
import { afterEach, describe, expect, it } from 'vitest';
import { FICHA_V3, NOTA_1, NOTA_2 } from '../../api/__fixtures__/ficha';
import { PACIENTE_ANA, PACIENTE_INACTIVO, pagina } from '../../api/__fixtures__/pacientesAbm';
import { ApiError } from '../../api/errors';
import { contextoFicha, enviar, montarFicha, seccion, textarea, type Montada } from '../../test-support/ficha';
import { buttons, flush } from '../../test-support/pages';
import { MSG_INACTIVO, MSG_NO_SE_GUARDO, MSG_SIN_CONSENTIMIENTO } from './mensajes';

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

const INACTIVO = (codigo = 'PACIENTE_INACTIVO'): ApiError => new ApiError('conflict', { status: 409, codigo });

/** Ningún formulario ni control para escribir en la historia clínica. */
function sinEscritura(root: HTMLElement): void {
  expect(root.querySelectorAll('form, textarea, select, input')).toHaveLength(0);
  expect(buttons(root, 'Guardar ficha')).toHaveLength(0);
  expect(buttons(root, 'Agregar nota')).toHaveLength(0);
  expect(buttons(root, 'Registrar consentimiento')).toHaveLength(0);
}

describe('paciente dado de baja con consentimiento', () => {
  it('muestra el aviso y la anamnesis y las notas como texto, sin formularios', async () => {
    const { root } = await montar({ paciente: PACIENTE_INACTIVO });
    expect(root.textContent).toContain(MSG_INACTIVO);
    expect(seccion(root, 'Anamnesis')?.textContent).toContain('Penicilina');
    expect(seccion(root, 'Anamnesis')?.textContent).toContain('Hipertensión');
    expect(seccion(root, 'Notas clínicas')?.textContent).toContain('Control de rutina.');
    sinEscritura(root);
  });

  it('la vista de solo lectura muestra "Sin dato" en los campos vacíos y el embarazo como texto', async () => {
    const { root } = await montar({ paciente: PACIENTE_INACTIVO });
    const lectura = seccion(root, 'Anamnesis');
    const filas = [...(lectura?.querySelectorAll('dt') ?? [])].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(filas).toContainEqual(['Antecedentes médicos', 'Sin dato']);
    expect(filas).toContainEqual(['Embarazo', 'No']);
  });

  it('las notas se siguen pudiendo leer con "Ver más" (leer sí, escribir no)', async () => {
    const ctx = contextoFicha({ paciente: PACIENTE_INACTIVO });
    ctx.ficha.listarNotas
      .mockResolvedValueOnce(pagina([NOTA_1], { totalPaginas: 2 }))
      .mockResolvedValueOnce(pagina([NOTA_2], { pagina: 1, totalPaginas: 2 }));
    const { root } = await montar({ paciente: PACIENTE_INACTIVO }, ctx);
    buttons(root, 'Ver más')[0]?.click();
    await flush();
    expect(seccion(root, 'Notas clínicas')?.querySelectorAll('li.nota')).toHaveLength(2);
    sinEscritura(root);
  });
});

describe('paciente dado de baja sin consentimiento', () => {
  it('solo el aviso y "Sin consentimiento registrado."; no pide el texto, ni ficha, ni notas', async () => {
    const { ctx, root } = await montar({ paciente: PACIENTE_INACTIVO, consentimientos: [] });
    expect(root.textContent).toContain(MSG_INACTIVO);
    expect(root.textContent).toContain(MSG_SIN_CONSENTIMIENTO);
    expect(ctx.ficha.textoVigente).not.toHaveBeenCalled();
    expect(ctx.ficha.obtenerFicha).not.toHaveBeenCalled();
    expect(ctx.ficha.listarNotas).not.toHaveBeenCalled();
    expect(seccion(root, 'Consentimiento de datos de salud')).toBeNull();
    expect(seccion(root, 'Anamnesis')).toBeNull();
    sinEscritura(root);
  });
});

describe('409 PACIENTE_INACTIVO en una escritura (baja concurrente)', () => {
  it('al guardar la ficha: pasa a solo lectura con la última ficha del servidor, sin volver a pedirla', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(INACTIVO());
    const { root } = await montar({}, ctx);
    textarea(root, 'alergias').value = 'Cambio que no se pudo guardar';
    enviar(seccion(root, 'Anamnesis')?.querySelector('form') ?? null);
    await flush();
    expect(root.textContent).toContain(MSG_INACTIVO);
    // La vista de solo lectura sigue mostrando lo último confirmado por el servidor…
    expect(seccion(root, 'Anamnesis')?.querySelector('.anamnesis-lectura')?.textContent).toContain(FICHA_V3.alergias ?? '');
    expect(seccion(root, 'Notas clínicas')?.textContent).toContain('Control de rutina.');
    expect(ctx.ficha.obtenerFicha).toHaveBeenCalledTimes(1);
    expect(ctx.ficha.listarNotas).toHaveBeenCalledTimes(1);
    sinEscritura(root);
  });

  it('D6: lo escrito en la anamnesis no se descarta: queda visible como texto con el aviso', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(INACTIVO());
    const { root } = await montar({}, ctx);
    textarea(root, 'alergias').value = 'Penicilina y látex';
    textarea(root, 'observaciones').value = 'Observación nueva';
    enviar(seccion(root, 'Anamnesis')?.querySelector('form') ?? null);
    await flush();
    const anamnesis = seccion(root, 'Anamnesis');
    const sinGuardar = anamnesis?.querySelector('.sin-guardar');
    expect(sinGuardar?.textContent).toContain(MSG_NO_SE_GUARDO);
    const filas = [...(sinGuardar?.querySelectorAll('dt') ?? [])].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    // Solo los campos que cambiaron, con lo escrito tal cual.
    expect(filas).toEqual([
      ['Alergias', 'Penicilina y látex'],
      ['Observaciones', 'Observación nueva'],
    ]);
    sinEscritura(root);
  });

  it('D6: un campo vaciado y el embarazo cambiado también se muestran', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(INACTIVO());
    const { root } = await montar({}, ctx);
    textarea(root, 'medicacionActual').value = '';
    const embarazo = root.querySelector('select[name="embarazo"]');
    if (embarazo instanceof HTMLSelectElement) embarazo.value = 'si';
    enviar(seccion(root, 'Anamnesis')?.querySelector('form') ?? null);
    await flush();
    const filas = [...(seccion(root, 'Anamnesis')?.querySelectorAll('.sin-guardar dt') ?? [])].map((dt) => [
      dt.textContent,
      dt.nextElementSibling?.textContent,
    ]);
    expect(filas).toEqual([
      ['Medicación actual', 'Sin dato'],
      ['Embarazo', 'Sí'],
    ]);
  });

  it('D6: lo escrito en "Nueva nota" no se descarta: queda visible como texto con el aviso', async () => {
    const ctx = contextoFicha();
    ctx.ficha.crearNota.mockRejectedValue(INACTIVO());
    const { root } = await montar({}, ctx);
    textarea(root, 'texto').value = 'Nota que no se pudo guardar.\nSegunda línea.';
    enviar(seccion(root, 'Notas clínicas')?.querySelector('form') ?? null);
    await flush();
    const sinGuardar = seccion(root, 'Notas clínicas')?.querySelector('.sin-guardar');
    expect(sinGuardar?.textContent).toContain(MSG_NO_SE_GUARDO);
    expect(sinGuardar?.querySelector('.texto-clinico')?.textContent).toBe('Nota que no se pudo guardar.\nSegunda línea.');
    sinEscritura(root);
  });

  it('D6: lo escrito en la otra sección también se conserva (se guardaba la ficha con una nota a medio escribir)', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(INACTIVO());
    const { root } = await montar({}, ctx);
    textarea(root, 'texto').value = 'Nota a medio escribir';
    enviar(seccion(root, 'Anamnesis')?.querySelector('form') ?? null);
    await flush();
    expect(seccion(root, 'Notas clínicas')?.querySelector('.sin-guardar .texto-clinico')?.textContent).toBe('Nota a medio escribir');
    // La anamnesis no tenía cambios: no muestra bloque "sin guardar".
    expect(seccion(root, 'Anamnesis')?.querySelector('.sin-guardar')).toBeNull();
  });

  it('D6: sin nada escrito no aparece el aviso de "no se pudo guardar"', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(INACTIVO());
    const { root } = await montar({}, ctx);
    enviar(seccion(root, 'Anamnesis')?.querySelector('form') ?? null);
    await flush();
    expect(root.textContent).toContain(MSG_INACTIVO);
    expect(root.textContent).not.toContain(MSG_NO_SE_GUARDO);
  });

  it('al crear una nota: pasa a solo lectura y conserva las notas cargadas', async () => {
    const ctx = contextoFicha();
    ctx.ficha.crearNota.mockRejectedValue(INACTIVO());
    const { root } = await montar({}, ctx);
    textarea(root, 'texto').value = 'Nota';
    enviar(seccion(root, 'Notas clínicas')?.querySelector('form') ?? null);
    await flush();
    expect(root.textContent).toContain(MSG_INACTIVO);
    expect(seccion(root, 'Notas clínicas')?.querySelectorAll('li.nota')).toHaveLength(2);
    expect(ctx.ficha.listarNotas).toHaveBeenCalledTimes(1);
    sinEscritura(root);
  });

  it('al registrar el consentimiento: queda en solo lectura sin consentimiento y sin datos clínicos', async () => {
    const ctx = contextoFicha({ consentimientos: [] });
    ctx.ficha.registrarConsentimiento.mockRejectedValue(INACTIVO());
    const { root } = await montar({ consentimientos: [] }, ctx);
    const casilla = root.querySelector('input[name="aceptado"]');
    if (casilla instanceof HTMLInputElement) casilla.click();
    enviar(casilla instanceof HTMLInputElement ? casilla.closest('form') : null);
    await flush();
    expect(root.textContent).toContain(MSG_INACTIVO);
    expect(root.textContent).toContain(MSG_SIN_CONSENTIMIENTO);
    expect(ctx.ficha.obtenerFicha).not.toHaveBeenCalled();
    sinEscritura(root);
  });

  it('un paciente activo no muestra el aviso de baja', async () => {
    const { root } = await montar({ paciente: PACIENTE_ANA });
    expect(root.textContent).not.toContain(MSG_INACTIVO);
  });
});
