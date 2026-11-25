/**
 * Escape de contenido en pacientes (C-12a, tasks 6a; regla 3). Todo dato personal y todo texto del servidor se
 * muestra como texto literal: nunca se crean nodos a partir de él.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PACIENTE_ANA, pagina } from '../../api/__fixtures__/pacientesAbm';
import { ApiError } from '../../api/errors';
import type { Paciente } from '../../api/types';
import type { Page } from '../../router/router';
import { createLoggedContext, fill, flush, input, submit } from '../../test-support/pages';
import { renderNuevoPaciente, renderPaciente } from './formulario';
import { renderPacientes } from './lista';

const PAYLOADS = ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '"><svg onload=alert(1)>'] as const;

let page: Page | null = null;

afterEach(() => {
  page?.dispose?.();
  page = null;
  document.body.replaceChildren();
});

function sinNodosInyectados(): void {
  expect(document.querySelector('img')).toBeNull();
  expect(document.querySelector('script')).toBeNull();
  expect(document.querySelector('svg')).toBeNull();
  expect([...document.querySelectorAll('*')].some((el) => [...el.attributes].some((a) => a.name.startsWith('on')))).toBe(false);
}

function malicioso(payload: string): Paciente {
  return {
    ...PACIENTE_ANA,
    nombre: payload,
    apellido: `${payload}A`,
    dni: payload,
    telefono: payload,
    email: payload,
    direccion: payload,
    obraSocialTexto: payload,
    sexo: payload,
  };
}

describe.each(PAYLOADS)('payload %s', (payload) => {
  it('lista: nombre, apellido, DNI y teléfono como texto literal', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.pacientes.buscar.mockResolvedValue(pagina([malicioso(payload)]));
    page = renderPacientes(ctx);
    document.body.append(page.element);
    await flush();
    const fila = page.element.querySelector('tbody tr');
    expect(fila?.textContent).toContain(`${payload}A, ${payload}`);
    expect(fila?.querySelectorAll('td')[1]?.textContent).toBe(payload);
    expect(fila?.querySelectorAll('td')[2]?.textContent).toBe(payload);
    sinNodosInyectados();
  });

  it('lista: la confirmación de baja muestra el nombre como texto', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.pacientes.buscar.mockResolvedValue(pagina([malicioso(payload)]));
    page = renderPacientes(ctx);
    document.body.append(page.element);
    await flush();
    [...page.element.querySelectorAll('button')].find((b) => b.textContent === 'Dar de baja')?.click();
    expect(page.element.textContent).toContain(`¿Dar de baja a ${payload}A, ${payload}?`);
    sinNodosInyectados();
  });

  it('edición: cada campo queda como valor del input, sin crear nodos', async () => {
    const ctx = createLoggedContext('RECEPCION');
    ctx.pacientes.obtener.mockResolvedValue(malicioso(payload));
    page = renderPaciente(ctx, { id: 7 });
    document.body.append(page.element);
    await flush();
    for (const name of ['nombre', 'dni', 'telefono', 'email', 'direccion', 'obraSocialTexto', 'sexo']) {
      expect(input(page.element, name).value, name).toBe(payload);
    }
    expect(input(page.element, 'apellido').value).toBe(`${payload}A`);
    sinNodosInyectados();
  });

  it('alta: el texto tipeado vuelve a mostrarse tal cual tras un error del servidor', async () => {
    const ctx = createLoggedContext('RECEPCION');
    ctx.pacientes.crear.mockRejectedValue(new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'direccion', mensaje: payload }] }));
    page = renderNuevoPaciente(ctx);
    document.body.append(page.element);
    fill(page.element, { nombre: 'Ana', apellido: 'Pérez', dni: '30111222', direccion: payload, obraSocialTexto: payload });
    submit(page.element);
    await flush();
    expect(input(page.element, 'direccion').value).toBe(payload);
    // El mensaje por campo del servidor se muestra, pero como texto literal.
    expect(page.element.textContent).toContain(payload);
    sinNodosInyectados();
  });

  it('DNI duplicado: el aviso y el enlace no repiten datos del servidor', async () => {
    const ctx = createLoggedContext('RECEPCION');
    ctx.pacientes.crear.mockRejectedValue(new ApiError('conflict', { status: 409, pacienteId: 3, title: payload }));
    page = renderNuevoPaciente(ctx);
    document.body.append(page.element);
    fill(page.element, { nombre: 'Ana', apellido: 'Pérez', dni: '30111222' });
    submit(page.element);
    await flush();
    expect(page.element.querySelector('a[href="#/pacientes/3"]')?.textContent).toBe('Ver paciente existente');
    expect(page.element.textContent).not.toContain(payload);
    sinNodosInyectados();
  });

  it('403 con title malicioso: mensaje fijo, sin el title', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.pacientes.buscar.mockResolvedValue(pagina([PACIENTE_ANA]));
    ctx.pacientes.darDeBaja.mockRejectedValue(new ApiError('forbidden', { status: 403, title: payload }));
    page = renderPacientes(ctx);
    document.body.append(page.element);
    await flush();
    [...page.element.querySelectorAll('button')].find((b) => b.textContent === 'Dar de baja')?.click();
    [...page.element.querySelectorAll('button')].find((b) => b.textContent === 'Confirmar')?.click();
    await flush();
    expect(page.element.textContent).not.toContain(payload);
    sinNodosInyectados();
  });
});
