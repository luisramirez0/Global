import type { Ficha } from '../../api/types';
import { h } from '../../utils/dom';
import { MSG_SIN_DATO } from './mensajes';

/** Etiquetas de la anamnesis (D5). Los valores siempre se muestran como texto. */
export const ETIQUETAS_ANAMNESIS = {
  alergias: 'Alergias',
  medicacionActual: 'Medicación actual',
  antecedentesMedicos: 'Antecedentes médicos',
  enfermedadesRelevantes: 'Enfermedades relevantes',
  embarazo: 'Embarazo',
  motivoConsulta: 'Motivo de consulta',
  observaciones: 'Observaciones',
} as const;

export interface AnamnesisOpciones {
  ficha: Ficha;
}

export interface Anamnesis {
  readonly element: HTMLElement;
  /** Última ficha confirmada por el servidor (para re-renderizar sin volver a pedirla, D8). */
  actual(): Ficha;
}

export function textoEmbarazo(valor: boolean | null): string {
  if (valor === null) return MSG_SIN_DATO;
  return valor ? 'Sí' : 'No';
}

function vistaLectura(ficha: Ficha): HTMLElement {
  const filas: [string, string][] = [
    [ETIQUETAS_ANAMNESIS.alergias, ficha.alergias ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.medicacionActual, ficha.medicacionActual ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.antecedentesMedicos, ficha.antecedentesMedicos ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.enfermedadesRelevantes, ficha.enfermedadesRelevantes ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.embarazo, textoEmbarazo(ficha.embarazo)],
    [ETIQUETAS_ANAMNESIS.motivoConsulta, ficha.motivoConsulta ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.observaciones, ficha.observaciones ?? MSG_SIN_DATO],
  ];
  return h('dl', { className: 'anamnesis-lectura' }, ...filas.flatMap(([dt, dd]) => [h('dt', {}, dt), h('dd', { className: 'texto-clinico' }, dd)]));
}

/**
 * Anamnesis del paciente (C-12b, D5). Tarea 5.3: vista de solo lectura; la tarea 5.4 agrega el formulario con
 * control de versión.
 */
export function crearAnamnesis(opciones: AnamnesisOpciones): Anamnesis {
  const titulo = h('h2', { id: 'ficha-anamnesis-titulo' }, 'Anamnesis');
  const element = h('section', { className: 'anamnesis', attrs: { 'aria-labelledby': titulo.id } }, titulo, vistaLectura(opciones.ficha));
  return {
    element,
    actual: () => opciones.ficha,
  };
}
