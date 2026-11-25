/**
 * Buscador de pacientes del alta (design D1 de C-13): texto de al menos 2 caracteres, *debounce*, opciones
 * "Apellido, Nombre — DNI" elegibles con clic o teclado, respuestas tardías descartadas y mensaje fijo ante
 * un error. El dato del paciente solo entra como nodo de texto (regla 3) y nunca a la consola ni a la URL.
 */
import type { PacientesApi } from '../../api/pacientes';
import type { Paciente } from '../../api/types';
import { messageForError } from '../../pages/auth/messages';
import { nombrePaciente } from '../../pages/agenda/dominio/formato';
import { h } from '../../utils/dom';
import type { FormControl } from '../form';

export const MIN_CARACTERES_BUSQUEDA = 2;
export const DEBOUNCE_BUSQUEDA_MS = 300;
const TAMANIO_RESULTADOS = 10;
let secuencia = 0;

export interface OpcionesBuscador {
  buscar: PacientesApi['buscar'];
  alElegir?(paciente: Paciente): void;
}

export interface BuscadorPaciente extends FormControl {
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  /** Id del paciente elegido, o `null`. */
  valor(): number | null;
  elegir(paciente: Paciente): void;
}

export function crearBuscadorPaciente(opciones: OpcionesBuscador): BuscadorPaciente {
  secuencia += 1;
  const id = `buscador-paciente-${secuencia}`;
  const input = h('input', {
    id,
    attrs: { type: 'text', name: 'paciente', autocomplete: 'off', 'aria-describedby': `${id}-estado` },
  });
  const error = h('p', { id: `${id}-error`, className: 'error-campo' });
  const estado = h('p', { id: `${id}-estado`, className: 'estado-busqueda', attrs: { role: 'status' } });
  const alerta = h('p', { className: 'alerta', attrs: { role: 'alert' } });
  const lista = h('ul', { className: 'resultados-paciente' });
  const element = h(
    'div',
    { className: 'campo buscador-paciente' },
    h('label', { attrs: { for: id } }, 'Paciente'),
    input,
    error,
    estado,
    alerta,
    lista,
  );

  let elegido: Paciente | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;

  function limpiarResultados(): void {
    lista.replaceChildren();
    estado.textContent = '';
    alerta.textContent = '';
  }

  function cancelarPendiente(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    seq += 1; // invalida cualquier respuesta en vuelo
  }

  function opcionesActuales(): HTMLButtonElement[] {
    return [...lista.querySelectorAll<HTMLButtonElement>('button')];
  }

  function elegir(paciente: Paciente): void {
    cancelarPendiente();
    elegido = paciente;
    input.value = nombrePaciente(paciente);
    limpiarResultados();
    opciones.alElegir?.(paciente);
  }

  function mostrar(pacientes: readonly Paciente[]): void {
    alerta.textContent = '';
    estado.textContent = pacientes.length === 0 ? 'Sin resultados.' : `${pacientes.length} ${pacientes.length === 1 ? 'resultado' : 'resultados'}.`;
    lista.replaceChildren(
      ...pacientes.map((paciente) =>
        h(
          'li',
          {},
          h(
            'button',
            { attrs: { type: 'button' }, on: { click: () => elegir(paciente) } },
            `${nombrePaciente(paciente)} — DNI ${paciente.dni}`,
          ),
        ),
      ),
    );
  }

  function buscar(texto: string): void {
    const actual = ++seq;
    opciones
      .buscar({ q: texto, size: TAMANIO_RESULTADOS })
      .then((pagina) => {
        if (actual === seq) mostrar(pagina.contenido);
      })
      .catch((e: unknown) => {
        if (actual !== seq) return;
        lista.replaceChildren();
        estado.textContent = '';
        alerta.textContent = messageForError(e);
      });
  }

  input.addEventListener('input', () => {
    elegido = null;
    cancelarPendiente();
    const texto = input.value.trim();
    if (texto.length < MIN_CARACTERES_BUSQUEDA) {
      limpiarResultados();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      buscar(texto);
    }, DEBOUNCE_BUSQUEDA_MS);
  });

  function moverEntreOpciones(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const botones = opcionesActuales();
    const indice = botones.findIndex((b) => b === event.target);
    if (event.target === input) {
      if (event.key === 'ArrowDown' && botones[0] !== undefined) {
        event.preventDefault();
        botones[0].focus();
      }
      return;
    }
    if (indice < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowDown') botones[Math.min(indice + 1, botones.length - 1)]?.focus();
    else if (indice === 0) input.focus();
    else botones[indice - 1]?.focus();
  }
  element.addEventListener('keydown', moverEntreOpciones);

  return {
    name: 'pacienteId',
    element,
    input,
    valor: () => elegido?.id ?? null,
    elegir,
    setError(message) {
      error.textContent = message ?? '';
      if (message === null) {
        input.removeAttribute('aria-invalid');
        input.setAttribute('aria-describedby', `${id}-estado`);
      } else {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', `${error.id} ${id}-estado`);
      }
    },
    focus: () => input.focus(),
  };
}
