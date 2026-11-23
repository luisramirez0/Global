import { ApiError } from '../../api/errors';
import { applyFieldErrors, createField, createFormStatus, setBusy, type Field } from '../../components/form';
import type { Page } from '../../router/router';
import { h } from '../../utils/dom';
import { messageForError, serverFieldErrors } from '../auth/messages';
import { validateRegistro, type RegistroInput } from '../auth/validation';
import type { PageContext } from '../context';

export const MSG_EMAIL_TAKEN = 'Ya existe una cuenta con ese email.';
export const MSG_ACCOUNT_CREATED = 'Cuenta creada. Iniciá sesión.';

/** Alta de consultorio + login automático (Flujo 1, design D6, Q2). */
export function renderRegistro(ctx: PageContext): Page {
  let disposed = false;
  let busy = false;

  const field = (name: keyof RegistroInput, label: string, type: 'text' | 'email' | 'password', autocomplete: string, required = true): Field =>
    createField({ id: `registro-${name}`, name, label, type, autocomplete, required });

  const fields = [
    field('consultorioNombre', 'Nombre del consultorio', 'text', 'organization'),
    field('nombre', 'Nombre', 'text', 'given-name'),
    field('apellido', 'Apellido', 'text', 'family-name'),
    field('matricula', 'Matrícula (opcional)', 'text', 'off', false),
    field('email', 'Email', 'email', 'email'),
    field('password', 'Contraseña (mínimo 8 caracteres)', 'password', 'new-password'),
  ];
  const byName = new Map(fields.map((f) => [f.name, f]));
  const valueOf = (name: keyof RegistroInput): string => byName.get(name)?.value() ?? '';

  const status = createFormStatus();
  const button = h('button', { attrs: { type: 'submit' } }, 'Crear cuenta');
  const form = h(
    'form',
    { attrs: { novalidate: true }, on: { submit: (event) => void onSubmit(event) } },
    ...fields.map((f) => f.element),
    status.element,
    button,
  );
  const element = h(
    'section',
    { className: 'pagina-auth' },
    h('h1', {}, 'Crear cuenta'),
    form,
    h('p', {}, '¿Ya tenés cuenta? ', h('a', { attrs: { href: '#/login' } }, 'Iniciá sesión')),
  );

  async function loginAfterRegister(email: string, password: string): Promise<void> {
    try {
      const result = await ctx.api.login({ email, password });
      ctx.session.start(result.accessToken, result.expiresIn);
      ctx.session.setProfile(await ctx.api.me());
      if (!disposed) ctx.navigate('/inicio');
    } catch {
      ctx.session.end('logout');
      ctx.flash.set(MSG_ACCOUNT_CREATED);
      if (!disposed) ctx.navigate('/login');
    }
  }

  async function onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (busy) return;
    status.clear();
    const input: RegistroInput = {
      consultorioNombre: valueOf('consultorioNombre').trim(),
      nombre: valueOf('nombre').trim(),
      apellido: valueOf('apellido').trim(),
      matricula: valueOf('matricula').trim(),
      email: valueOf('email').trim(),
      password: valueOf('password'),
    };
    const errors = validateRegistro(input);
    applyFieldErrors(fields, errors);
    if (Object.keys(errors).length > 0) return;

    busy = true;
    setBusy(form, button, true);
    try {
      try {
        await ctx.api.register(input);
      } catch (error) {
        if (disposed) return;
        byName.get('password')?.setValue('');
        applyFieldErrors(fields, serverFieldErrors(error));
        status.show(messageForError(error, { conflict: MSG_EMAIL_TAKEN }));
        if (error instanceof ApiError && error.kind === 'conflict') byName.get('email')?.input.focus();
        return;
      }
      await loginAfterRegister(input.email, input.password);
    } finally {
      busy = false;
      if (!disposed) setBusy(form, button, false);
    }
  }

  return {
    title: 'Registro',
    element,
    dispose: () => {
      disposed = true;
    },
  };
}
