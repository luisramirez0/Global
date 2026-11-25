import { applyFieldErrors, createField, createFormStatus, setBusy } from '../../components/form';
import { HOME_PATH } from '../../router/paths';
import type { Page } from '../../router/router';
import { h } from '../../utils/dom';
import { messageForError, serverFieldErrors } from '../auth/messages';
import { validateLogin } from '../auth/validation';
import type { PageContext } from '../context';

export const MSG_BAD_CREDENTIALS = 'Email o contraseña incorrectos.';

/** Página de inicio de sesión (Flujo 1, design D6). */
export function renderLogin(ctx: PageContext): Page {
  let disposed = false;
  let busy = false;

  const email = createField({ id: 'login-email', name: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true });
  const password = createField({
    id: 'login-password',
    name: 'password',
    label: 'Contraseña',
    type: 'password',
    autocomplete: 'current-password',
    required: true,
  });
  const fields = [email, password];
  const status = createFormStatus();
  const button = h('button', { attrs: { type: 'submit' } }, 'Ingresar');
  const form = h(
    'form',
    { attrs: { novalidate: true }, on: { submit: (event) => void onSubmit(event) } },
    email.element,
    password.element,
    status.element,
    button,
  );

  const notice = ctx.flash.consume();
  const element = h(
    'section',
    { className: 'pagina-auth' },
    h('h1', {}, 'Iniciar sesión'),
    notice === null ? null : h('p', { className: 'aviso', attrs: { role: 'status' } }, notice),
    form,
    h('p', {}, '¿Todavía no tenés cuenta? ', h('a', { attrs: { href: '#/registro' } }, 'Registrá tu consultorio')),
  );

  async function onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (busy) return;
    status.clear();
    const input = { email: email.value().trim(), password: password.value() };
    const errors = validateLogin(input);
    applyFieldErrors(fields, errors);
    if (Object.keys(errors).length > 0) return;

    busy = true;
    setBusy(form, button, true);
    let stage: 'login' | 'me' = 'login';
    try {
      const result = await ctx.api.login(input);
      ctx.session.start(result.accessToken, result.expiresIn);
      stage = 'me';
      ctx.session.setProfile(await ctx.api.me());
      if (!disposed) ctx.navigate(HOME_PATH);
    } catch (error) {
      if (stage === 'me') ctx.session.end('logout');
      if (disposed) return;
      password.setValue('');
      applyFieldErrors(fields, serverFieldErrors(error));
      status.show(stage === 'login' ? messageForError(error, { unauthorized: MSG_BAD_CREDENTIALS }) : messageForError(error));
    } finally {
      busy = false;
      if (!disposed) setBusy(form, button, false);
    }
  }

  return {
    title: 'Iniciar sesión',
    element,
    dispose: () => {
      disposed = true;
    },
  };
}
