import { ApiError } from '../../api/errors';
import { ACCIONES_AUDITORIA, type AccionAuditoria, type EntradaAuditoria, type Pagina } from '../../api/types';
import { createExportarPaciente, type ExportarPaciente } from '../../components/exportarPaciente';
import { applyFieldErrors, createField, createSelectField, type SelectOption } from '../../components/form';
import type { Page } from '../../router/router';
import { h } from '../../utils/dom';
import { formatearFechaHora } from '../../utils/zonaHoraria';
import { MSG_CONNECTION, MSG_GENERIC } from '../auth/messages';
import { rolActual } from '../config/permisos';
import type { PageContext } from '../context';
import { formatearDetalle, validarFiltros, type Filtros } from './filtros';

export const MSG_AUDITORIA_SIN_PERMISO = 'Tu rol no tiene acceso a la auditoría.';
export const MSG_AUDITORIA_FILTROS = 'Revisá los filtros: alguno no es válido.';
export const MSG_AUDITORIA_VACIA = 'No hay registros para los filtros elegidos.';

const SIN_DATO = '—';

const ETIQUETAS_ACCION: Readonly<Record<AccionAuditoria, string>> = {
  READ: 'Lectura',
  CREATE: 'Alta',
  UPDATE: 'Modificación',
  DELETE: 'Baja',
  EXPORT: 'Exportación',
  LOGIN: 'Inicio de sesión',
};

/** Entidades que hoy escriben en el log (handoffs de C-06, C-07, C-08 y C-15). */
const ENTIDADES: readonly SelectOption[] = [
  { value: 'FichaClinica', label: 'Ficha clínica' },
  { value: 'NotaClinica', label: 'Nota clínica' },
  { value: 'ConsentimientoDatos', label: 'Consentimiento' },
  { value: 'Paciente', label: 'Paciente' },
  { value: 'Turno', label: 'Turno' },
  { value: 'Usuario', label: 'Usuario' },
];

function etiquetaEntidad(entidad: string): string {
  return ENTIDADES.find((e) => e.value === entidad)?.label ?? entidad;
}

/** Solo ADMIN y PROFESIONAL leen el log (KB 03, spec access-control); el backend sigue decidiendo. */
export function puedeVerAuditoria(rol: string | null): boolean {
  return rol === 'ADMIN' || rol === 'PROFESIONAL';
}

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'validation') return MSG_AUDITORIA_FILTROS;
    if (error.kind === 'forbidden') return MSG_AUDITORIA_SIN_PERMISO;
    if (error.kind === 'network' || error.kind === 'timeout') return MSG_CONNECTION;
  }
  return MSG_GENERIC;
}

/**
 * Log de auditoría del consultorio (US-040, C-15 design D9/D10) y exportación de datos de un paciente (D11). Todo
 * dato recibido se muestra como texto (regla 3). Los filtros viven en memoria: el router descarta el `?query`.
 */
