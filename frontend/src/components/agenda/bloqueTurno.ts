/**
 * Bloque de un turno en la grilla (design D5 y D9 de C-13): un `button` con nombre accesible. El estado se ve por
 * color, etiqueta de texto y borde; el sobreturno por texto y borde grueso. Todo el texto entra como nodo de
 * texto (regla 3) y la posición sale de números calculados, nunca de cadenas del usuario.
 */
import type { Turno } from '../../api/types';
import { minutosAHora, nombrePaciente } from '../../pages/agenda/dominio/formato';
import type { Carril, Posicion, SegmentoDia } from '../../pages/agenda/dominio/posicion';
import { ETIQUETA_ESTADO } from '../../pages/agenda/dominio/transiciones';
import { h } from '../../utils/dom';

export interface OpcionesBloque {
  turno: Turno;
  segmento: SegmentoDia;
  posicion: Posicion;
  carril: Carril;
  /** Solo en la vista semanal con varios sillones. */
  nombreSillon?: string;
}

/** `10:00–10:30`, recortado al día cuando el turno cruza la medianoche. */
export function textoHoras(segmento: SegmentoDia): string {
  return `${minutosAHora(segmento.inicioMin)}–${minutosAHora(segmento.finMin)}`;
}

export function marcasDelTurno(turno: Turno, segmento: SegmentoDia): string[] {
  const marcas: string[] = [];
  if (turno.sobreturno) marcas.push('Sobreturno');
  if (segmento.continua) marcas.push('Continúa');
  if (segmento.vieneDeAntes) marcas.push('Viene del día anterior');
  return marcas;
}

export function crearBloqueTurno(opciones: OpcionesBloque): HTMLButtonElement {
  const { turno, segmento, posicion, carril } = opciones;
  const horas = textoHoras(segmento);
  const paciente = nombrePaciente(turno.paciente);
  const estado = ETIQUETA_ESTADO[turno.estado];
  const marcas = marcasDelTurno(turno, segmento);
  const nombreAccesible = [horas, paciente, turno.prestacion.nombre, estado, ...marcas].join(', ');

  const clases = ['turno', `turno--${turno.estado.toLowerCase()}`];
  if (turno.sobreturno) clases.push('turno--sobreturno');

  const el = h(
    'button',
    { className: clases.join(' '), attrs: { type: 'button', 'aria-label': nombreAccesible, 'data-turno-id': String(turno.id) } },
    h('span', { className: 'turno-hora' }, horas),
    h('span', { className: 'turno-paciente' }, paciente),
    h('span', { className: 'turno-prestacion' }, turno.prestacion.nombre),
    opciones.nombreSillon === undefined ? null : h('span', { className: 'turno-sillon' }, opciones.nombreSillon),
    h('span', { className: 'turno-estado' }, estado),
    ...marcas.map((marca) => h('span', { className: 'turno-marca' }, marca)),
  );
  // CSSOM con números calculados: `h()` no admite el atributo `style`.
  el.style.gridRow = `${posicion.fila} / span ${posicion.filas}`;
  el.style.gridColumn = `${carril.carril + 1} / span 1`;
  return el;
}
