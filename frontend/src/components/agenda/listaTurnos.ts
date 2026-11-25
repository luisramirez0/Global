/**
 * Lista accesible de turnos (design D6 y D12 de C-13): la alternativa recorrible con Tab secuencial, en orden
 * cronológico, agrupada por día. Cada día de la vista tiene su `h2` (`tabindex="-1"`, destino estable de foco)
 * aunque no tenga turnos. Todo el texto entra como nodo de texto (regla 3).
 */
import type { Turno } from '../../api/types';
import { turnosDelDia } from '../../pages/agenda/dominio/columnas';
import { etiquetaDia, nombrePaciente } from '../../pages/agenda/dominio/formato';
import { ETIQUETA_ESTADO } from '../../pages/agenda/dominio/transiciones';
import { h } from '../../utils/dom';
import { marcasDelTurno, textoHoras } from './bloqueTurno';

export interface DatosLista {
  /** Los días de la vista (uno en la diaria, siete en la semanal). */
  fechas: readonly string[];
  turnos: readonly Turno[];
  nombreSillon(id: number): string;
}

export interface OpcionesLista {
  alAbrirAcciones(turnoId: number, opener: HTMLElement): void;
  alEnfocarTurno(turnoId: number): void;
}

export interface ListaTurnos {
  readonly element: HTMLElement;
  renderizar(datos: DatosLista): void;
  enfocarTurno(turnoId: number): boolean;
  enfocarDia(fecha: string): boolean;
}

export function crearLista(opciones: OpcionesLista): ListaTurnos {
  const element = h('section', { className: 'lista-turnos', attrs: { 'aria-label': 'Lista de turnos' } });

  element.addEventListener('focusin', (event) => {
    const objetivo = event.target;
    if (!(objetivo instanceof HTMLElement)) return;
    const id = Number(objetivo.dataset['turnoId']);
    if (objetivo.tagName === 'BUTTON' && Number.isSafeInteger(id)) opciones.alEnfocarTurno(id);
  });

  function renderizar(datos: DatosLista): void {
    const secciones = datos.fechas.map((fecha) => {
      const entradas = turnosDelDia(datos.turnos, fecha, null).sort(
        (a, b) => a.segmento.inicioMin - b.segmento.inicioMin || a.turno.id - b.turno.id,
      );
      const titulo = h('h2', { id: `lista-dia-${fecha}`, attrs: { tabindex: '-1', 'data-fecha': fecha } }, etiquetaDia(fecha));
      const contenido =
        entradas.length === 0
          ? h('p', { className: 'vacio' }, 'Sin turnos.')
          : h(
              'ol',
              {},
              ...entradas.map(({ turno, segmento }) => {
                const horas = textoHoras(segmento);
                const paciente = nombrePaciente(turno.paciente);
                const marcas = marcasDelTurno(turno, segmento);
                const acciones = h(
                  'button',
                  { attrs: { type: 'button', 'aria-label': `Acciones de ${horas}, ${paciente}`, 'data-turno-id': String(turno.id) } },
                  'Acciones',
                );
                acciones.addEventListener('click', () => opciones.alAbrirAcciones(turno.id, acciones));
                return h(
                  'li',
                  { className: `lista-turno turno--${turno.estado.toLowerCase()}` },
                  h('span', { className: 'turno-hora' }, horas),
                  h('span', { className: 'turno-paciente' }, paciente),
                  h('span', { className: 'turno-prestacion' }, turno.prestacion.nombre),
                  h('span', { className: 'turno-sillon' }, datos.nombreSillon(turno.sillonId)),
                  h('span', { className: 'turno-estado' }, ETIQUETA_ESTADO[turno.estado]),
                  ...marcas.map((marca) => h('span', { className: 'turno-marca' }, marca)),
                  acciones,
                );
              }),
            );
      return h('section', { className: 'lista-dia', attrs: { 'aria-labelledby': titulo.id } }, titulo, contenido);
    });
    element.replaceChildren(...secciones);
  }

  return {
    element,
    renderizar,
    enfocarTurno(turnoId) {
      const boton = element.querySelector<HTMLElement>(`button[data-turno-id="${turnoId}"]`);
      if (boton === null) return false;
      boton.focus();
      return true;
    },
    enfocarDia(fecha) {
      const titulo = element.querySelector<HTMLElement>(`h2[data-fecha="${fecha}"]`);
      if (titulo === null) return false;
      titulo.focus();
      return true;
    },
  };
}
