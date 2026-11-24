/**
 * Estructura común de las pantallas de configuración (design D3, D7 y D9 de C-11): listado, formulario de alta y
 * edición, confirmación de borrado en la fila y mensajes. Todo con `h()`/`textContent` (regla 3).
 */
import { applyFieldErrors, createFormStatus, setBusy, type FormControl } from '../../components/form';
import type { Page } from '../../router/router';
import { h } from '../../utils/dom';
import { serverFieldErrors } from '../auth/messages';
import { esNoEncontrado, mensajeDeError, MSG_SOLO_LECTURA, type ContextoError } from './mensajes';
import { renderSubnav, type SeccionConfig } from './nav';
import type { Resultado } from './validacion';

export interface CrudForm<T, R> {
  /** Controles que reciben errores por campo (cliente y servidor). */
  controls: readonly FormControl[];
  /** Nodos del formulario, en orden. */
  elements: readonly HTMLElement[];
  /** Carga un registro para editarlo, o deja el formulario vacío (`null`) para un alta. */
  fill(item: T | null): void;
  /** Valida y arma el cuerpo de la request; `editing` es el registro en edición o `null`. */
  read(editing: T | null): Resultado<R>;
}

export interface RowAction<T> {
  /** Texto visible del botón, p. ej. "Dar de baja". */
  etiqueta: string;
  ejecutar(item: T): Promise<unknown>;
  /** Mensaje anunciado si sale bien. */
  exito: string;
  contexto?: ContextoError;
  visible?(item: T): boolean;
}

export interface CrudOptions<T extends { id: number }, R> {
  seccion: SeccionConfig;
  titulo: string;
  descripcion: string;
  tituloAlta: string;
  tituloEdicion: string;
  columnas: readonly string[];
  celdas(item: T): readonly string[];
  /** Nombre del registro para las etiquetas accesibles de sus botones ("Editar Sillón 1"). */
  etiqueta(item: T): string;
  vacio: string;
  cargar(): Promise<readonly T[]>;
  crear(request: R): Promise<unknown>;
  editar(item: T, request: R): Promise<unknown>;
  /** Siempre con confirmación en la fila. */
  borrar: RowAction<T>;
  /** Acciones de fila que requieren permiso de escritura (p. ej. "Reactivar"). */
  accionesEscritura?: readonly RowAction<T>[];
  /** Formulario de alta/edición y botón "Editar". Sin permiso, el formulario no se crea (V-D3). */
  puedeEscribir: boolean;
  puedeBorrar: boolean;
  formulario(): CrudForm<T, R>;
  contexto?: { crear?: ContextoError; editar?: ContextoError };
  exito: { crear: string; editar: string };
  /** Controles sobre el listado (filtros, "Mostrar inactivos"). */
  herramientas?: readonly HTMLElement[];
  /** Al cambiar entre alta y edición (p. ej. para mostrar un aviso). */
  alCambiarEdicion?(item: T | null): void;
}

export interface CrudPage<T> extends Page {
  recargar(): void;
  /** Registros mostrados (para páginas que necesitan buscarlos). */
  items(): readonly T[];
}

export const MSG_CARGANDO = 'Cargando…';

