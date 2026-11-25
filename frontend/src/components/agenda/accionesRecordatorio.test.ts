/**
 * Pruebas del componente de acciones de recordatorio (tareas 3.1 a 3.3 de C-14): DOM real (jsdom), API simulada con
 * `vi.fn` tipados y errores construidos con el decodificador real de la API.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENLACE_WHATSAPP, PROBLEM_422_EMAIL, PROBLEM_422_TELEFONO, PROBLEM_502, PROBLEM_503, RECORDATORIO_EMAIL } from '../../api/__fixtures__/recordatorios';
import { ApiError, toApiError } from '../../api/errors';
import type { RecordatoriosApi } from '../../api/recordatorios';
import { crearRegistroEnviosSinConfirmar, type RegistroEnviosSinConfirmar } from '../../pages/recordatorios/dominio/enviosSinConfirmar';
import { deferred, flush } from '../../test-support/pages';
import { crearAccionesRecordatorio, type OpcionesAccionesRecordatorio, type ResultadoRecordatorio } from './accionesRecordatorio';

type ApiMock = { enlaceWhatsApp: ReturnType<typeof vi.fn<RecordatoriosApi['enlaceWhatsApp']>>; enviarEmail: ReturnType<typeof vi.fn<RecordatoriosApi['enviarEmail']>> };

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
  localStorage.clear();
});

const headers = new Headers();
const http = (status: number, body?: unknown): ApiError => toApiError(status, headers, body);

interface Montaje {
  raiz: HTMLElement;
  api: ApiMock;
  sinConfirmar: RegistroEnviosSinConfirmar;
  resultados: ResultadoRecordatorio[];
  alActualizar: ReturnType<typeof vi.fn<() => void>>;
}

function montar(opciones: Partial<OpcionesAccionesRecordatorio> = {}, sinConfirmar = crearRegistroEnviosSinConfirmar(), sinCallbackActualizar = false): Montaje {
  const api: ApiMock = { enlaceWhatsApp: vi.fn<RecordatoriosApi['enlaceWhatsApp']>(), enviarEmail: vi.fn<RecordatoriosApi['enviarEmail']>() };
  const resultados: ResultadoRecordatorio[] = [];
  const alActualizar = vi.fn<() => void>();
  const raiz = crearAccionesRecordatorio({
    turnoId: 7,
    etiqueta: '10:00 Pérez, Ana',
    tieneTelefono: true,
    tieneEmail: true,
    api,
    sinConfirmar,
    alResultado: (r) => resultados.push(r),
    ...(sinCallbackActualizar ? {} : { alActualizar }),
    ...opciones,
  });
  document.body.append(raiz);
  return { raiz, api, sinConfirmar, resultados, alActualizar };
}

function boton(raiz: ParentNode, texto: 'WhatsApp' | 'Email'): HTMLButtonElement {
  const found = [...raiz.querySelectorAll('button')].find((b) => b.textContent === texto);
  if (found === undefined) throw new Error(`sin botón ${texto}`);
  return found;
}
const enlaceAbrir = (raiz: ParentNode): HTMLAnchorElement | null => [...raiz.querySelectorAll('a')].find((a) => a.textContent === 'Abrir WhatsApp') ?? null;
const estado = (raiz: ParentNode): string => raiz.querySelector('[role="status"]')?.textContent ?? '';
const alerta = (raiz: ParentNode): string => raiz.querySelector('[role="alert"]')?.textContent ?? '';
function avisoDe(b: HTMLElement): string {
  const ids = (b.getAttribute('aria-describedby') ?? '').split(' ').filter((i) => i !== '');
  return ids.map((i) => document.getElementById(i)?.textContent ?? '').join(' ');
}

describe('3.1 acciones de WhatsApp', () => {
  it('montar no llama a la API', () => {
    const { api } = montar();
    expect(api.enlaceWhatsApp).not.toHaveBeenCalled();
    expect(api.enviarEmail).not.toHaveBeenCalled();
  });

  it('ofrece los botones WhatsApp y Email con nombre accesible que incluye la etiqueta y la ayuda de registro', () => {
    const { raiz } = montar();
    expect(boton(raiz, 'WhatsApp').getAttribute('aria-label')).toBe('WhatsApp, 10:00 Pérez, Ana');
    expect(boton(raiz, 'Email').getAttribute('aria-label')).toBe('Email, 10:00 Pérez, Ana');
    expect(raiz.textContent).toContain('Cada enlace generado queda registrado.');
  });

  it('un clic hace un solo pedido y mientras dura el botón está disabled con aria-busy; el doble clic no duplica', async () => {
    const pedido = deferred<typeof ENLACE_WHATSAPP>();
    const { raiz, api } = montar();
    api.enlaceWhatsApp.mockReturnValue(pedido.promise);
    const b = boton(raiz, 'WhatsApp');
    b.click();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(api.enlaceWhatsApp).toHaveBeenCalledTimes(1);
    expect(api.enlaceWhatsApp).toHaveBeenCalledWith(7);
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
    pedido.resolve(ENLACE_WHATSAPP);
    await flush();
    expect(b.disabled).toBe(false);
    expect(b.hasAttribute('aria-busy')).toBe(false);
  });

  it('200: muestra "Abrir WhatsApp" con href exacto, nueva pestaña segura, foco, anuncio y resultado', async () => {
    const { raiz, api, resultados } = montar();
    api.enlaceWhatsApp.mockResolvedValue(ENLACE_WHATSAPP);
    boton(raiz, 'WhatsApp').click();
    await flush();
    const a = enlaceAbrir(raiz);
    expect(a).not.toBeNull();
    expect(a?.getAttribute('href')).toBe(ENLACE_WHATSAPP.enlace);
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.rel.split(' ')).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    expect(document.activeElement).toBe(a);
    expect(raiz.querySelector('[role="status"]')?.textContent).toBe('Enlace de WhatsApp listo.');
    expect(resultados).toEqual(['whatsappGenerado']);
  });

  it('otro clic genera otro enlace y reemplaza el anterior (un solo "Abrir WhatsApp")', async () => {
    const { raiz, api, resultados } = montar();
    api.enlaceWhatsApp
      .mockResolvedValueOnce(ENLACE_WHATSAPP)
      .mockResolvedValueOnce({ ...ENLACE_WHATSAPP, recordatorioId: 99, enlace: 'https://wa.me/5491199998888?text=otro' });
    boton(raiz, 'WhatsApp').click();
    await flush();
    boton(raiz, 'WhatsApp').click();
    await flush();
    expect(api.enlaceWhatsApp).toHaveBeenCalledTimes(2);
    const enlaces = [...raiz.querySelectorAll('a')].filter((a) => a.textContent === 'Abrir WhatsApp');
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]?.getAttribute('href')).toBe('https://wa.me/5491199998888?text=otro');
    expect(resultados).toEqual(['whatsappGenerado', 'whatsappGenerado']);
  });

  it('tieneTelefono false: botón deshabilitado con aviso por aria-describedby y clic sin pedido', async () => {
    const { raiz, api } = montar({ tieneTelefono: false });
    const b = boton(raiz, 'WhatsApp');
    expect(b.disabled).toBe(true);
    expect(avisoDe(b)).toBe('El paciente no tiene teléfono cargado.');
    b.click();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(api.enlaceWhatsApp).not.toHaveBeenCalled();
    expect(boton(raiz, 'Email').disabled).toBe(false);
  });

  it('tieneTelefono true no muestra el aviso de teléfono', () => {
    const { raiz } = montar({ tieneTelefono: true });
    expect(boton(raiz, 'WhatsApp').hasAttribute('aria-describedby')).toBe(false);
  });

  it('tieneTelefono null + 422 telefono: queda deshabilitado con el mismo aviso y el foco no se pierde', async () => {
    const { raiz, api, resultados } = montar({ tieneTelefono: null });
    api.enlaceWhatsApp.mockRejectedValue(http(422, PROBLEM_422_TELEFONO));
    const b = boton(raiz, 'WhatsApp');
    b.focus();
    b.click();
    await flush();
    expect(b.disabled).toBe(true);
    expect(avisoDe(b)).toBe('El paciente no tiene teléfono cargado.');
    expect(raiz.contains(document.activeElement)).toBe(true);
    expect(enlaceAbrir(raiz)).toBeNull();
    expect(resultados).toEqual([]);
  });

  it('timeout: mensaje de enlace posiblemente generado y botón habilitado de nuevo', async () => {
    const { raiz, api } = montar();
    api.enlaceWhatsApp.mockRejectedValue(new ApiError('timeout'));
    boton(raiz, 'WhatsApp').click();
    await flush();
    expect(alerta(raiz)).toBe('No se recibió respuesta. Es posible que el enlace se haya generado; si volvés a intentarlo quedará otro registro.');
    expect(boton(raiz, 'WhatsApp').disabled).toBe(false);
    expect(enlaceAbrir(raiz)).toBeNull();
  });

  it('un pedido nuevo borra el mensaje de error anterior', async () => {
    const { raiz, api } = montar();
    api.enlaceWhatsApp.mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(ENLACE_WHATSAPP);
    boton(raiz, 'WhatsApp').click();
    await flush();
    expect(alerta(raiz)).toBe('No se pudo conectar con el servidor.');
    boton(raiz, 'WhatsApp').click();
    await flush();
    expect(alerta(raiz)).toBe('');
    expect(estado(raiz)).toBe('Enlace de WhatsApp listo.');
  });
});

describe('3.2 acciones de email', () => {
  it('201: anuncia "Email enviado." y avisa el resultado', async () => {
    const { raiz, api, resultados } = montar();
    api.enviarEmail.mockResolvedValue(RECORDATORIO_EMAIL);
    boton(raiz, 'Email').click();
    await flush();
    expect(api.enviarEmail).toHaveBeenCalledWith(7);
    expect(estado(raiz)).toBe('Email enviado.');
    expect(resultados).toEqual(['emailEnviado']);
    expect(alerta(raiz)).toBe('');
  });

  it('en curso: aria-busy y deshabilitado; un segundo clic no envía otro pedido', async () => {
    const pedido = deferred<typeof RECORDATORIO_EMAIL>();
    const { raiz, api } = montar();
    api.enviarEmail.mockReturnValue(pedido.promise);
    const b = boton(raiz, 'Email');
    b.click();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(api.enviarEmail).toHaveBeenCalledTimes(1);
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
    pedido.resolve(RECORDATORIO_EMAIL);
    await flush();
    expect(b.hasAttribute('aria-busy')).toBe(false);
    // Tras el 201 queda deshabilitado de forma permanente (envío exitoso pegajoso).
    expect(b.disabled).toBe(true);
  });

  it('tieneEmail false: deshabilitado con aviso por aria-describedby y clic sin pedido', async () => {
    const { raiz, api } = montar({ tieneEmail: false });
    const b = boton(raiz, 'Email');
    expect(b.disabled).toBe(true);
    expect(avisoDe(b)).toBe('El paciente no tiene email cargado.');
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(api.enviarEmail).not.toHaveBeenCalled();
    expect(boton(raiz, 'WhatsApp').disabled).toBe(false);
  });

  it('422 email con tieneEmail null: queda deshabilitado con el aviso de email', async () => {
    const { raiz, api } = montar({ tieneEmail: null });
    api.enviarEmail.mockRejectedValue(http(422, PROBLEM_422_EMAIL));
    boton(raiz, 'Email').click();
    await flush();
    expect(boton(raiz, 'Email').disabled).toBe(true);
    expect(avisoDe(boton(raiz, 'Email'))).toBe('El paciente no tiene email cargado.');
  });

  it('502: mensaje de reintento, botón habilitado de nuevo y turno sin marca de sin confirmar', async () => {
    const { raiz, api, sinConfirmar, resultados } = montar();
    api.enviarEmail.mockRejectedValue(http(502, PROBLEM_502));
    boton(raiz, 'Email').click();
    await flush();
    expect(alerta(raiz)).toBe('No se pudo enviar el email. Probá más tarde o usá WhatsApp.');
    expect(boton(raiz, 'Email').disabled).toBe(false);
    expect(sinConfirmar.tiene(7)).toBe(false);
    expect(resultados).toEqual([]);
  });

  it('503: mensaje de no disponible, sin "Probá más tarde" y sin marca', async () => {
    const { raiz, api, sinConfirmar } = montar();
    api.enviarEmail.mockRejectedValue(http(503, PROBLEM_503));
    boton(raiz, 'Email').click();
    await flush();
    expect(alerta(raiz)).toBe('El envío de emails no está disponible en este momento.');
    expect(alerta(raiz)).not.toContain('Probá más tarde');
    expect(sinConfirmar.tiene(7)).toBe(false);
    expect(boton(raiz, 'Email').disabled).toBe(false);
  });

  it.each([
    ['500', () => http(500)],
    ['timeout', () => new ApiError('timeout')],
    ['network', () => new ApiError('network')],
  ])('%s: resultado incierto, marca en memoria, Email bloqueado con aviso y WhatsApp habilitado', async (_n, crear) => {
    const { raiz, api, sinConfirmar, resultados } = montar();
    api.enviarEmail.mockRejectedValue(crear());
    boton(raiz, 'Email').click();
    await flush();
    expect(alerta(raiz)).toBe(
      'No se pudo confirmar el envío. Es posible que el email ya le haya llegado al paciente: no lo reenvíes sin verificarlo.',
    );
    expect(alerta(raiz).toLowerCase()).not.toContain('reintentar');
    expect(alerta(raiz)).not.toContain('Probá más tarde');
    expect(sinConfirmar.tiene(7)).toBe(true);
    const b = boton(raiz, 'Email');
    expect(b.disabled).toBe(true);
    expect(avisoDe(b)).toBe('Envío por email sin confirmar: verificá con el paciente.');
    expect(boton(raiz, 'WhatsApp').disabled).toBe(false);
    expect(resultados).toEqual(['emailSinConfirmar']);
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(api.enviarEmail).toHaveBeenCalledTimes(1);
  });

  it('tras un resultado incierto con el foco en Email, el foco queda dentro del componente', async () => {
    const { raiz, api } = montar();
    api.enviarEmail.mockRejectedValue(http(500));
    boton(raiz, 'Email').focus();
    boton(raiz, 'Email').click();
    await flush();
    expect(raiz.contains(document.activeElement)).toBe(true);
  });

  it('montar con el id ya marcado: Email nace deshabilitado con el aviso y sin pedido', async () => {
    const sinConfirmar = crearRegistroEnviosSinConfirmar();
    sinConfirmar.marcar(7);
    const { raiz, api } = montar({}, sinConfirmar);
    const b = boton(raiz, 'Email');
    expect(b.disabled).toBe(true);
    expect(avisoDe(b)).toBe('Envío por email sin confirmar: verificá con el paciente.');
    expect(api.enviarEmail).not.toHaveBeenCalled();
    expect(boton(raiz, 'WhatsApp').disabled).toBe(false);
  });

  it('montar con otro id marcado no bloquea este turno', () => {
    const sinConfirmar = crearRegistroEnviosSinConfirmar();
    sinConfirmar.marcar(99);
    const { raiz } = montar({}, sinConfirmar);
    expect(boton(raiz, 'Email').disabled).toBe(false);
  });

  it.each([
    ['409', 'El turno ya no admite recordatorios (cambió de estado).', 409],
    ['404', 'El turno ya no existe.', 404],
  ])('%s: mensaje de estado y botón "Actualizar" que llama al callback', async (_n, texto, status) => {
    const { raiz, api, alActualizar } = montar();
    api.enviarEmail.mockRejectedValue(http(status, { title: 'Texto del servidor' }));
    boton(raiz, 'Email').click();
    await flush();
    expect(alerta(raiz)).toContain(texto);
    expect(alerta(raiz)).not.toContain('Texto del servidor');
    const actualizar = [...raiz.querySelectorAll('button')].find((b) => b.textContent === 'Actualizar');
    expect(actualizar).toBeDefined();
    actualizar?.click();
    expect(alActualizar).toHaveBeenCalledTimes(1);
  });

  it('409 en WhatsApp también ofrece "Actualizar"; sin callback no se ofrece', async () => {
    const a = montar();
    a.api.enlaceWhatsApp.mockRejectedValue(http(409));
    boton(a.raiz, 'WhatsApp').click();
    await flush();
    expect([...a.raiz.querySelectorAll('button')].some((b) => b.textContent === 'Actualizar')).toBe(true);
    const b = montar({}, undefined, true);
    b.api.enlaceWhatsApp.mockRejectedValue(http(409));
    boton(b.raiz, 'WhatsApp').click();
    await flush();
    expect([...b.raiz.querySelectorAll('button')].some((x) => x.textContent === 'Actualizar')).toBe(false);
  });

  it('403 muestra el mensaje de falta de permiso', async () => {
    const { raiz, api } = montar();
    api.enviarEmail.mockRejectedValue(http(403));
    boton(raiz, 'Email').click();
    await flush();
    expect(alerta(raiz)).toBe('No tenés permiso para realizar esta acción.');
  });

  it('el title del servidor nunca se muestra', async () => {
    const { raiz, api } = montar();
    api.enviarEmail.mockRejectedValue(http(502, { ...PROBLEM_502, title: 'Texto del servidor' }));
    boton(raiz, 'Email').click();
    await flush();
    expect(raiz.textContent).not.toContain('Texto del servidor');
  });
});

describe('3.3 seguridad del componente', () => {
  const HOSTIL = '<img src=x onerror=alert(1)> Malo, <b>Ana</b>';

  it('una etiqueta con HTML queda como texto literal en el nombre accesible y no crea nodos', () => {
    const { raiz } = montar({ etiqueta: HOSTIL });
    expect(document.querySelector('img')).toBeNull();
    expect(raiz.querySelector('b')).toBeNull();
    expect(boton(raiz, 'WhatsApp').getAttribute('aria-label')).toBe(`WhatsApp, ${HOSTIL}`);
    expect(boton(raiz, 'Email').getAttribute('aria-label')).toBe(`Email, ${HOSTIL}`);
  });

  it('el enlace y el nombre no llegan a console.* ni al almacenamiento tras generar el enlace y tras un 502', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const { raiz, api } = montar({ etiqueta: HOSTIL });
    api.enlaceWhatsApp.mockResolvedValue(ENLACE_WHATSAPP);
    boton(raiz, 'WhatsApp').click();
    await flush();
    api.enviarEmail.mockRejectedValue(http(502, PROBLEM_502));
    boton(raiz, 'Email').click();
    await flush();
    for (const espia of espias) {
      expect(espia).not.toHaveBeenCalled();
      expect(JSON.stringify(espia.mock.calls)).not.toContain('wa.me');
    }
    expect(JSON.stringify({ ...localStorage })).not.toContain('wa.me');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('wa.me');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(location.hash).not.toContain('wa.me');
    expect(location.href).not.toContain('wa.me');
    vi.restoreAllMocks();
  });

  it('un resultado incierto del email tampoco escribe en consola ni en el almacenamiento', async () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { raiz, api } = montar({ etiqueta: HOSTIL });
    api.enviarEmail.mockRejectedValue(http(500));
    boton(raiz, 'Email').click();
    await flush();
    expect(espia).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    vi.restoreAllMocks();
  });

  it('el href solo aparece en el <a>: ningún otro nodo ni atributo lo contiene', async () => {
    const { raiz, api } = montar();
    api.enlaceWhatsApp.mockResolvedValue(ENLACE_WHATSAPP);
    boton(raiz, 'WhatsApp').click();
    await flush();
    expect(raiz.textContent).not.toContain('wa.me');
    const conEnlace = [...raiz.querySelectorAll('*')].filter((el) => [...el.attributes].some((a) => a.value.includes('wa.me')));
    expect(conEnlace).toHaveLength(1);
    expect(conEnlace[0]?.tagName).toBe('A');
  });
});

describe('3.2 (C-14 ajuste) envío exitoso pegajoso en la sesión', () => {
  const AVISO_ENVIADO = 'Recordatorio enviado por email.';

  it('201: Email queda deshabilitado con "Recordatorio enviado por email.", registrado como enviado, y un clic no repite el pedido', async () => {
    const { raiz, api, sinConfirmar } = montar();
    api.enviarEmail.mockResolvedValue(RECORDATORIO_EMAIL);
    boton(raiz, 'Email').click();
    await flush();
    const b = boton(raiz, 'Email');
    expect(sinConfirmar.enviado(7)).toBe(true);
    expect(sinConfirmar.tiene(7)).toBe(false);
    expect(b.disabled).toBe(true);
    expect(avisoDe(b)).toBe(AVISO_ENVIADO);
    expect(estado(raiz)).toBe('Email enviado.');
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(api.enviarEmail).toHaveBeenCalledTimes(1);
    expect(boton(raiz, 'WhatsApp').disabled).toBe(false);
  });

  it('el 201 con el foco en Email deja el foco dentro del componente', async () => {
    const { raiz, api } = montar();
    api.enviarEmail.mockResolvedValue(RECORDATORIO_EMAIL);
    boton(raiz, 'Email').focus();
    boton(raiz, 'Email').click();
    await flush();
    expect(raiz.contains(document.activeElement)).toBe(true);
  });

  it('montar con el id ya enviado: Email nace deshabilitado con el aviso de enviado y sin pedido', async () => {
    const sinConfirmar = crearRegistroEnviosSinConfirmar();
    sinConfirmar.marcarEnviado(7);
    const { raiz, api } = montar({}, sinConfirmar);
    const b = boton(raiz, 'Email');
    expect(b.disabled).toBe(true);
    expect(avisoDe(b)).toBe(AVISO_ENVIADO);
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(api.enviarEmail).not.toHaveBeenCalled();
  });

  it('otro turno enviado no bloquea este; sin confirmar y enviado muestran avisos distintos', () => {
    const r = crearRegistroEnviosSinConfirmar();
    r.marcarEnviado(99);
    expect(boton(montar({}, r).raiz, 'Email').disabled).toBe(false);
    const r2 = crearRegistroEnviosSinConfirmar();
    r2.marcar(7);
    expect(avisoDe(boton(montar({}, r2).raiz, 'Email'))).toBe('Envío por email sin confirmar: verificá con el paciente.');
  });

  it('502 y 503 no marcan enviado ni sin confirmar y permiten reintentar', async () => {
    const { raiz, api, sinConfirmar } = montar();
    api.enviarEmail.mockRejectedValueOnce(http(502, PROBLEM_502)).mockResolvedValueOnce(RECORDATORIO_EMAIL);
    boton(raiz, 'Email').click();
    await flush();
    expect(sinConfirmar.enviado(7)).toBe(false);
    expect(sinConfirmar.tiene(7)).toBe(false);
    boton(raiz, 'Email').click();
    await flush();
    expect(api.enviarEmail).toHaveBeenCalledTimes(2);
    expect(sinConfirmar.enviado(7)).toBe(true);
  });

  it('un 2xx con cuerpo ilegible es incierto, no enviado', async () => {
    const { raiz, api, sinConfirmar, resultados } = montar();
    api.enviarEmail.mockRejectedValue(new ApiError('unexpected', { status: 201 }));
    boton(raiz, 'Email').click();
    await flush();
    expect(sinConfirmar.tiene(7)).toBe(true);
    expect(sinConfirmar.enviado(7)).toBe(false);
    expect(resultados).toEqual(['emailSinConfirmar']);
    expect(avisoDe(boton(raiz, 'Email'))).toBe('Envío por email sin confirmar: verificá con el paciente.');
  });

  it('nada del envío exitoso llega al almacenamiento', async () => {
    const { raiz, api } = montar();
    api.enviarEmail.mockResolvedValue(RECORDATORIO_EMAIL);
    boton(raiz, 'Email').click();
    await flush();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
