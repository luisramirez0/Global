import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_OK, ME_OK } from '../../api/__fixtures__/auth';
import { ApiError } from '../../api/errors';
import type { LoginResponse } from '../../api/types';
import { SESSION_KEY } from '../../state/session';
import { alertText, createTestContext, deferred, errorOf, fill, input, submit } from '../../test-support/pages';
import { renderLogin } from './login';

const EMAIL = 'ana@consultorio.test';
const PASSWORD = 'Segura123!';

function setup() {
  const ctx = createTestContext();
  const page = renderLogin(ctx);
  document.body.replaceChildren(page.element);
  return { ctx, page, root: page.element };
}

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('estructura accesible', () => {
  it('tiene h1, campos con label y autocomplete', () => {
    const { root, page } = setup();
    expect(page.title).toBe('Iniciar sesión');
    expect(root.querySelector('h1')?.textContent).toBe('Iniciar sesión');
    for (const [name, autocomplete] of [
      ['email', 'email'],
      ['password', 'current-password'],
    ] as const) {
      const el = input(root, name);
      expect(el.getAttribute('autocomplete')).toBe(autocomplete);
      expect(root.querySelector(`label[for="${el.id}"]`)).not.toBeNull();
    }
    expect(input(root, 'password').type).toBe('password');
    expect(root.querySelector('form')?.hasAttribute('novalidate')).toBe(true);
    expect(root.querySelector('a[href="#/registro"]')).not.toBeNull();
  });
});

describe('validación', () => {
  it('email vacío: error de campo accesible y sin request', () => {
    const { root, ctx } = setup();
    fill(root, { email: '', password: PASSWORD });
    submit(root);
    const email = input(root, 'email');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(errorOf(root, 'email')).toBe('Este campo es obligatorio.');
    expect(ctx.api.login).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(email);
  });

  it('al corregir, se limpia el error', async () => {
    const { root, ctx } = setup();
    fill(root, { email: '', password: PASSWORD });
    submit(root);
    ctx.api.login.mockResolvedValue(LOGIN_OK);
    ctx.api.me.mockResolvedValue(ME_OK);
    fill(root, { email: EMAIL });
    submit(root);
    expect(input(root, 'email').hasAttribute('aria-invalid')).toBe(false);
    expect(input(root, 'email').hasAttribute('aria-describedby')).toBe(false);
    await vi.waitFor(() => expect(ctx.navigate).toHaveBeenCalled());
  });
});

