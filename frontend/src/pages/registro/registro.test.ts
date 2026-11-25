import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_OK, ME_OK, REGISTRO_OK } from '../../api/__fixtures__/auth';
import { ApiError } from '../../api/errors';
import { alertText, createTestContext, errorOf, fill, input, submit } from '../../test-support/pages';
import { renderRegistro } from './registro';

const DATOS = {
  consultorioNombre: 'Consultorio Sonrisas',
  nombre: 'Ana',
  apellido: 'Pérez',
  matricula: '',
  email: 'ana@consultorio.test',
  password: 'Segura123!',
};

function setup() {
  const ctx = createTestContext();
  const page = renderRegistro(ctx);
  document.body.replaceChildren(page.element);
  return { ctx, page, root: page.element };
}

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
});

describe('estructura accesible', () => {
  it('campos con label y autocomplete', () => {
    const { root, page } = setup();
    expect(page.title).toBe('Registro');
    expect(root.querySelector('h1')?.textContent).toBe('Crear cuenta');
    for (const [name, autocomplete] of [
      ['consultorioNombre', 'organization'],
      ['nombre', 'given-name'],
      ['apellido', 'family-name'],
      ['matricula', 'off'],
      ['email', 'email'],
      ['password', 'new-password'],
    ] as const) {
      const el = input(root, name);
      expect(el.getAttribute('autocomplete')).toBe(autocomplete);
      expect(root.querySelector(`label[for="${el.id}"]`)).not.toBeNull();
    }
    expect(root.querySelector('a[href="#/login"]')).not.toBeNull();
  });
});

describe('validación en el cliente', () => {
  it('contraseña corta: error en el campo y sin request', () => {
    const { root, ctx } = setup();
    fill(root, { ...DATOS, password: '1234567' });
    submit(root);
    expect(errorOf(root, 'password')).toBe('La contraseña debe tener al menos 8 caracteres.');
    expect(input(root, 'password').getAttribute('aria-invalid')).toBe('true');
    expect(ctx.api.register).not.toHaveBeenCalled();
  });

  it('contraseña de 80 bytes: error y sin request', () => {
    const { root, ctx } = setup();
    fill(root, { ...DATOS, password: 'ñ'.repeat(40) });
    submit(root);
    expect(errorOf(root, 'password')).toBe('La contraseña es demasiado larga.');
    expect(ctx.api.register).not.toHaveBeenCalled();
  });

  it('varios errores: enfoca el primero', () => {
    const { root } = setup();
    fill(root, { ...DATOS, nombre: '', email: 'x' });
    submit(root);
    expect(errorOf(root, 'nombre')).toBe('Este campo es obligatorio.');
    expect(errorOf(root, 'email')).toBe('Ingresá un email válido.');
    expect(document.activeElement).toBe(input(root, 'nombre'));
  });
});

describe('éxito', () => {
  it('registra, inicia sesión, carga el perfil y navega a la agenda', async () => {
    const { root, ctx } = setup();
    ctx.api.register.mockResolvedValue(REGISTRO_OK);
    ctx.api.login.mockResolvedValue(LOGIN_OK);
    ctx.api.me.mockResolvedValue(ME_OK);
    fill(root, { ...DATOS, nombre: '  Ana  ', matricula: ' MN 1234 ' });
    submit(root);
    await vi.waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith('/agenda'));
    expect(ctx.api.register).toHaveBeenCalledWith({ ...DATOS, matricula: 'MN 1234' });
    expect(ctx.api.login).toHaveBeenCalledWith({ email: DATOS.email, password: DATOS.password });
    const order = [ctx.api.register, ctx.api.login, ctx.api.me].map((m) => m.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(ctx.session.profile()).toEqual(ME_OK);
  });

  it('si el login posterior falla, va a login con el aviso de cuenta creada', async () => {
    const { root, ctx } = setup();
    ctx.api.register.mockResolvedValue(REGISTRO_OK);
    ctx.api.login.mockRejectedValue(new ApiError('rate_limited', { status: 429 }));
    fill(root, DATOS);
    submit(root);
    await vi.waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith('/login'));
    expect(ctx.flash.consume()).toBe('Cuenta creada. Iniciá sesión.');
    expect(ctx.session.isAuthenticated()).toBe(false);
  });

  it('si falla me() tras el login, cierra la sesión y va a login con el aviso', async () => {
    const { root, ctx } = setup();
    ctx.api.register.mockResolvedValue(REGISTRO_OK);
    ctx.api.login.mockResolvedValue(LOGIN_OK);
    ctx.api.me.mockRejectedValue(new ApiError('network'));
    fill(root, DATOS);
    submit(root);
    await vi.waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith('/login'));
    expect(ctx.session.isAuthenticated()).toBe(false);
  });
});

describe('errores del registro', () => {
  async function failWith(error: unknown) {
    const s = setup();
    s.ctx.api.register.mockRejectedValue(error);
    fill(s.root, DATOS);
    submit(s.root);
    await vi.waitFor(() => expect(alertText(s.root)).not.toBe(''));
    return s;
  }

  it('409: email existente, sin sesión y contraseña vacía', async () => {
    const { root, ctx } = await failWith(new ApiError('conflict', { status: 409 }));
    expect(alertText(root)).toBe('Ya existe una cuenta con ese email.');
    expect(ctx.session.isAuthenticated()).toBe(false);
    expect(ctx.api.login).not.toHaveBeenCalled();
    expect(input(root, 'password').value).toBe('');
  });

  it('400 con campo conocido: error en ese campo', async () => {
    const { root } = await failWith(
      new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'matricula', mensaje: 'demasiado larga' }] }),
    );
    expect(errorOf(root, 'matricula')).toBe('demasiado larga');
    expect(alertText(root)).toBe('Revisá los datos ingresados.');
  });

  it('400 con campo desconocido: solo el resumen', async () => {
    const { root } = await failWith(
      new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'otro', mensaje: 'x' }] }),
    );
    expect(alertText(root)).toBe('Revisá los datos ingresados.');
    expect(root.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });

  it('red caída', async () => {
    const { root } = await failWith(new ApiError('network'));
    expect(alertText(root)).toBe('No se pudo conectar con el servidor.');
  });
});
