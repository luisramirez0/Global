import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { EXPORT_PACIENTE_7 } from '../api/__fixtures__/auditoria';
import type { AuditoriaApi } from '../api/auditoria';
import { ApiError } from '../api/errors';
import { deferred, flush } from '../test-support/pages';
import {
  createExportarPaciente,
  MSG_EXPORT_ERROR,
  MSG_EXPORT_ID_INVALIDO,
  MSG_EXPORT_NO_ENCONTRADO,
  MSG_EXPORT_SIN_PERMISO,
  type DescargaArchivo,
} from './exportarPaciente';

type ExportarFn = AuditoriaApi['exportarPaciente'];

let clicks: HTMLAnchorElement[];
let clickSpy: MockInstance<() => void>;

beforeEach(() => {
  clicks = [];
  // jsdom no descarga: se captura el enlace en lugar de navegar.
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push(this);
  });
});

afterEach(() => {
  clickSpy.mockRestore();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function setup(exportar: ExportarFn, pacienteId?: number) {
  const api = { exportarPaciente: vi.fn<ExportarFn>(exportar) };
  const blobs: Blob[] = [];
  const descarga: DescargaArchivo = {
    crearUrl: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:prueba';
    }),
    liberarUrl: vi.fn<(url: string) => void>(),
  };
  const comp = createExportarPaciente({ api, descarga, ...(pacienteId === undefined ? {} : { pacienteId }) });
  document.body.append(comp.element);
  return { comp, api, descarga, blobs };
}

function boton(): HTMLButtonElement {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Exportar');
  if (b === undefined) throw new Error('sin botón Exportar');
  return b;
}

function exportarCon(id: string): void {
  const input = document.querySelector('input[name="pacienteId"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('sin input');
  input.value = id;
  const form = document.querySelector('form');
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

const alerta = (): string => document.querySelector('[role="alert"]')?.textContent ?? '';
const estado = (): string => document.querySelector('[role="status"]')?.textContent ?? '';

describe('exportar datos de un paciente (C-15 design D11)', () => {
  it('descarga el JSON recibido como paciente-<id>-export.json y libera la URL', async () => {
    const { api, descarga, blobs } = setup(() => Promise.resolve(EXPORT_PACIENTE_7));

    exportarCon('7');
    await flush();

    expect(api.exportarPaciente).toHaveBeenCalledWith(7);
    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.getAttribute('download')).toBe('paciente-7-export.json');
    expect(clicks[0]?.getAttribute('href')).toBe('blob:prueba');
    expect(blobs[0]?.type).toBe('application/json');
    expect(JSON.parse((await blobs[0]?.text()) ?? '') as unknown).toEqual(EXPORT_PACIENTE_7);
    expect(descarga.liberarUrl).toHaveBeenCalledWith('blob:prueba');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(estado()).toBe('Se descargó paciente-7-export.json.');
  });

  it('otro paciente usa su propio nombre de archivo', async () => {
    setup(() => Promise.resolve({ ...EXPORT_PACIENTE_7, paciente: { id: 12 } }));

    exportarCon(' 12 ');
    await flush();

    expect(clicks[0]?.getAttribute('download')).toBe('paciente-12-export.json');
  });

  it('con pacienteId fijo no pide el id y exporta ese paciente', async () => {
    const { api } = setup(() => Promise.resolve(EXPORT_PACIENTE_7), 7);

    expect(document.querySelector('input[name="pacienteId"]')).toBeNull();
    boton().click();
    await flush();

    expect(api.exportarPaciente).toHaveBeenCalledWith(7);
    expect(clicks).toHaveLength(1);
  });

  it('deshabilita el botón mientras descarga y lo rehabilita al terminar', async () => {
    const pendiente = deferred<Readonly<Record<string, unknown>>>();
    const { api } = setup(() => pendiente.promise);

    exportarCon('7');
    expect(boton().disabled).toBe(true);
    exportarCon('7');
    expect(api.exportarPaciente).toHaveBeenCalledTimes(1);

    pendiente.resolve(EXPORT_PACIENTE_7);
    await flush();
    expect(boton().disabled).toBe(false);
  });

  it.each(['', 'abc', '0', '-3', '1.5', '99999999999999999999'])('el id "%s" muestra un error y no pide nada', async (id) => {
    const { api } = setup(() => Promise.resolve(EXPORT_PACIENTE_7));

    exportarCon(id);
    await flush();

    expect(api.exportarPaciente).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(MSG_EXPORT_ID_INVALIDO);
  });

  it.each([
    ['403', new ApiError('forbidden', { status: 403 }), MSG_EXPORT_SIN_PERMISO],
    ['404', new ApiError('unexpected', { status: 404 }), MSG_EXPORT_NO_ENCONTRADO],
    ['500', new ApiError('server', { status: 500 }), MSG_EXPORT_ERROR],
    ['red', new ApiError('network'), 'No se pudo conectar con el servidor.'],
  ])('un error %s muestra un mensaje fijo y no descarga', async (_caso, error, mensaje) => {
    const { descarga } = setup(() => Promise.reject(error));

    exportarCon('7');
    await flush();

    expect(alerta()).toBe(mensaje);
    expect(descarga.crearUrl).not.toHaveBeenCalled();
    expect(clicks).toHaveLength(0);
    expect(boton().disabled).toBe(false);
  });

  it('no muestra el contenido ni lo guarda en localStorage ni en la consola', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const consola = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    setup(() => Promise.resolve(EXPORT_PACIENTE_7));

    exportarCon('7');
    await flush();

    expect(document.body.textContent).not.toContain('De Prueba');
    expect(document.body.textContent).not.toContain('30111222');
    expect(setItem).not.toHaveBeenCalled();
    for (const spy of consola) expect(spy).not.toHaveBeenCalled();
  });

  it('dispose descarta una respuesta que llega después', async () => {
    const pendiente = deferred<Readonly<Record<string, unknown>>>();
    const { comp, descarga } = setup(() => pendiente.promise);

    exportarCon('7');
    comp.dispose();
    pendiente.resolve(EXPORT_PACIENTE_7);
    await flush();

    expect(descarga.crearUrl).not.toHaveBeenCalled();
  });
});
