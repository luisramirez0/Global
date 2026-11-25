/** Consentimiento previo y bloqueo visual de la ficha (C-12b, tasks 5.3; design D4; RN-DS-03). */
import { afterEach, describe, expect, it } from 'vitest';
import { CONSENTIMIENTO_V1, FICHA_V3, TEXTO_V1 } from '../../api/__fixtures__/ficha';
import { PACIENTE_ANA } from '../../api/__fixtures__/pacientes';
import { ApiError } from '../../api/errors';
import type { Consentimiento } from '../../api/types';
import { casilla, contextoFicha, enviar, montarFicha, seccion, type Montada } from '../../test-support/ficha';
import { deferred, flush } from '../../test-support/pages';
import {
  MSG_CONSENTIMIENTO_OK,
  MSG_CONSENTIMIENTO_REQUERIDO,
  MSG_PACIENTE_NO_ENCONTRADO,
  MSG_SIN_TEXTO_VIGENTE,
  MSG_TEXTO_CAMBIO,
} from './mensajes';
import { MSG_ACEPTACION } from './validacion';

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

/** Anamnesis y notas no existen en el DOM: ni sus secciones ni sus campos. */
function sinDatosClinicos(root: HTMLElement): void {
  expect(seccion(root, 'Anamnesis')).toBeNull();
  expect(seccion(root, 'Notas clínicas')).toBeNull();
  expect(root.querySelector('[name="alergias"], [name="texto"], [name="embarazo"]')).toBeNull();
  expect(root.textContent).not.toContain(FICHA_V3.alergias ?? '');
}

function formConsentimiento(root: HTMLElement): HTMLFormElement | null {
  return casilla(root).closest('form');
}

