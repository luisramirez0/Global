import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PACIENTE_ANA, PACIENTE_INACTIVO } from '../../api/__fixtures__/pacientes';
import { ApiError } from '../../api/errors';
import type { Paciente, Rol } from '../../api/types';
import type { Page } from '../../router/router';
import { alertText, buttons, createLoggedContext, deferred, errorOf, fill, flush, input, submit, type TestContext } from '../../test-support/pages';
import { MSG_CHECK_FIELDS, MSG_GENERIC } from '../auth/messages';
import { MSG_REQUIRED } from '../auth/validation';
import { renderNuevoPaciente, renderPaciente } from './formulario';
import { MSG_CREADO, MSG_DNI_DUPLICADO, MSG_GUARDADO, MSG_INACTIVO, MSG_NO_ENCONTRADO, MSG_REACTIVADO, MSG_SIN_PERMISO } from './mensajes';
import { MSG_DNI, MSG_FECHA_FUTURA, MSG_TELEFONO } from './validacion';

let page: Page | null = null;

beforeEach(() => {
  // 2026-11-24 a las 12:00 en Argentina.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-24T15:00:00Z'));
});

afterEach(() => {
  page?.dispose?.();
  page = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

const COMPLETO = {
  nombre: '  Ana ',
  apellido: 'Pérez',
  dni: '30.111.222',
  fechaNacimiento: '1985-04-12',
  sexo: 'F',
  telefono: '+54 9 11 2345 6789',
  email: 'ana.perez@correo.test',
  direccion: 'Calle Falsa 123',
  obraSocialTexto: 'OSDE 210',
};

function montarAlta(rol: Rol = 'RECEPCION'): { ctx: TestContext; root: HTMLElement } {
  const ctx = createLoggedContext(rol);
  page = renderNuevoPaciente(ctx);
  document.body.append(page.element);
  return { ctx, root: page.element };
}

async function montarEdicion(rol: Rol = 'RECEPCION', paciente: Paciente = PACIENTE_ANA) {
  const ctx = createLoggedContext(rol);
  ctx.pacientes.obtener.mockResolvedValue(paciente);
  page = renderPaciente(ctx, { id: paciente.id });
  document.body.append(page.element);
  await flush();
  return { ctx, root: page.element };
}

function status(root: HTMLElement): string {
  return root.querySelector('[role="status"]')?.textContent ?? '';
}

describe('alta', () => {
  it('formulario accesible con los campos de D9, ayuda del teléfono y título fijo', () => {
    const { root } = montarAlta();
    expect(root.querySelector('h1')?.textContent).toBe('Nuevo paciente');
    for (const name of Object.keys(COMPLETO)) {
      const el = input(root, name);
      expect(root.querySelector(`label[for="${el.id}"]`), name).not.toBeNull();
    }
    expect(input(root, 'fechaNacimiento').type).toBe('date');
    expect(input(root, 'telefono').type).toBe('tel');
    expect(input(root, 'email').type).toBe('email');
    expect(root.textContent).toContain('Ej.: +54 9 11 2345 6789');
    expect(input(root, 'nombre').maxLength).toBe(100);
  });

  it('envía el request normalizado, deja un aviso fijo y va al paciente creado', async () => {
    const { ctx, root } = montarAlta();
    ctx.pacientes.crear.mockResolvedValue(PACIENTE_ANA);
    fill(root, COMPLETO);
    submit(root);
    await flush();
    expect(ctx.pacientes.crear).toHaveBeenCalledWith({
      nombre: 'Ana',
      apellido: 'Pérez',
      dni: '30111222',
      fechaNacimiento: '1985-04-12',
      sexo: 'F',
      telefono: '+5491123456789',
      email: 'ana.perez@correo.test',
      direccion: 'Calle Falsa 123',
      obraSocialTexto: 'OSDE 210',
    });
    expect(ctx.flash.consume()).toBe(MSG_CREADO);
    expect(ctx.navigate).toHaveBeenCalledWith('/pacientes/7');
  });

  it('solo con los obligatorios: los opcionales van en null', async () => {
    const { ctx, root } = montarAlta();
    ctx.pacientes.crear.mockResolvedValue(PACIENTE_ANA);
    fill(root, { nombre: 'Luis', apellido: 'Gómez', dni: '4111222' });
    submit(root);
    await flush();
    expect(ctx.pacientes.crear.mock.calls[0]?.[0]).toMatchObject({ telefono: null, email: null, fechaNacimiento: null, sexo: null });
  });

  it('errores locales: no hay request y cada campo muestra su error; el primero recibe el foco', async () => {
    const { ctx, root } = montarAlta();
    fill(root, { nombre: '', apellido: 'Pérez', dni: '123', telefono: '1123456789', fechaNacimiento: '2026-11-25' });
    submit(root);
    await flush();
    expect(ctx.pacientes.crear).not.toHaveBeenCalled();
    expect(errorOf(root, 'nombre')).toBe(MSG_REQUIRED);
    expect(errorOf(root, 'dni')).toBe(MSG_DNI);
    expect(errorOf(root, 'telefono')).toBe(MSG_TELEFONO);
    expect(errorOf(root, 'fechaNacimiento')).toBe(MSG_FECHA_FUTURA);
    expect(document.activeElement).toBe(input(root, 'nombre'));
  });

  it('A-D9: un 400 del servidor que la validación local dejó pasar se muestra en sus campos y conserva lo escrito', async () => {
    const { ctx, root } = montarAlta();
    ctx.pacientes.crear.mockRejectedValue(
      new ApiError('validation', {
        status: 400,
        fieldErrors: [
          { campo: 'email', mensaje: 'debe ser una dirección de correo electrónico con formato correcto' },
          { campo: 'dni', mensaje: 'formato inválido' },
        ],
      }),
    );
    fill(root, { ...COMPLETO, email: 'ana@correo' });
    submit(root);
    await flush();
    expect(ctx.pacientes.crear).toHaveBeenCalledTimes(1);
    expect(errorOf(root, 'email')).toBe('debe ser una dirección de correo electrónico con formato correcto');
    expect(errorOf(root, 'dni')).toBe('formato inválido');
    expect(alertText(root)).toBe(MSG_CHECK_FIELDS);
    expect(input(root, 'email').value).toBe('ana@correo');
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('A-D9: un campo que el formulario no conoce va solo al aviso general fijo', async () => {
    const { ctx, root } = montarAlta();
    ctx.pacientes.crear.mockRejectedValue(new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'consultorioId', mensaje: 'x' }] }));
    fill(root, COMPLETO);
    submit(root);
    await flush();
    expect(alertText(root)).toBe(MSG_CHECK_FIELDS);
    expect(root.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });

  it('409 con pacienteId: error en DNI y enlace "Ver paciente existente"', async () => {
    const { ctx, root } = montarAlta();
    ctx.pacientes.crear.mockRejectedValue(new ApiError('conflict', { status: 409, pacienteId: 3 }));
    fill(root, COMPLETO);
    submit(root);
    await flush();
    expect(errorOf(root, 'dni')).toBe(MSG_DNI_DUPLICADO);
    const link = root.querySelector('a[href="#/pacientes/3"]');
    expect(link?.textContent).toBe('Ver paciente existente');
  });

  it('D11: un 409 sin pacienteId no es DNI duplicado: mensaje genérico, sin marcar el DNI ni enlace', async () => {
    const { ctx, root } = montarAlta();
    ctx.pacientes.crear.mockRejectedValue(new ApiError('conflict', { status: 409 }));
    fill(root, COMPLETO);
    submit(root);
    await flush();
    expect(errorOf(root, 'dni')).toBe('');
    expect(alertText(root)).toBe(MSG_GENERIC);
    expect(root.querySelector('a[href^="#/pacientes/"]:not([href="#/pacientes"])')).toBeNull();
  });

  it('D11: un 409 con pacienteId es DNI duplicado aunque traiga codigo', async () => {
    const { ctx, root } = montarAlta();
    ctx.pacientes.crear.mockRejectedValue(new ApiError('conflict', { status: 409, pacienteId: 3, codigo: 'DNI_DUPLICADO' }));
    fill(root, COMPLETO);
    submit(root);
    await flush();
    expect(errorOf(root, 'dni')).toBe(MSG_DNI_DUPLICADO);
    expect(root.querySelector('a[href="#/pacientes/3"]')?.textContent).toBe('Ver paciente existente');
    expect(root.textContent).not.toContain('DNI_DUPLICADO');
  });

  it('un segundo envío mientras el primero está pendiente no duplica el alta', async () => {
    const { ctx, root } = montarAlta();
    const d = deferred<Paciente>();
    ctx.pacientes.crear.mockReturnValue(d.promise);
    fill(root, COMPLETO);
    submit(root);
    submit(root);
    d.resolve(PACIENTE_ANA);
    await flush();
    expect(ctx.pacientes.crear).toHaveBeenCalledTimes(1);
  });

  it('error de red: mensaje fijo y lo escrito se conserva', async () => {
    const { ctx, root } = montarAlta();
    ctx.pacientes.crear.mockRejectedValue(new ApiError('network'));
    fill(root, COMPLETO);
    submit(root);
    await flush();
    expect(alertText(root)).toBe('No se pudo conectar con el servidor.');
    expect(input(root, 'apellido').value).toBe('Pérez');
  });
});

describe('edición', () => {
  it('pide el paciente por id, muestra "Cargando…" y completa el formulario', async () => {
    const ctx = createLoggedContext('RECEPCION');
    const d = deferred<Paciente>();
    ctx.pacientes.obtener.mockReturnValue(d.promise);
    page = renderPaciente(ctx, { id: 7 });
    expect(page.element.querySelector('h1')?.textContent).toBe('Paciente');
    expect(page.element.textContent).toContain('Cargando…');
    expect(page.element.querySelector('form')).toBeNull();
    d.resolve(PACIENTE_ANA);
    await flush();
    expect(ctx.pacientes.obtener).toHaveBeenCalledWith(7);
    expect(input(page.element, 'apellido').value).toBe('Pérez');
    expect(input(page.element, 'dni').value).toBe('30111222');
    expect(input(page.element, 'telefono').value).toBe('+5491123456789');
    expect(input(page.element, 'fechaNacimiento').value).toBe('1985-04-12');
    expect(page.title).toBe('Paciente');
  });

  it('guarda con PUT, avisa y muestra la versión del servidor', async () => {
    const { ctx, root } = await montarEdicion();
    ctx.pacientes.editar.mockResolvedValue({ ...PACIENTE_ANA, telefono: '+5491199999999' });
    fill(root, { telefono: '+54 9 11 9999 9999' });
    submit(root);
    await flush();
    expect(ctx.pacientes.editar).toHaveBeenCalledWith(7, expect.objectContaining({ telefono: '+5491199999999', dni: '30111222' }));
    expect(status(root)).toBe(MSG_GUARDADO);
    expect(input(root, 'telefono').value).toBe('+5491199999999');
  });

  it('muestra el aviso que dejó el alta (flash) una sola vez', async () => {
    const ctx = createLoggedContext('RECEPCION');
    ctx.flash.set(MSG_CREADO);
    ctx.pacientes.obtener.mockResolvedValue(PACIENTE_ANA);
    page = renderPaciente(ctx, { id: 7 });
    await flush();
    expect(status(page.element)).toBe(MSG_CREADO);
    expect(ctx.flash.consume()).toBeNull();
  });

  it('404 al cargar: "Paciente no encontrado" sin formulario', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.pacientes.obtener.mockRejectedValue(new ApiError('unexpected', { status: 404 }));
    page = renderPaciente(ctx, { id: 999 });
    await flush();
    expect(page.element.textContent).toContain(MSG_NO_ENCONTRADO);
    expect(page.element.querySelector('form')).toBeNull();
  });

  it('error de red al cargar: "Reintentar" vuelve a pedir', async () => {
    const ctx = createLoggedContext('ADMIN');
    ctx.pacientes.obtener.mockRejectedValueOnce(new ApiError('network')).mockResolvedValue(PACIENTE_ANA);
    page = renderPaciente(ctx, { id: 7 });
    await flush();
    expect(alertText(page.element)).toBe('No se pudo conectar con el servidor.');
    buttons(page.element, 'Reintentar')[0]?.click();
    await flush();
    expect(input(page.element, 'apellido').value).toBe('Pérez');
  });

  it('404 al guardar: "Paciente no encontrado" y sin formulario', async () => {
    const { ctx, root } = await montarEdicion();
    ctx.pacientes.editar.mockRejectedValue(new ApiError('unexpected', { status: 404 }));
    submit(root);
    await flush();
    expect(root.textContent).toContain(MSG_NO_ENCONTRADO);
    expect(root.querySelector('form')).toBeNull();
  });

  it('409 con el DNI de otro paciente: error en DNI y enlace a ese paciente', async () => {
    const { ctx, root } = await montarEdicion();
    ctx.pacientes.editar.mockRejectedValue(new ApiError('conflict', { status: 409, pacienteId: 8 }));
    fill(root, { dni: '4111222' });
    submit(root);
    await flush();
    expect(errorOf(root, 'dni')).toBe(MSG_DNI_DUPLICADO);
    expect(root.querySelector('a[href="#/pacientes/8"]')?.textContent).toBe('Ver paciente existente');
  });

  it('403 al guardar: mensaje fijo, sin el title del servidor', async () => {
    const { ctx, root } = await montarEdicion();
    ctx.pacientes.editar.mockRejectedValue(new ApiError('forbidden', { status: 403, title: 'Acceso denegado a Pérez' }));
    submit(root);
    await flush();
    expect(alertText(root)).toBe(MSG_SIN_PERMISO);
    expect(root.textContent).not.toContain('Acceso denegado');
  });

  it('un 409 con código desconocido y sin pacienteId no es DNI duplicado: mensaje genérico (A-D3, D11)', async () => {
    const { ctx, root } = await montarEdicion();
    // El 409 de DNI duplicado de C-05 siempre trae pacienteId; sin él es otro conflicto.
    ctx.pacientes.editar.mockRejectedValue(new ApiError('conflict', { status: 409, codigo: 'ALGO_NUEVO' }));
    submit(root);
    await flush();
    expect(errorOf(root, 'dni')).toBe('');
    expect(alertText(root)).toBe(MSG_GENERIC);
    expect(root.textContent).not.toContain('ALGO_NUEVO');
    const e500 = new ApiError('server', { status: 500, codigo: 'OTRO' });
    ctx.pacientes.editar.mockRejectedValue(e500);
    submit(root);
    await flush();
    expect(alertText(root)).toBe(MSG_GENERIC);
  });
});

