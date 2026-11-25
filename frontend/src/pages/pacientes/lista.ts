import type { FiltroPacientes, Paciente, Pagina } from '../../api/types';
import { createField } from '../../components/form';
import type { Page } from '../../router/router';
import { clear, h } from '../../utils/dom';
import type { PageContext } from '../context';
import { puedeDarDeBaja, puedeVerFicha, rolActual } from '../permisos';
import {
  MSG_BAJA_OK,
  MSG_CARGANDO,
  MSG_REACTIVADO,
  MSG_SIN_RESULTADOS,
  esNoEncontrado,
  mensajeDeError,
  nombreCompleto,
} from './mensajes';

/** Título fijo (design D8): nunca lleva datos del paciente. */
export const TITULO_LISTA = 'Pacientes';

export const TAMANIO_PAGINA = 20;

/**
 * Lista y búsqueda de pacientes (C-12, D10). La búsqueda corre solo al enviar; el término vive en memoria (nunca en
 * la URL ni en el título). Las respuestas de búsquedas anteriores se descartan.
 */
export function renderPacientes(ctx: PageContext): Page {
  const gestion = puedeDarDeBaja(rolActual(ctx));
  const verFicha = puedeVerFicha(rolActual(ctx));
  let disposed = false;
  let seq = 0;
  let filtro: FiltroPacientes = { q: '', incluirInactivos: false, page: 0, size: TAMANIO_PAGINA };
  let confirmando: number | null = null;
  let ultima: Pagina<Paciente> | null = null;

  const estado = h('p', { className: 'estado', attrs: { role: 'status' } });
  const alerta = h('p', { className: 'alerta', attrs: { role: 'alert' } });
  const contenido = h('div', { className: 'contenido-lista' });

  const q = createField({
    id: 'pacientes-q',
    name: 'q',
    label: 'Buscar por nombre, apellido o DNI',
    type: 'text',
    autocomplete: 'off',
    maxLength: 100,
  });
  const inactivos = h('input', { id: 'pacientes-inactivos', attrs: { type: 'checkbox', name: 'incluirInactivos' } });
  const formBusqueda = h(
    'form',
    {
      className: 'busqueda',
      attrs: { role: 'search', novalidate: true },
      on: {
        submit: (event) => {
          event.preventDefault();
          filtro = { ...filtro, q: q.value(), incluirInactivos: inactivos.checked, page: 0 };
          cargar();
        },
      },
    },
    q.element,
    h('div', { className: 'campo campo-casilla' }, inactivos, h('label', { attrs: { for: inactivos.id } }, 'Incluir dados de baja')),
    h('button', { attrs: { type: 'submit' } }, 'Buscar'),
  );

  const element = h(
    'section',
    { className: 'pagina-pacientes' },
    h('h1', {}, TITULO_LISTA),
    h('p', {}, h('a', { attrs: { href: '#/pacientes/nuevo' } }, 'Nuevo paciente')),
    formBusqueda,
    estado,
    alerta,
    contenido,
  );

  function boton(texto: string, label: string, onClick: () => void): HTMLButtonElement {
    return h('button', { attrs: { type: 'button', 'aria-label': label }, on: { click: onClick } }, texto);
  }

  function acciones(p: Paciente): HTMLElement {
    const nombre = nombreCompleto(p);
    const celda = h('td', { className: 'acciones' }, h('a', { attrs: { href: `#/pacientes/${p.id}`, 'aria-label': `Editar ${nombre}` } }, 'Editar'));
    // C-12b (5.9): enlace a la historia clínica solo para quien puede verla (D2, PA-07).
    if (verFicha) celda.append(h('a', { attrs: { href: `#/pacientes/${p.id}/ficha`, 'aria-label': `Ficha de ${nombre}` } }, 'Ficha'));
    if (!gestion) return celda;
    if (!p.activo) {
      celda.append(boton('Reactivar', `Reactivar a ${nombre}`, () => void reactivar(p)));
    } else if (confirmando === p.id) {
      celda.append(
        h('span', {}, `¿Dar de baja a ${nombre}?`),
        boton('Confirmar', `Confirmar baja de ${nombre}`, () => void darDeBaja(p)),
        boton('Cancelar', `Cancelar baja de ${nombre}`, () => {
          confirmando = null;
          pintar();
        }),
      );
    } else {
      celda.append(
        boton('Dar de baja', `Dar de baja a ${nombre}`, () => {
          confirmando = p.id;
          pintar();
        }),
      );
    }
    return celda;
  }

  function tabla(pag: Pagina<Paciente>): HTMLElement {
    return h(
      'table',
      {},
      h(
        'thead',
        {},
        h('tr', {}, h('th', {}, 'Paciente'), h('th', {}, 'DNI'), h('th', {}, 'Teléfono'), h('th', {}, 'Estado'), h('th', {}, 'Acciones')),
      ),
      h(
        'tbody',
        {},
        ...pag.contenido.map((p) =>
          h(
            'tr',
            {},
            h('td', {}, nombreCompleto(p)),
            h('td', {}, p.dni),
            h('td', {}, p.telefono ?? '—'),
            h('td', {}, p.activo ? 'Activo' : 'Dado de baja'),
            acciones(p),
          ),
        ),
      ),
    );
  }

  function paginacion(pag: Pagina<Paciente>): HTMLElement | null {
    if (pag.totalPaginas <= 1) return null;
    const ir = (page: number): void => {
      filtro = { ...filtro, page };
      cargar();
    };
    return h(
      'nav',
      { className: 'paginacion', attrs: { 'aria-label': 'Páginas de resultados' } },
      h('button', { attrs: { type: 'button', disabled: pag.pagina <= 0 }, on: { click: () => ir(pag.pagina - 1) } }, 'Anterior'),
      h('span', {}, `Página ${pag.pagina + 1} de ${pag.totalPaginas}`),
      h(
        'button',
        { attrs: { type: 'button', disabled: pag.pagina >= pag.totalPaginas - 1 }, on: { click: () => ir(pag.pagina + 1) } },
        'Siguiente',
      ),
    );
  }

  function pintar(): void {
    clear(contenido);
    if (ultima === null) return;
    if (ultima.contenido.length === 0) {
      contenido.append(h('p', {}, MSG_SIN_RESULTADOS));
      return;
    }
    contenido.append(tabla(ultima), paginacion(ultima) ?? '');
  }

  function cargar(): void {
    const mio = ++seq;
    confirmando = null;
    alerta.textContent = '';
    clear(contenido);
    contenido.append(h('p', {}, MSG_CARGANDO));
    ctx.pacientes.buscar(filtro).then(
      (pag) => {
        if (disposed || mio !== seq) return;
        ultima = pag;
        pintar();
      },
      (error: unknown) => {
        if (disposed || mio !== seq) return;
        ultima = null;
        clear(contenido);
        alerta.textContent = mensajeDeError(error);
        contenido.append(h('button', { attrs: { type: 'button' }, on: { click: () => cargar() } }, 'Reintentar'));
      },
    );
  }

  async function ejecutar(accion: () => Promise<void>, exito: string): Promise<void> {
    estado.textContent = '';
    alerta.textContent = '';
    try {
      await accion();
      if (disposed) return;
      estado.textContent = exito;
      cargar();
    } catch (error) {
      if (disposed) return;
      confirmando = null;
      // `cargar` limpia la alerta: el aviso va después de recargar.
      if (esNoEncontrado(error)) cargar();
      else pintar();
      alerta.textContent = mensajeDeError(error);
    }
  }

  function darDeBaja(p: Paciente): Promise<void> {
    return ejecutar(() => ctx.pacientes.darDeBaja(p.id), MSG_BAJA_OK);
  }

  function reactivar(p: Paciente): Promise<void> {
    return ejecutar(() => ctx.pacientes.reactivar(p.id), MSG_REACTIVADO);
  }

  cargar();

  return {
    title: TITULO_LISTA,
    element,
    dispose() {
      disposed = true;
      ultima = null;
      clear(contenido);
    },
  };
}