describe('sin consentimiento (bloqueo, D4)', () => {
  it('muestra el texto vigente literal con su versión y la casilla; anamnesis y notas no existen en el DOM', async () => {
    const { ctx, root } = await montar({ consentimientos: [] });
    const seccionTexto = seccion(root, 'Consentimiento de datos de salud');
    expect(seccionTexto?.textContent).toContain('Versión v1');
    expect(seccionTexto?.querySelector('.texto-consentimiento')?.textContent).toBe(TEXTO_V1.contenido);
    expect(casilla(root).checked).toBe(false);
    expect(root.querySelector(`label[for="${casilla(root).id}"]`)?.textContent).toBe(
      'El paciente leyó y aceptó el texto de consentimiento (versión v1)',
    );
    sinDatosClinicos(root);
    expect(ctx.ficha.obtenerFicha).not.toHaveBeenCalled();
    expect(ctx.ficha.listarNotas).not.toHaveBeenCalled();
  });

  it('pide el paciente y sus consentimientos, y el texto vigente solo porque no hay consentimiento', async () => {
    const { ctx } = await montar({ consentimientos: [] });
    expect(ctx.pacientes.obtener).toHaveBeenCalledWith(7);
    expect(ctx.ficha.listarConsentimientos).toHaveBeenCalledWith(7);
    expect(ctx.ficha.textoVigente).toHaveBeenCalledTimes(1);
  });

  it('el botón "Registrar consentimiento" queda deshabilitado hasta marcar la casilla', async () => {
    const { root } = await montar({ consentimientos: [] });
    const boton = formConsentimiento(root)?.querySelector('button[type="submit"]');
    expect(boton?.textContent).toBe('Registrar consentimiento');
    expect(boton instanceof HTMLButtonElement && boton.disabled).toBe(true);
    casilla(root).click();
    expect(boton instanceof HTMLButtonElement && boton.disabled).toBe(false);
    casilla(root).click();
    expect(boton instanceof HTMLButtonElement && boton.disabled).toBe(true);
  });

  it('enviar sin la casilla no hace la request y marca el error', async () => {
    const { ctx, root } = await montar({ consentimientos: [] });
    enviar(formConsentimiento(root));
    await flush();
    expect(ctx.ficha.registrarConsentimiento).not.toHaveBeenCalled();
    const errorId = (casilla(root).getAttribute('aria-describedby') ?? '').split(' ').find((i) => i.endsWith('-error'));
    expect(root.querySelector(`#${errorId ?? 'x'}`)?.textContent).toBe(MSG_ACEPTACION);
    expect(casilla(root).getAttribute('aria-invalid')).toBe('true');
  });

  it('con la casilla, registra con la versión del servidor y después carga ficha y notas', async () => {
    const ctx = contextoFicha({ consentimientos: [] });
    const nuevo: Consentimiento = { ...CONSENTIMIENTO_V1, id: 41, aceptadoEn: '2026-11-24T15:00:00Z' };
    ctx.ficha.registrarConsentimiento.mockResolvedValue(nuevo);
    const { root } = await montar({ consentimientos: [] }, ctx);
    casilla(root).click();
    enviar(formConsentimiento(root));
    await flush();
    expect(ctx.ficha.registrarConsentimiento).toHaveBeenCalledWith(7, 'v1');
    expect(root.querySelector('[role="status"]')?.textContent).toBe(MSG_CONSENTIMIENTO_OK);
    expect(root.textContent).toContain('Consentimiento registrado el 24/11/2026 12:00 (versión v1).');
    expect(ctx.ficha.obtenerFicha).toHaveBeenCalledWith(7);
    expect(ctx.ficha.listarNotas).toHaveBeenCalledWith(7, 0, 20);
    expect(seccion(root, 'Anamnesis')).not.toBeNull();
    expect(seccion(root, 'Notas clínicas')).not.toBeNull();
    expect(seccion(root, 'Consentimiento de datos de salud')).toBeNull();
  });

  it('la versión enviada es la del texto recibido, aunque sea otra que v1', async () => {
    const ctx = contextoFicha({ consentimientos: [], texto: { ...TEXTO_V1, version: '2026-11' } });
    ctx.ficha.registrarConsentimiento.mockResolvedValue({ ...CONSENTIMIENTO_V1, versionTexto: '2026-11' });
    const { root } = await montar({ consentimientos: [] }, ctx);
    casilla(root).click();
    enviar(formConsentimiento(root));
    await flush();
    expect(ctx.ficha.registrarConsentimiento).toHaveBeenCalledWith(7, '2026-11');
  });

  it('un doble envío registra una sola vez', async () => {
    const ctx = contextoFicha({ consentimientos: [] });
    const d = deferred<Consentimiento>();
    ctx.ficha.registrarConsentimiento.mockReturnValue(d.promise);
    const { root } = await montar({ consentimientos: [] }, ctx);
    casilla(root).click();
    enviar(formConsentimiento(root));
    enviar(formConsentimiento(root));
    d.resolve(CONSENTIMIENTO_V1);
    await flush();
    expect(ctx.ficha.registrarConsentimiento).toHaveBeenCalledTimes(1);
  });

  it('un 400 (versión ya no vigente) avisa, vuelve a pedir el texto y no carga datos clínicos', async () => {
    const ctx = contextoFicha({ consentimientos: [] });
    ctx.ficha.registrarConsentimiento.mockRejectedValue(new ApiError('validation', { status: 400 }));
    ctx.ficha.textoVigente.mockResolvedValueOnce(TEXTO_V1).mockResolvedValueOnce({ ...TEXTO_V1, version: 'v2' });
    const { root } = await montar({ consentimientos: [] }, ctx);
    casilla(root).click();
    enviar(formConsentimiento(root));
    await flush();
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(MSG_TEXTO_CAMBIO);
    expect(ctx.ficha.textoVigente).toHaveBeenCalledTimes(2);
    expect(seccion(root, 'Consentimiento de datos de salud')?.textContent).toContain('Versión v2');
    expect(casilla(root).checked).toBe(false);
    sinDatosClinicos(root);
    expect(ctx.ficha.obtenerFicha).not.toHaveBeenCalled();
  });

  it('tras el 400, el nuevo registro manda la versión nueva del texto (v2)', async () => {
    const ctx = contextoFicha({ consentimientos: [] });
    ctx.ficha.registrarConsentimiento
      .mockRejectedValueOnce(new ApiError('validation', { status: 400 }))
      .mockResolvedValueOnce({ ...CONSENTIMIENTO_V1, versionTexto: 'v2' });
    ctx.ficha.textoVigente.mockResolvedValueOnce(TEXTO_V1).mockResolvedValueOnce({ ...TEXTO_V1, version: 'v2' });
    const { root } = await montar({ consentimientos: [] }, ctx);
    casilla(root).click();
    enviar(formConsentimiento(root));
    await flush();
    casilla(root).click();
    enviar(formConsentimiento(root));
    await flush();
    expect(ctx.ficha.registrarConsentimiento.mock.calls.map((c) => c[1])).toEqual(['v1', 'v2']);
    expect(seccion(root, 'Anamnesis')).not.toBeNull();
  });

  it('sin texto vigente (404) avisa y no ofrece la casilla', async () => {
    const ctx = contextoFicha({ consentimientos: [] });
    ctx.ficha.textoVigente.mockRejectedValue(new ApiError('unexpected', { status: 404 }));
    const { root } = await montar({ consentimientos: [] }, ctx);
    expect(root.textContent).toContain(MSG_SIN_TEXTO_VIGENTE);
    expect(root.querySelector('input[name="aceptado"]')).toBeNull();
    sinDatosClinicos(root);
  });
});

