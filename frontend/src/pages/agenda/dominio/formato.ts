/** Formatos de fechas y nombres de la agenda, en la zona del consultorio y sin `Intl` local. */
import { aFechaHoraLocal } from '../../../utils/zonaHoraria';
import { diasDeSemana, diaSemanaIso } from './rango';

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

/** `HH:mm`; 1440 se escribe `24:00` (fin de un tramo que llega a medianoche). */
export function minutosAHora(minutos: number): string {
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
}

/** `martes 24/11`; vacío si la fecha es inválida. */
export function etiquetaDia(fecha: string): string {
  const dia = diaSemanaIso(fecha);
  const [, mes, d] = fecha.split('-');
  if (dia === null || mes === undefined || d === undefined) return '';
  return `${DIAS[dia - 1] ?? ''} ${d}/${mes}`;
}

/** `martes 24/11/2026`. */
export function fechaCompleta(fecha: string): string {
  const etiqueta = etiquetaDia(fecha);
  return etiqueta === '' ? '' : `${etiqueta}/${fecha.slice(0, 4)}`;
}

function ddmmaaaa(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia ?? ''}/${mes ?? ''}/${anio ?? ''}`;
}

/** Rango visible como texto: un día, o la semana de lunes a domingo. */
export function etiquetaRango(vista: 'dia' | 'semana', fecha: string): string {
  if (vista === 'dia') return fechaCompleta(fecha);
  const dias = diasDeSemana(fecha);
  const lunes = dias[0];
  const domingo = dias[6];
  return lunes === undefined || domingo === undefined ? '' : `Semana del ${ddmmaaaa(lunes)} al ${ddmmaaaa(domingo)}`;
}

/** `HH:mm` en la zona del consultorio; vacío si el instante es inválido. */
export function horaLocal(iso: string): string {
  return aFechaHoraLocal(iso)?.hora ?? '';
}

/** `Apellido, Nombre`. */
export function nombrePaciente(paciente: { nombre: string; apellido: string }): string {
  return `${paciente.apellido}, ${paciente.nombre}`;
}
