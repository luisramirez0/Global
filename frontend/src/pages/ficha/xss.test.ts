/**
 * Escape de contenido en la historia clínica (C-12b, tasks 6b; regla 3). Mismos payloads que la 6a de pacientes. Todo
 * dato clínico, del paciente o del servidor se muestra como texto literal: nunca se crean nodos a partir de él.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { CONSENTIMIENTO_V1, FICHA_V3, NOTA_1, TEXTO_V1 } from '../../api/__fixtures__/ficha';
import { PACIENTE_ANA, PACIENTE_INACTIVO, pagina } from '../../api/__fixtures__/pacientesAbm';
import { ApiError } from '../../api/errors';
import type { Ficha, Paciente } from '../../api/types';
import { contextoFicha, enviar, montarFicha, seccion, textarea, type Montada } from '../../test-support/ficha';
import { flush } from '../../test-support/pages';
import { CAMPOS_TEXTO_FICHA } from './validacion';

const PAYLOADS = ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '"><svg onload=alert(1)>'] as const;

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

function sinNodosInyectados(): void {
  expect(document.querySelector('img')).toBeNull();
  expect(document.querySelector('script')).toBeNull();
  expect(document.querySelector('svg')).toBeNull();
  expect([...document.querySelectorAll('*')].some((el) => [...el.attributes].some((a) => a.name.startsWith('on')))).toBe(false);
}

function fichaMaliciosa(payload: string): Ficha {
  return {
    ...FICHA_V3,
    alergias: payload,
    medicacionActual: payload,
    antecedentesMedicos: payload,
    enfermedadesRelevantes: payload,
    motivoConsulta: payload,
    observaciones: payload,
  };
}

function pacienteMalicioso(payload: string, base: Paciente = PACIENTE_ANA): Paciente {
  return { ...base, nombre: payload, apellido: `${payload}A`, dni: payload };
}

const INACTIVO = (): ApiError => new ApiError('conflict', { status: 409, codigo: 'PACIENTE_INACTIVO' });

describe.each(PAYLOADS)('payload %s', (payload) => {
  it('consentimiento: el texto vigente y su versión se muestran literales (también en la casilla)', async () => {
    const { root } = await montar({ consentimientos: [], texto: { ...TEXTO_V1, contenido: payload, version: payload } });
    const s = seccion(root, 'Consentimiento de datos de salud');
    expect(s?.querySelector('.texto-consentimiento')?.textContent).toBe(payload);
    expect(s?.textContent).toContain(`Versión ${payload}`);
    expect(s?.querySelector('label')?.textContent).toBe(`El paciente leyó y aceptó el texto de consentimiento (versión ${payload})`);
    sinNodosInyectados();
  });

  it('consentimiento registrado: la versión del consentimiento se muestra literal', async () => {
    const { root } = await montar({ consentimientos: [{ ...CONSENTIMIENTO_V1, versionTexto: payload }] });
    expect(root.querySelector('.consentimiento-ok')?.textContent).toContain(`(versión ${payload}).`);
    sinNodosInyectados();
  });

  it('anamnesis editable: cada campo queda como valor de su área de texto', async () => {
    const { root } = await montar({ ficha: fichaMaliciosa(payload) });
    for (const campo of CAMPOS_TEXTO_FICHA) {
      expect(textarea(root, campo).value, campo).toBe(payload);
    }
    sinNodosInyectados();
  });

  it('anamnesis en solo lectura (paciente dado de baja): cada campo como texto literal', async () => {
    const { root } = await montar({ paciente: PACIENTE_INACTIVO, ficha: fichaMaliciosa(payload) });
    const valores = [...(seccion(root, 'Anamnesis')?.querySelectorAll('.anamnesis-lectura dd') ?? [])].map((dd) => dd.textContent);
    expect(valores.filter((v) => v === payload)).toHaveLength(CAMPOS_TEXTO_FICHA.length);
    sinNodosInyectados();
  });

  it('notas: el texto de cada nota se muestra literal', async () => {
    const { root } = await montar({ notas: pagina([{ ...NOTA_1, texto: payload }]) });
    expect(seccion(root, 'Notas clínicas')?.querySelector('li.nota .texto-clinico')?.textContent).toBe(payload);
    sinNodosInyectados();
  });

  it('una nota nueva con el payload se agrega como texto literal', async () => {
    const ctx = contextoFicha();
    ctx.ficha.crearNota.mockResolvedValue({ ...NOTA_1, id: 80, texto: payload });
    const { root } = await montar({}, ctx);
    textarea(root, 'texto').value = payload;
    enviar(seccion(root, 'Notas clínicas')?.querySelector('form') ?? null);
    await flush();
    expect(ctx.ficha.crearNota).toHaveBeenCalledWith(7, payload);
    expect(seccion(root, 'Notas clínicas')?.querySelector('li.nota .texto-clinico')?.textContent).toBe(payload);
    sinNodosInyectados();
  });

  it('D6: lo escrito sin guardar en la anamnesis y en la nota se muestra literal tras la baja', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha.mockRejectedValue(INACTIVO());
    const { root } = await montar({}, ctx);
    textarea(root, 'alergias').value = payload;
    textarea(root, 'texto').value = payload;
    enviar(seccion(root, 'Anamnesis')?.querySelector('form') ?? null);
    await flush();
    expect(seccion(root, 'Anamnesis')?.querySelector('.sin-guardar dd')?.textContent).toBe(payload);
    expect(seccion(root, 'Notas clínicas')?.querySelector('.sin-guardar .texto-clinico')?.textContent).toBe(payload);
    sinNodosInyectados();
  });

  it('encabezado: nombre, apellido y DNI del paciente dentro de la ficha como texto literal', async () => {
    const { root } = await montar({ paciente: pacienteMalicioso(payload) });
    expect(root.querySelector('.encabezado-paciente')?.textContent).toBe(`${payload}A, ${payload} · DNI ${payload}`);
    sinNodosInyectados();
  });

  it('errores del servidor: el title de un 403 no se muestra y el mensaje por campo de un 400 aparece literal', async () => {
    const ctx = contextoFicha();
    ctx.ficha.guardarFicha
      .mockRejectedValueOnce(new ApiError('forbidden', { status: 403, title: payload }))
      .mockRejectedValueOnce(new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'alergias', mensaje: payload }] }));
    const { root } = await montar({}, ctx);
    const form = (): HTMLFormElement | null => seccion(root, 'Anamnesis')?.querySelector('form') ?? null;
    enviar(form());
    await flush();
    expect(root.textContent).not.toContain(payload);
    enviar(form());
    await flush();
    expect(seccion(root, 'Anamnesis')?.textContent).toContain(payload);
    sinNodosInyectados();
  });
});
