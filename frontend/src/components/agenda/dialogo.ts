/**
 * Diálogo modal accesible (design D7 de C-13): nombre por `aria-labelledby`, foco atrapado, Escape y "Cerrar",
 * foco devuelto a quien lo abrió. Usa `showModal` si existe; si no (jsdom), *fallback* con `role="dialog"`,
 * `aria-modal` y `open`. Un solo diálogo a la vez: los pasos (confirmaciones) reemplazan el contenido.
 */
import { h } from '../../utils/dom';

export interface OpcionesDialogo {
  titulo: string;
  contenido: readonly Node[];
  /** Elemento que recibe el foco al abrir; por defecto el primer campo o, si no hay, el primer botón. */
  foco?: () => HTMLElement | null;
  alCerrar?: () => void;
  /** Quien lo abrió (por defecto el elemento enfocado al abrir). */
  opener?: HTMLElement | null;
}

export interface Dialogo {
  readonly element: HTMLDialogElement;
  /** Contenedor del contenido actual (sin título ni "Cerrar"). */
  readonly cuerpo: HTMLElement;
  cerrar(opciones?: { devolverFoco?: boolean }): void;
  /** Cambia título y contenido sin abrir otro diálogo; enfoca `foco` o el primer campo/botón. */
  reemplazar(titulo: string, contenido: readonly Node[], foco?: () => HTMLElement | null): void;
  abierto(): boolean;
}

const ENFOCABLES = 'a[href], button, input, select, textarea, [tabindex]';
let secuencia = 0;

function esEnfocable(el: HTMLElement): boolean {
  if (el.hasAttribute('hidden') || el.hasAttribute('disabled')) return false;
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  if (el.getAttribute('tabindex') === '-1') return false;
  // `aria-disabled` NO excluye: esos botones siguen enfocables para leer el motivo.
  return true;
}

export function abrirDialogo(opciones: OpcionesDialogo): Dialogo {
  secuencia += 1;
  const idTitulo = `dialogo-titulo-${secuencia}`;
  const activo = document.activeElement;
  const opener = opciones.opener ?? (activo instanceof HTMLElement && activo !== document.body ? activo : null);

  const titulo = h('h2', { id: idTitulo }, opciones.titulo);
  const cuerpo = h('div', { className: 'dialogo-cuerpo' }, ...opciones.contenido);
  const cerrarBoton = h('button', { attrs: { type: 'button' }, on: { click: () => cerrar() } }, 'Cerrar');
  const element = h(
    'dialog',
    { className: 'dialogo', attrs: { 'aria-labelledby': idTitulo } },
    titulo,
    cuerpo,
    h('div', { className: 'dialogo-pie' }, cerrarBoton),
  );

  let abierto = true;

  function enfocables(): HTMLElement[] {
    return [...element.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(esEnfocable);
  }

  function enfocarInicial(foco?: () => HTMLElement | null): void {
    const pedido = foco?.() ?? null;
    if (pedido !== null) {
      pedido.focus();
      return;
    }
    const interno = [...cuerpo.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(esEnfocable);
    const campo = interno.find((el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement);
    (campo ?? interno[0] ?? cerrarBoton).focus();
  }

  function cerrar(opcionesCierre: { devolverFoco?: boolean } = {}): void {
    if (!abierto) return;
    abierto = false;
    if (typeof element.close === 'function') element.close();
    element.remove();
    if ((opcionesCierre.devolverFoco ?? true) && opener !== null && opener.isConnected) opener.focus();
    opciones.alCerrar?.();
  }

  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cerrar();
      return;
    }
    if (event.key !== 'Tab') return;
    const lista = enfocables();
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (primero === undefined || ultimo === undefined) return;
    if (event.shiftKey && document.activeElement === primero) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primero.focus();
    }
  });
  // Escape en el camino nativo llega como `cancel`: se cierra con nuestro manejo del foco.
  element.addEventListener('cancel', (event) => {
    event.preventDefault();
    cerrar();
  });

  document.body.append(element);
  if (typeof element.showModal === 'function') {
    element.showModal();
  } else {
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.setAttribute('open', '');
  }
  enfocarInicial(opciones.foco);

  return {
    element,
    cuerpo,
    cerrar,
    reemplazar(nuevoTitulo, contenido, foco) {
      titulo.textContent = nuevoTitulo;
      cuerpo.replaceChildren(...contenido);
      enfocarInicial(foco);
    },
    abierto: () => abierto,
  };
}
