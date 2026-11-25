import { ApiError } from '../../api/errors';
import type { Nota, Pagina } from '../../api/types';
import { applyFieldErrors, createFormStatus, createTextAreaField, setBusy } from '../../components/form';
import { clear, h } from '../../utils/dom';
import { formatearFechaHora } from '../../utils/zonaHoraria';
import { MSG_CHECK_FIELDS, serverFieldErrors } from '../auth/messages';
import {
  CODIGO_PROFESIONAL_NO_VINCULADO,
  MSG_NOTA_AGREGADA,
  MSG_NOTAS_INMUTABLES,
  MSG_PROFESIONAL_NO_VINCULADO,
  MSG_SIN_NOTAS,
  autorDeNota,
  mensajeDeError,
  tieneCodigo,
} from './mensajes';
import { MAX_NOTA, validarNota } from './validacion';

export const NOTAS_POR_PAGINA = 20;

export interface NotasOpciones {
  inicial: Pagina<Nota>;
  /** Paciente dado de baja (D6): sin formulario de nota nueva. */
  soloLectura: boolean;
  /** Página `page` de notas (del más reciente al más antiguo). */
  listar(page: number): Promise<Pagina<Nota>>;
  /** Nota nueva; sin `turnoId` en C-12. */
  crear(texto: string): Promise<Nota>;
  /** Errores que decide la página (CONSENTIMIENTO_REQUERIDO, PACIENTE_INACTIVO). `true` si los manejó. */
  alError(error: unknown): boolean;
  anunciar(mensaje: string): void;
}

export interface Notas {
  readonly element: HTMLElement;
  /** Notas ya cargadas y última página pedida (para re-renderizar sin volver a pedirlas, D8). */
  estado(): Pagina<Nota>;
  liberar(): void;
}

function item(nota: Nota): HTMLElement {
  return h(
    'li',
    { className: 'nota' },
    h('p', { className: 'nota-meta' }, `${formatearFechaHora(nota.fecha)} · ${autorDeNota(nota.profesionalId)}`),
    h('p', { className: 'texto-clinico' }, nota.texto),
  );
}

/**
 * Notas clínicas inmutables (C-12b, D7; PA-08): no hay editar ni borrar. "Ver más" agrega la página siguiente al
 * final (cada página es una lectura auditada); una nota nueva va primera.
 */
export function crearNotas(opciones: NotasOpciones): Notas {
  let liberada = false;
  let cargadas: Nota[] = [...opciones.inicial.contenido];
  let pagina = opciones.inicial.pagina;
  let totalPaginas = opciones.inicial.totalPaginas;
  let totalElementos = opciones.inicial.totalElementos;
  let pidiendo = false;
  let creando = false;

  const titulo = h('h2', { id: 'ficha-notas-titulo' }, 'Notas clínicas');
  const status = createFormStatus();
  const lista = h('div', { className: 'lista-notas' });
  const verMas = h('div', { className: 'ver-mas' });
  const element = h(
    'section',
    { className: 'notas-clinicas', attrs: { 'aria-labelledby': titulo.id } },
    titulo,
    h('p', { className: 'ayuda-campo' }, MSG_NOTAS_INMUTABLES),
  );

  if (!opciones.soloLectura) element.append(formulario());
  element.append(status.element, lista, verMas);

  function pintarLista(): void {
    clear(lista);
    lista.append(cargadas.length === 0 ? h('p', {}, MSG_SIN_NOTAS) : h('ul', { className: 'notas' }, ...cargadas.map(item)));
  }

  function pintarVerMas(): void {
    clear(verMas);
    if (pagina >= totalPaginas - 1) return;
    const boton = h('button', { attrs: { type: 'button' }, on: { click: () => void pedirMas(boton) } }, 'Ver más');
    verMas.append(boton);
  }

  async function pedirMas(boton: HTMLButtonElement): Promise<void> {
    if (pidiendo) return;
    pidiendo = true;
    boton.disabled = true;
    status.clear();
    try {
      const siguiente = await opciones.listar(pagina + 1);
      if (liberada) return;
      const vistas = new Set(cargadas.map((n) => n.id));
      cargadas = [...cargadas, ...siguiente.contenido.filter((n) => !vistas.has(n.id))];
      pagina = siguiente.pagina;
      totalPaginas = siguiente.totalPaginas;
      totalElementos = siguiente.totalElementos;
      pintarLista();
      pintarVerMas();
    } catch (error) {
      if (liberada || opciones.alError(error)) return;
      status.show(mensajeDeError(error));
      boton.disabled = false;
    } finally {
      pidiendo = false;
    }
  }

  function formulario(): HTMLElement {
    const texto = createTextAreaField({
      id: 'nota-texto',
      name: 'texto',
      label: 'Nueva nota',
      maxLength: MAX_NOTA,
      required: true,
      rows: 4,
      avisarExceso: true,
    });
    const submit = h('button', { attrs: { type: 'submit' } }, 'Agregar nota');
    const form = h(
      'form',
      {
        className: 'nota-nueva',
        attrs: { novalidate: true },
        on: {
          submit: (event) => {
            event.preventDefault();
            void crear();
          },
        },
      },
      texto.element,
      h('div', { className: 'acciones-form' }, submit),
    );

    async function crear(): Promise<void> {
      if (creando) return;
      status.clear();
      const resultado = validarNota(texto.value());
      applyFieldErrors([texto], resultado.ok ? {} : resultado.errors);
      if (!resultado.ok) return;
      creando = true;
      setBusy(form, submit, true);
      try {
        const nueva = await opciones.crear(resultado.value);
        if (liberada) return;
        cargadas = [nueva, ...cargadas.filter((n) => n.id !== nueva.id)];
        totalElementos += 1;
        texto.setValue('');
        pintarLista();
        opciones.anunciar(MSG_NOTA_AGREGADA);
      } catch (error) {
        if (liberada || opciones.alError(error)) return;
        if (tieneCodigo(error, CODIGO_PROFESIONAL_NO_VINCULADO)) {
          status.show(MSG_PROFESIONAL_NO_VINCULADO);
        } else if (error instanceof ApiError && error.kind === 'validation') {
          applyFieldErrors([texto], serverFieldErrors(error));
          status.show(MSG_CHECK_FIELDS);
        } else {
          status.show(mensajeDeError(error));
        }
      } finally {
        creando = false;
        if (!liberada) setBusy(form, submit, false);
      }
    }

    return form;
  }

  pintarLista();
  pintarVerMas();

  return {
    element,
    estado: () => ({ contenido: [...cargadas], pagina, tamanio: opciones.inicial.tamanio, totalElementos, totalPaginas }),
    liberar: () => {
      liberada = true;
    },
  };
}
