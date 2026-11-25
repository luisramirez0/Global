/**
 * Integración del componente de recordatorios con el cliente HTTP real (A1 de la revisión de C-14): los decoders
 * lanzan `ApiError('unexpected')` sin status, y un 201 ilegible no debe dejar "Email" habilitado (email duplicado).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../api/__fixtures__/auth';
import { RECORDATORIO_EMAIL } from '../../api/__fixtures__/recordatorios';
import { createHttpClient } from '../../api/http';
import { createRecordatoriosApi } from '../../api/recordatorios';
import { crearRegistroEnviosSinConfirmar } from '../../pages/recordatorios/dominio/enviosSinConfirmar';
import { deferred, flush } from '../../test-support/pages';
import { crearAccionesRecordatorio } from './accionesRecordatorio';

afterEach(() => {
  document.body.replaceChildren();
});

function montar(respuesta: () => Response | Promise<Response>, turnoId = 7) {
  const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(respuesta()));
  const http = createHttpClient({ baseUrl: 'http://api.test/api', fetchFn, getToken: () => 't1', onUnauthorized: () => undefined });
  const sinConfirmar = crearRegistroEnviosSinConfirmar();
  const raiz = crearAccionesRecordatorio({
    turnoId,
    etiqueta: '10:00 Pérez, Ana',
    tieneTelefono: true,
    tieneEmail: true,
    api: createRecordatoriosApi(http),
    sinConfirmar,
    alResultado: () => undefined,
  });
  document.body.append(raiz);
  return { raiz, fetchFn, sinConfirmar };
}
const email = (raiz: ParentNode): HTMLButtonElement => {
  const b = [...raiz.querySelectorAll('button')].find((x) => x.textContent === 'Email');
  if (b === undefined) throw new Error('sin Email');
  return b;
};

describe('A1: respuesta 2xx ilegible con el cliente HTTP real', () => {
  it.each([
    ['201 sin cuerpo', () => new Response(null, { status: 201 })],
    ['201 con {}', () => jsonResponse(201, {})],
    ['201 con estado desconocido', () => jsonResponse(201, { ...RECORDATORIO_EMAIL, estado: 'RARO' })],
    ['201 con un cuerpo que no es JSON', () => new Response('<html>', { status: 201 })],
  ])('%s: el turno queda sin confirmar y "Email" deshabilitado, sin reenviar', async (_n, respuesta) => {
    const { raiz, fetchFn, sinConfirmar } = montar(respuesta);
    email(raiz).click();
    await flush();
    expect(sinConfirmar.tiene(7)).toBe(true);
    expect(sinConfirmar.enviado(7)).toBe(false);
    expect(email(raiz).disabled).toBe(true);
    email(raiz).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('no lo reenvíes');
  });

  it('un 201 válido sigue siendo éxito', async () => {
    const { raiz, sinConfirmar } = montar(() => jsonResponse(201, RECORDATORIO_EMAIL));
    email(raiz).click();
    await flush();
    expect(sinConfirmar.enviado(7)).toBe(true);
    expect(sinConfirmar.tiene(7)).toBe(false);
  });

  it.each([0, -1, 1.5])('un id inválido (%s) se rechaza antes de enviar y NO queda marcado como incierto', async (id) => {
    const { raiz, fetchFn, sinConfirmar } = montar(() => jsonResponse(201, RECORDATORIO_EMAIL), id);
    email(raiz).click();
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(sinConfirmar.tiene(id)).toBe(false);
    expect(sinConfirmar.enCurso(id)).toBe(false);
    expect(email(raiz).disabled).toBe(false);
  });

  it('un 502 real sigue permitiendo reintentar', async () => {
    const { raiz, sinConfirmar } = montar(() => jsonResponse(502, { title: 'x', status: 502 }));
    email(raiz).click();
    await flush();
    expect(sinConfirmar.tiene(7)).toBe(false);
    expect(email(raiz).disabled).toBe(false);
  });
});

describe('M1: envío en curso compartido', () => {
  it.each([
    ['201 válido', () => jsonResponse(201, RECORDATORIO_EMAIL)],
    ['201 ilegible', () => new Response(null, { status: 201 })],
    ['500', () => jsonResponse(500, { title: 'x', status: 500 })],
    ['502', () => jsonResponse(502, { title: 'x', status: 502 })],
    ['503', () => jsonResponse(503, { title: 'x', status: 503 })],
    ['409', () => jsonResponse(409, { title: 'x', status: 409 })],
    ['422 email', () => jsonResponse(422, { title: 'x', status: 422, errores: [{ campo: 'email', mensaje: 'x' }] })],
    ['red', () => Promise.reject(new TypeError('Failed to fetch'))],
  ] as const)('%s: el envío deja de estar en curso al terminar el pedido', async (_n, respuesta) => {
    const { raiz, sinConfirmar } = montar(respuesta);
    email(raiz).click();
    expect(sinConfirmar.enCurso(7)).toBe(true);
    await flush();
    expect(sinConfirmar.enCurso(7)).toBe(false);
    expect(email(raiz).hasAttribute('aria-busy')).toBe(false);
  });

  it('un item reconstruido durante el pedido nace con "Email" deshabilitado y ocupado, y al resolverse un 502 se libera', async () => {
    const pedido = deferred<Response>();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => pedido.promise);
    const http = createHttpClient({ baseUrl: 'http://api.test/api', fetchFn, getToken: () => 't1', onUnauthorized: () => undefined });
    const sinConfirmar = crearRegistroEnviosSinConfirmar();
    const crear = () => {
      const r = crearAccionesRecordatorio({
        turnoId: 7, etiqueta: 'x', tieneTelefono: true, tieneEmail: true,
        api: createRecordatoriosApi(http), sinConfirmar, alResultado: () => undefined,
      });
      document.body.append(r);
      return r;
    };
    const primero = crear();
    email(primero).click();
    await flush();
    expect(sinConfirmar.enCurso(7)).toBe(true);
    const segundo = crear();
    expect(email(segundo).disabled).toBe(true);
    expect(email(segundo).getAttribute('aria-busy')).toBe('true');
    email(segundo).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    pedido.resolve(jsonResponse(502, { title: 'x', status: 502 }));
    await flush();
    expect(sinConfirmar.enCurso(7)).toBe(false);
    expect(crear()).toBeDefined();
    const tercero = document.body.lastElementChild as HTMLElement;
    expect(email(tercero).disabled).toBe(false);
    expect(email(tercero).hasAttribute('aria-busy')).toBe(false);
  });
});