export function createCrudPage<T extends { id: number }, R>(options: CrudOptions<T, R>): CrudPage<T> {
  let disposed = false;
  let ocupado = false;
  let editing: T | null = null;
  let items: readonly T[] = [];
  let loadSeq = 0;

  const estado = h('p', { className: 'estado', attrs: { role: 'status' } });
  const alertaLista = h('p', { className: 'alerta alerta-lista', attrs: { role: 'alert' } });
  const contenido = h('div', { className: 'contenido-lista' });
  const listaTitulo = h('h2', { id: `${options.seccion.slice(8)}-lista`, attrs: { tabindex: '-1' } }, 'Listado');
  const lista = h(
    'section',
    { className: 'lista', attrs: { 'aria-labelledby': listaTitulo.id } },
    listaTitulo,
    ...(options.herramientas ?? []),
    alertaLista,
    contenido,
  );

  const tieneAcciones = options.puedeEscribir || options.puedeBorrar;
  const formSection = options.puedeEscribir ? crearFormulario() : null;

  const element = h(
    'section',
    { className: 'pagina-config' },
    h('h1', {}, options.titulo),
    renderSubnav(options.seccion),
    h('p', {}, options.descripcion),
    options.puedeEscribir ? null : h('p', { className: 'aviso solo-lectura' }, MSG_SOLO_LECTURA),
    estado,
    formSection?.element ?? null,
    lista,
  );

  function anunciar(message: string): void {
    estado.textContent = message;
  }

  function crearFormulario(): { element: HTMLElement; editar(item: T): void; salir(): void } {
    const form = options.formulario();
    const titulo = h('h2', { id: `${options.seccion.slice(8)}-form` }, options.tituloAlta);
    const status = createFormStatus();
    const submit = h('button', { attrs: { type: 'submit' } }, 'Agregar');
    const cancelar = h(
      'button',
      { attrs: { type: 'button', hidden: true }, on: { click: () => salir() } },
      'Cancelar edición',
    );
    const formEl = h(
      'form',
      { attrs: { novalidate: true, 'aria-labelledby': titulo.id }, on: { submit: (event) => void onSubmit(event) } },
      ...form.elements,
      status.element,
      h('div', { className: 'acciones-form' }, submit, cancelar),
    );

    function modo(item: T | null): void {
      editing = item;
      titulo.textContent = item === null ? options.tituloAlta : options.tituloEdicion;
      submit.textContent = item === null ? 'Agregar' : 'Guardar cambios';
      cancelar.hidden = item === null;
      form.fill(item);
      applyFieldErrors(form.controls, {});
      status.clear();
      options.alCambiarEdicion?.(item);
    }

    function salir(): void {
      modo(null);
    }

    async function onSubmit(event: Event): Promise<void> {
      event.preventDefault();
      if (ocupado) return;
      status.clear();
      const target = editing;
      const result = form.read(target);
      applyFieldErrors(form.controls, result.ok ? {} : result.errors);
      if (!result.ok) return;

      ocupado = true;
      setBusy(formEl, submit, true);
      try {
        if (target === null) await options.crear(result.value);
        else await options.editar(target, result.value);
        if (disposed) return;
        anunciar(target === null ? options.exito.crear : options.exito.editar);
        salir();
        recargar();
      } catch (error) {
        if (disposed) return;
        const contexto = target === null ? options.contexto?.crear : options.contexto?.editar;
        if (esNoEncontrado(error)) {
          salir();
          recargar();
        } else {
          applyFieldErrors(form.controls, serverFieldErrors(error));
        }
        status.show(mensajeDeError(error, contexto));
      } finally {
        ocupado = false;
        if (!disposed) setBusy(formEl, submit, false);
      }
    }

    return {
      element: h('section', { className: 'formulario', attrs: { 'aria-labelledby': titulo.id } }, titulo, formEl),
      editar(item) {
        modo(item);
        form.controls[0]?.focus();
      },
      salir,
    };
  }

  function boton(texto: string, label: string, onClick: () => void): HTMLButtonElement {
    return h('button', { attrs: { type: 'button', 'aria-label': label }, on: { click: onClick } }, texto);
  }

  function accionesDe(item: T, celda: HTMLElement): HTMLButtonElement[] {
    const nombre = options.etiqueta(item);
    const result: HTMLButtonElement[] = [];
    if (options.puedeEscribir && formSection !== null) {
      result.push(boton('Editar', `Editar ${nombre}`, () => formSection.editar(item)));
      for (const accion of options.accionesEscritura ?? []) {
        if (accion.visible?.(item) ?? true) {
          result.push(boton(accion.etiqueta, `${accion.etiqueta} ${nombre}`, () => void ejecutar(accion, item)));
        }
      }
    }
    const borrar = options.borrar;
    if (options.puedeBorrar && (borrar.visible?.(item) ?? true)) {
      result.push(boton(borrar.etiqueta, `${borrar.etiqueta} ${nombre}`, () => confirmar(item, celda)));
    }
    return result;
  }

  function confirmar(item: T, celda: HTMLElement): void {
    if (ocupado) return;
    const nombre = options.etiqueta(item);
    const si = boton('Confirmar', `Confirmar: ${options.borrar.etiqueta} ${nombre}`, () => void ejecutar(options.borrar, item));
    const no = boton('Cancelar', `Cancelar: ${options.borrar.etiqueta} ${nombre}`, () => {
      const restauradas = accionesDe(item, celda);
      celda.replaceChildren(...restauradas);
      restauradas.find((b) => b.textContent === options.borrar.etiqueta)?.focus();
    });
    celda.replaceChildren(h('span', { className: 'pregunta' }, `¿${options.borrar.etiqueta}?`), si, no);
    si.focus();
  }

  async function ejecutar(accion: RowAction<T>, item: T): Promise<void> {
    if (ocupado) return;
    ocupado = true;
    alertaLista.textContent = '';
    estado.textContent = '';
    try {
      await accion.ejecutar(item);
      if (disposed) return;
      anunciar(accion.exito);
      if (editing?.id === item.id) formSection?.salir();
      recargar();
      listaTitulo.focus();
    } catch (error) {
      if (disposed) return;
      alertaLista.textContent = mensajeDeError(error, accion.contexto);
      if (esNoEncontrado(error)) recargar();
      else renderItems();
    } finally {
      ocupado = false;
    }
  }

  function renderItems(): void {
    if (items.length === 0) {
      contenido.replaceChildren(h('p', { className: 'vacio' }, options.vacio));
      return;
    }
    const encabezados = [...options.columnas, ...(tieneAcciones ? ['Acciones'] : [])];
    const filas = items.map((item) => {
      const celdas = options.celdas(item).map((texto) => h('td', {}, texto));
      if (tieneAcciones) {
        const celda = h('td', { className: 'acciones' });
        celda.replaceChildren(...accionesDe(item, celda));
        celdas.push(celda);
      }
      return h('tr', {}, ...celdas);
    });
    contenido.replaceChildren(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, ...encabezados.map((t) => h('th', {}, t)))),
        h('tbody', {}, ...filas),
      ),
    );
  }

  function recargar(): void {
    const seq = ++loadSeq;
    contenido.replaceChildren(h('p', { className: 'cargando', attrs: { role: 'status' } }, MSG_CARGANDO));
    options
      .cargar()
      .then((loaded) => {
        if (disposed || seq !== loadSeq) return;
        items = loaded;
        renderItems();
      })
      .catch((error: unknown) => {
        if (disposed || seq !== loadSeq) return;
        items = [];
        contenido.replaceChildren(
          h(
            'div',
            { className: 'error-carga', attrs: { role: 'alert' } },
            h('p', {}, mensajeDeError(error)),
            h('button', { attrs: { type: 'button' }, on: { click: () => recargar() } }, 'Reintentar'),
          ),
        );
      });
  }

  recargar();

  return {
    title: options.titulo,
    element,
    recargar,
    items: () => items,
    dispose: () => {
      disposed = true;
    },
  };
}
