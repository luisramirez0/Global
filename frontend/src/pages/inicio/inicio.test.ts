import { afterEach, describe, expect, it } from 'vitest';
import { LOGIN_OK, ME_OK } from '../../api/__fixtures__/auth';
import { createTestContext } from '../../test-support/pages';
import { renderInicio } from './inicio';

const MALICIOSO = '<img src=x onerror=alert(1)>';

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
});

describe('inicio', () => {
  it('saluda al usuario y muestra el consultorio', () => {
    const ctx = createTestContext();
    ctx.session.start(LOGIN_OK.accessToken, 1800);
    ctx.session.setProfile(ME_OK);
    const page = renderInicio(ctx);
    expect(page.title).toBe('Inicio');
    expect(page.element.querySelector('h1')?.textContent).toBe('Hola, Ana');
    expect(page.element.textContent).toContain('Consultorio Sonrisas');
  });

  it('muestra datos maliciosos como texto literal', () => {
    const ctx = createTestContext();
    ctx.session.start(LOGIN_OK.accessToken, 1800);
    ctx.session.setProfile({ usuario: { ...ME_OK.usuario, nombre: MALICIOSO }, consultorio: { id: 2, nombre: MALICIOSO } });
    const page = renderInicio(ctx);
    document.body.replaceChildren(page.element);
    expect(page.element.querySelector('h1')?.textContent).toBe(`Hola, ${MALICIOSO}`);
    expect(document.querySelector('img')).toBeNull();
  });

  it('sin perfil muestra un saludo genérico', () => {
    const ctx = createTestContext();
    expect(renderInicio(ctx).element.querySelector('h1')?.textContent).toBe('Inicio');
  });
});