describe('con consentimiento', () => {
  it('muestra la fecha y la versión del más reciente y no pide el texto vigente', async () => {
    const viejo: Consentimiento = { ...CONSENTIMIENTO_V1, id: 30, versionTexto: 'v0', aceptadoEn: '2025-01-01T12:00:00Z' };
    const { ctx, root } = await montar({ consentimientos: [CONSENTIMIENTO_V1, viejo] });
    expect(root.textContent).toContain('Consentimiento registrado el 20/11/2026 10:30 (versión v1).');
    expect(root.textContent).not.toContain('v0');
    expect(ctx.ficha.textoVigente).not.toHaveBeenCalled();
    expect(root.querySelector('input[name="aceptado"]')).toBeNull();
  });

  it('carga ficha y notas una sola vez', async () => {
    const { ctx, root } = await montar();
    expect(ctx.ficha.obtenerFicha).toHaveBeenCalledTimes(1);
    expect(ctx.ficha.listarNotas).toHaveBeenCalledTimes(1);
    expect(seccion(root, 'Anamnesis')).not.toBeNull();
    expect(seccion(root, 'Notas clínicas')).not.toBeNull();
  });
});

describe('fechas independientes de la zona horaria de la máquina', () => {
  // Vitest corre en Node: `process.env.TZ` cambia la zona local del proceso en caliente (mismo esquema que C-11).
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
  const ORIGINAL_TZ = env['TZ'];
  const ZONAS = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Europe/Madrid', 'America/Argentina/Buenos_Aires'];
  /** 23:30 del 20/11 en Argentina; en UTC y en Tokio ya es el 21. */
  const NOCTURNO: Consentimiento = { ...CONSENTIMIENTO_V1, aceptadoEn: '2026-11-21T02:30:00Z' };

  afterEach(() => {
    if (ORIGINAL_TZ === undefined) delete env['TZ'];
    else env['TZ'] = ORIGINAL_TZ;
  });

  it('cambiar TZ cambia de verdad la zona local del proceso (si no, estos tests no probarían nada)', () => {
    const offsets = new Set<number>();
    for (const zona of ZONAS) {
      env['TZ'] = zona;
      offsets.add(new Date(Date.UTC(2026, 10, 21, 2, 30)).getTimezoneOffset());
    }
    expect(offsets.size).toBe(ZONAS.length);
  });

  it.each(ZONAS)('con TZ=%s la fecha del consentimiento se muestra en hora de Argentina', async (zona) => {
    env['TZ'] = zona;
    const { root } = await montar({ consentimientos: [NOCTURNO] });
    expect(root.textContent).toContain('Consentimiento registrado el 20/11/2026 23:30 (versión v1).');
    actual?.page.dispose?.();
    document.body.replaceChildren();
    const fixture = await montar({ consentimientos: [CONSENTIMIENTO_V1] });
    expect(fixture.root.textContent).toContain('Consentimiento registrado el 20/11/2026 10:30 (versión v1).');
  });
});

describe('409 CONSENTIMIENTO_REQUERIDO posterior (carrera)', () => {
  it.each(['obtenerFicha', 'listarNotas'] as const)('si %s responde 409, vuelve al bloqueo y no muestra datos clínicos', async (metodo) => {
    const ctx = contextoFicha();
    ctx.ficha[metodo].mockRejectedValue(new ApiError('conflict', { status: 409, codigo: 'CONSENTIMIENTO_REQUERIDO' }));
    const { root } = await montar({}, ctx);
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(MSG_CONSENTIMIENTO_REQUERIDO);
    sinDatosClinicos(root);
    expect(casilla(root)).toBeDefined();
    expect(ctx.ficha.textoVigente).toHaveBeenCalledTimes(1);
  });
});

describe('errores de carga', () => {
  it('paciente inexistente (404): "Paciente no encontrado." y nada clínico', async () => {
    const ctx = contextoFicha();
    ctx.pacientes.obtener.mockRejectedValue(new ApiError('unexpected', { status: 404 }));
    const { root } = await montar({}, ctx);
    expect(root.textContent).toContain(MSG_PACIENTE_NO_ENCONTRADO);
    sinDatosClinicos(root);
    expect(ctx.ficha.obtenerFicha).not.toHaveBeenCalled();
  });

  it('error de red: "Reintentar" vuelve a pedir', async () => {
    const ctx = contextoFicha();
    ctx.ficha.listarConsentimientos.mockRejectedValueOnce(new ApiError('network')).mockResolvedValue([CONSENTIMIENTO_V1]);
    const { root } = await montar({}, ctx);
    expect(root.querySelector('[role="alert"]')?.textContent).toBe('No se pudo conectar con el servidor.');
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Reintentar')?.click();
    await flush();
    expect(seccion(root, 'Anamnesis')).not.toBeNull();
  });

  it('el encabezado muestra el paciente como texto y el título es fijo', async () => {
    const { page, root } = await montar();
    expect(root.querySelector('h1')?.textContent).toBe('Ficha clínica');
    expect(page.title).toBe('Ficha clínica');
    expect(root.textContent).toContain(`${PACIENTE_ANA.apellido}, ${PACIENTE_ANA.nombre}`);
    expect(root.querySelector('a[href="#/pacientes/7"]')?.textContent).toBe('Volver al paciente');
  });
});