export function renderAuditoria(ctx: PageContext): Page {
  const titulo = h('h1', { attrs: { tabindex: '-1' } }, 'Auditoría');

  if (!puedeVerAuditoria(rolActual(ctx))) {
    return {
      title: 'Auditoría',
      element: h('section', { className: 'auditoria' }, titulo, h('p', { className: 'alerta', attrs: { role: 'alert' } }, MSG_AUDITORIA_SIN_PERMISO)),
    };
  }

  let disposed = false;
  let secuencia = 0;
  let filtros: Filtros = {};
  let pagina = 0;

  const desde = createField({ id: 'auditoria-desde', name: 'desde', label: 'Desde', type: 'date', autocomplete: 'off' });
  const hasta = createField({ id: 'auditoria-hasta', name: 'hasta', label: 'Hasta (inclusive)', type: 'date', autocomplete: 'off' });
  const accion = createSelectField({
    id: 'auditoria-accion',
    name: 'accion',
    label: 'Acción',
    options: [{ value: '', label: 'Todas' }, ...ACCIONES_AUDITORIA.map((a) => ({ value: a, label: ETIQUETAS_ACCION[a] }))],
  });
  const entidad = createSelectField({ id: 'auditoria-entidad', name: 'entidad', label: 'Entidad', options: [{ value: '', label: 'Todas' }, ...ENTIDADES] });
  const entidadId = createField({ id: 'auditoria-entidad-id', name: 'entidadId', label: 'Número de la entidad', type: 'text', autocomplete: 'off', inputmode: 'numeric' });
  const usuarioId = createField({ id: 'auditoria-usuario-id', name: 'usuarioId', label: 'Número de usuario', type: 'text', autocomplete: 'off', inputmode: 'numeric' });
  const campos = [desde, hasta, accion, entidad, entidadId, usuarioId];

  // design D8: el id de entidad solo tiene sentido con una entidad elegida.
  function sincronizarEntidadId(): void {
    const sinEntidad = entidad.value() === '';
    entidadId.input.disabled = sinEntidad;
    if (sinEntidad) {
      entidadId.setValue('');
      entidadId.setError(null);
    }
  }
  entidad.select.addEventListener('change', sincronizarEntidadId);
  sincronizarEntidadId();

  const formFiltros = h(
    'form',
    { className: 'filtros', attrs: { novalidate: true, role: 'search', 'aria-label': 'Filtrar auditoría' } },
    ...campos.map((c) => c.element),
    h('button', { attrs: { type: 'submit' } }, 'Filtrar'),
  );
  formFiltros.addEventListener('submit', (event) => {
    event.preventDefault();
    const r = validarFiltros({
      desde: desde.value(),
      hasta: hasta.value(),
      accion: accion.value(),
      entidad: entidad.value(),
      entidadId: entidadId.value(),
      usuarioId: usuarioId.value(),
    });
    applyFieldErrors(campos, r.ok ? {} : r.errors);
    if (!r.ok) return;
    filtros = r.value;
    void cargar(0);
  });

  const resultado = h('div', { className: 'auditoria-resultado' });
  const anterior = h('button', { attrs: { type: 'button' }, on: { click: () => void cargar(pagina - 1) } }, 'Anterior');
  const siguiente = h('button', { attrs: { type: 'button' }, on: { click: () => void cargar(pagina + 1) } }, 'Siguiente');
  const posicion = h('p', { className: 'paginado-posicion' });
  const paginado = h('nav', { className: 'paginado', attrs: { 'aria-label': 'Páginas de la auditoría', hidden: true } }, anterior, posicion, siguiente);

  function fila(e: EntradaAuditoria): HTMLTableRowElement {
    return h(
      'tr',
      {},
      h('td', {}, formatearFechaHora(e.fecha)),
      h('td', {}, e.usuarioId === null ? SIN_DATO : String(e.usuarioId)),
      h('td', {}, ETIQUETAS_ACCION[e.accion]),
      h('td', {}, etiquetaEntidad(e.entidad)),
      h('td', {}, e.entidadId === null ? SIN_DATO : String(e.entidadId)),
      h('td', {}, formatearDetalle(e.detalle)),
      h('td', {}, e.ip ?? SIN_DATO),
    );
  }

  function mostrar(datos: Pagina<EntradaAuditoria>): void {
    pagina = datos.pagina;
    const total = Math.max(datos.totalPaginas, 1);
    posicion.textContent = `Página ${datos.pagina + 1} de ${total}`;
    anterior.disabled = datos.pagina <= 0;
    siguiente.disabled = datos.pagina + 1 >= total;
    paginado.hidden = datos.contenido.length === 0 && datos.pagina === 0;
    if (datos.contenido.length === 0) {
      resultado.replaceChildren(h('p', { className: 'vacio' }, MSG_AUDITORIA_VACIA));
      return;
    }
    const encabezados = ['Fecha', 'Usuario', 'Acción', 'Entidad', 'Número', 'Detalle', 'IP'];
    resultado.replaceChildren(
      h(
        'table',
        {},
        h('caption', {}, 'Registro de accesos y cambios'),
        h('thead', {}, h('tr', {}, ...encabezados.map((t) => h('th', {}, t)))),
        h('tbody', {}, ...datos.contenido.map(fila)),
      ),
    );
  }

  async function cargar(numero: number): Promise<void> {
    const propia = ++secuencia;
    const pedido = { ...filtros, page: Math.max(numero, 0) };
    resultado.replaceChildren(h('p', { className: 'cargando', attrs: { role: 'status' } }, 'Cargando…'));
    try {
      const datos = await ctx.auditoria.listar(pedido);
      if (disposed || propia !== secuencia) return;
      mostrar(datos);
    } catch (error) {
      if (disposed || propia !== secuencia) return;
      paginado.hidden = true;
      resultado.replaceChildren(
        h(
          'div',
          { className: 'error-carga', attrs: { role: 'alert' } },
          h('p', {}, mensajeDeError(error)),
          h('button', { attrs: { type: 'button' }, on: { click: () => void cargar(pedido.page) } }, 'Reintentar'),
        ),
      );
    }
  }

  const exportar: ExportarPaciente = createExportarPaciente({ api: ctx.auditoria });
  const element = h(
    'section',
    { className: 'auditoria' },
    titulo,
    formFiltros,
    resultado,
    paginado,
    h('section', { className: 'auditoria-export' }, h('h2', {}, 'Exportar datos de un paciente'), exportar.element),
  );

  void cargar(0);

  return {
    title: 'Auditoría',
    element,
    dispose() {
      disposed = true;
      exportar.dispose();
    },
  };
}