describe('envío', () => {
  it('éxito: inicia sesión, carga el perfil y navega a inicio', async () => {
    const { root, ctx } = setup();
    ctx.api.login.mockResolvedValue(LOGIN_OK);
    ctx.api.me.mockResolvedValue(ME_OK);
    fill(root, { email: ` ${EMAIL} `, password: PASSWORD });
    submit(root);
    await vi.waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith('/inicio'));
    expect(ctx.api.login).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(ctx.session.getToken()).toBe(LOGIN_OK.accessToken);
    expect(ctx.session.profile()).toEqual(ME_OK);
  });

  it('doble envío mientras está en curso: una sola request, botón deshabilitado y aria-busy', async () => {
    const { root, ctx } = setup();
    const pending = deferred<LoginResponse>();
    ctx.api.login.mockReturnValue(pending.promise);
    ctx.api.me.mockResolvedValue(ME_OK);
    fill(root, { email: EMAIL, password: PASSWORD });
    submit(root);
    submit(root);
    expect(ctx.api.login).toHaveBeenCalledTimes(1);
    expect(root.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
    expect(root.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    pending.resolve(LOGIN_OK);
    await vi.waitFor(() => expect(ctx.navigate).toHaveBeenCalled());
  });
});

describe('errores', () => {
  async function failWith(error: unknown) {
    const s = setup();
    s.ctx.api.login.mockRejectedValue(error);
    fill(s.root, { email: EMAIL, password: PASSWORD });
    submit(s.root);
    await vi.waitFor(() => expect(alertText(s.root)).not.toBe(''));
    return s;
  }

  it('401: mensaje fijo, contraseña vacía y sin sesión', async () => {
    const { root, ctx } = await failWith(new ApiError('unauthorized', { status: 401 }));
    expect(alertText(root)).toBe('Email o contraseña incorrectos.');
    expect(input(root, 'password').value).toBe('');
    expect(input(root, 'email').value).toBe(EMAIL);
    expect(ctx.session.isAuthenticated()).toBe(false);
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(root.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(false);
  });

  it('429 con Retry-After 840: pide esperar 14 minutos', async () => {
    const { root } = await failWith(new ApiError('rate_limited', { status: 429, retryAfterSeconds: 840 }));
    expect(alertText(root)).toBe('Demasiados intentos. Probá de nuevo en 14 minutos.');
  });

  it('429 con Retry-After 30: 1 minuto', async () => {
    const { root } = await failWith(new ApiError('rate_limited', { status: 429, retryAfterSeconds: 30 }));
    expect(alertText(root)).toBe('Demasiados intentos. Probá de nuevo en 1 minuto.');
  });

  it('429 sin Retry-After', async () => {
    const { root } = await failWith(new ApiError('rate_limited', { status: 429 }));
    expect(alertText(root)).toBe('Demasiados intentos. Probá de nuevo más tarde.');
  });

  it.each(['network', 'timeout'] as const)('%s: sin conexión', async (kind) => {
    const { root } = await failWith(new ApiError(kind));
    expect(alertText(root)).toBe('No se pudo conectar con el servidor.');
  });

  it.each([new ApiError('server', { status: 500 }), new ApiError('unexpected'), new TypeError('bug')])(
    'otros errores: mensaje genérico (%s)',
    async (error) => {
      const { root } = await failWith(error);
      expect(alertText(root)).toBe('Ocurrió un error. Intentá de nuevo.');
    },
  );

  it('400 del servidor se muestra en el campo', async () => {
    const { root } = await failWith(
      new ApiError('validation', { status: 400, fieldErrors: [{ campo: 'email', mensaje: 'formato inválido' }] }),
    );
    expect(errorOf(root, 'email')).toBe('formato inválido');
  });

  it('si falla me() tras el login, no queda sesión', async () => {
    const { root, ctx } = setup();
    ctx.api.login.mockResolvedValue(LOGIN_OK);
    ctx.api.me.mockRejectedValue(new ApiError('network'));
    fill(root, { email: EMAIL, password: PASSWORD });
    submit(root);
    await vi.waitFor(() => expect(alertText(root)).toBe('No se pudo conectar con el servidor.'));
    expect(ctx.session.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(ctx.navigate).not.toHaveBeenCalled();
  });
});

describe('avisos', () => {
  it('muestra el aviso pendiente (sesión vencida) una sola vez', () => {
    const ctx = createTestContext();
    ctx.flash.set('Tu sesión venció. Volvé a ingresar.');
    const page = renderLogin(ctx);
    expect(page.element.querySelector('[role="status"]')?.textContent).toBe('Tu sesión venció. Volvé a ingresar.');
    expect(renderLogin(ctx).element.querySelector('[role="status"]')).toBeNull();
  });

  it('muestra un aviso malicioso como texto', () => {
    const ctx = createTestContext();
    ctx.flash.set('<img src=x onerror=alert(1)>');
    const page = renderLogin(ctx);
    document.body.replaceChildren(page.element);
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('credenciales fuera de la consola', () => {
  it('ni login fallido ni exitoso escriben email, contraseña o token', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const { root, ctx } = setup();
    ctx.api.login.mockRejectedValueOnce(new ApiError('unauthorized', { status: 401 })).mockResolvedValueOnce(LOGIN_OK);
    ctx.api.me.mockResolvedValue(ME_OK);
    fill(root, { email: EMAIL, password: PASSWORD });
    submit(root);
    await vi.waitFor(() => expect(alertText(root)).not.toBe(''));
    fill(root, { password: PASSWORD });
    submit(root);
    await vi.waitFor(() => expect(ctx.navigate).toHaveBeenCalled());
    const logged = spies.flatMap((s) => s.mock.calls).map((args) => JSON.stringify(args)).join('\n');
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(PASSWORD);
    expect(logged).not.toContain(LOGIN_OK.accessToken);
    expect(window.location.href).not.toContain(EMAIL);
  });
});