describe('paciente dado de baja', () => {
  it.each(['ADMIN', 'PROFESIONAL'] as const)('%s ve el aviso y "Reactivar", que reactiva y recarga', async (rol) => {
    const { ctx, root } = await montarEdicion(rol, PACIENTE_INACTIVO);
    expect(root.textContent).toContain(MSG_INACTIVO);
    ctx.pacientes.reactivar.mockResolvedValue(undefined);
    ctx.pacientes.obtener.mockResolvedValue({ ...PACIENTE_INACTIVO, activo: true });
    buttons(root, 'Reactivar')[0]?.click();
    await flush();
    expect(ctx.pacientes.reactivar).toHaveBeenCalledWith(9);
    expect(status(root)).toBe(MSG_REACTIVADO);
    expect(root.textContent).not.toContain(MSG_INACTIVO);
    expect(buttons(root, 'Reactivar')).toHaveLength(0);
  });

  it('RECEPCION ve el aviso pero no "Reactivar", y puede editar', async () => {
    const { root } = await montarEdicion('RECEPCION', PACIENTE_INACTIVO);
    expect(root.textContent).toContain(MSG_INACTIVO);
    expect(buttons(root, 'Reactivar')).toHaveLength(0);
    expect(root.querySelector('form')).not.toBeNull();
  });

  it('un paciente activo no muestra el aviso ni "Reactivar"', async () => {
    const { root } = await montarEdicion('ADMIN');
    expect(root.textContent).not.toContain(MSG_INACTIVO);
    expect(buttons(root, 'Reactivar')).toHaveLength(0);
  });
});

describe('dispose y datos', () => {
  it('una carga que llega después de salir no completa el formulario', async () => {
    const ctx = createLoggedContext('ADMIN');
    const d = deferred<Paciente>();
    ctx.pacientes.obtener.mockReturnValue(d.promise);
    const p = renderPaciente(ctx, { id: 7 });
    p.dispose?.();
    d.resolve(PACIENTE_ANA);
    await flush();
    expect(p.element.querySelector('form')).toBeNull();
    expect(p.element.textContent).not.toContain('Pérez');
  });

  it('el título nunca lleva datos del paciente', async () => {
    const { root } = await montarEdicion();
    expect(page?.title).toBe('Paciente');
    expect(root.querySelector('h1')?.textContent).toBe('Paciente');
  });

  it('el flash del alta es un texto fijo, sin datos del paciente', async () => {
    const { ctx, root } = montarAlta();
    ctx.pacientes.crear.mockResolvedValue(PACIENTE_ANA);
    fill(root, COMPLETO);
    submit(root);
    await flush();
    const msg = ctx.flash.consume();
    expect(msg).toBe(MSG_CREADO);
    expect(msg).not.toContain('Pérez');
  });
});
