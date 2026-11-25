import type { AuditoriaApi } from '../api/auditoria';
import { ApiError } from '../api/errors';
import { MSG_CONNECTION } from '../pages/auth/messages';
import { h } from '../utils/dom';
import { createField, createFormStatus, setBusy } from './form';

/**
 * Exportación de los datos de un paciente (C-15 design D11, RN-DS-06). Pide el export con el cliente tipado (el
 * token va en el encabezado, nunca en una URL), lo descarga como archivo y libera la URL temporal. No muestra el
 * contenido, no lo guarda en el navegador y no lo escribe en la consola (regla 5). Se monta en `#/auditoria`
 * pidiendo el id; C-12 puede montarlo en la ficha con `pacienteId` fijo.
 */

export const MSG_EXPORT_ID_INVALIDO = 'Ingresá un número de paciente válido.';
export const MSG_EXPORT_NO_ENCONTRADO = 'No se encontró el paciente.';
export const MSG_EXPORT_SIN_PERMISO = 'No tenés permiso para exportar datos de pacientes.';
export const MSG_EXPORT_ERROR = 'No se pudo exportar. Intentá de nuevo.';

/** Creación y liberación de la URL del archivo; inyectable porque jsdom no implementa `URL.createObjectURL`. */
export interface DescargaArchivo {
  crearUrl(blob: Blob): string;
  liberarUrl(url: string): void;
}

const DESCARGA_NAVEGADOR: DescargaArchivo = {
  crearUrl: (blob) => URL.createObjectURL(blob),
  liberarUrl: (url) => URL.revokeObjectURL(url),
};

export interface ExportarPacienteOptions {
  api: Pick<AuditoriaApi, 'exportarPaciente'>;
  /** Si viene, se exporta ese paciente sin pedir el id (uso desde la ficha, C-12). */
  pacienteId?: number;
  descarga?: DescargaArchivo;
}

export interface ExportarPaciente {
  element: HTMLElement;
  dispose(): void;
}

export function nombreArchivoExport(pacienteId: number): string {
  return `paciente-${pacienteId}-export.json`;
}

function parsearId(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d{1,15}$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'forbidden') return MSG_EXPORT_SIN_PERMISO;
    if (error.status === 404) return MSG_EXPORT_NO_ENCONTRADO;
    if (error.kind === 'network' || error.kind === 'timeout') return MSG_CONNECTION;
  }
  return MSG_EXPORT_ERROR;
}

export function createExportarPaciente(options: ExportarPacienteOptions): ExportarPaciente {
  const descarga = options.descarga ?? DESCARGA_NAVEGADOR;
  const fijo = options.pacienteId;
  let disposed = false;
  let ocupado = false;

  const campo =
    fijo === undefined
      ? createField({ id: 'export-paciente-id', name: 'pacienteId', label: 'Número de paciente', type: 'text', autocomplete: 'off', inputmode: 'numeric' })
      : null;
  const alerta = createFormStatus();
  const estado = h('p', { className: 'estado', attrs: { role: 'status' } });
  const boton = h('button', { attrs: { type: 'submit' } }, 'Exportar');
  const form = h('form', { attrs: { novalidate: true, 'aria-label': 'Exportar datos de un paciente' } }, alerta.element, campo?.element, boton);

  function descargar(pacienteId: number, datos: unknown): string {
    const nombre = nombreArchivoExport(pacienteId);
    const url = descarga.crearUrl(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
    // Enlace temporal creado a mano: `h()` solo admite esquemas http/https/mailto y la URL es local (`blob:`),
    // generada por el navegador para este Blob; no lleva datos del usuario.
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.hidden = true;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => descarga.liberarUrl(url), 0);
    return nombre;
  }

  async function exportar(pacienteId: number): Promise<void> {
    ocupado = true;
    setBusy(form, boton, true);
    alerta.clear();
    estado.textContent = '';
    try {
      const datos = await options.api.exportarPaciente(pacienteId);
      if (disposed) return;
      estado.textContent = `Se descargó ${descargar(pacienteId, datos)}.`;
    } catch (error) {
      if (disposed) return;
      alerta.show(mensajeDeError(error));
    } finally {
      ocupado = false;
      if (!disposed) setBusy(form, boton, false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (ocupado) return;
    const pacienteId = fijo ?? (campo === null ? null : parsearId(campo.value()));
    if (pacienteId === null) {
      campo?.setError(MSG_EXPORT_ID_INVALIDO);
      campo?.focus();
      return;
    }
    campo?.setError(null);
    void exportar(pacienteId);
  });

  const element = h('section', { className: 'exportar-paciente' }, form, estado);
  return {
    element,
    dispose() {
      disposed = true;
    },
  };
}
