/**
 * Fixtures de pacientes de C-12 (ABM y ficha): cuerpos del contrato real de C-05 (knowledge-base/entrega/C-05.md, spec
 * patient-management). Datos ficticios.
 *
 * Conviven con `pacientes.ts` (fixtures de C-13 para la agenda, otra Ana con id 5): los tests de cada change importan
 * las suyas para no depender de los valores del otro.
 */
import type { Paciente, Pagina } from '../types';

export const PACIENTE_ANA: Paciente = {
  id: 7,
  nombre: 'Ana',
  apellido: 'Pérez',
  dni: '30111222',
  fechaNacimiento: '1985-04-12',
  sexo: 'F',
  telefono: '+5491123456789',
  email: 'ana.perez@correo.test',
  direccion: 'Calle Falsa 123',
  obraSocialTexto: 'OSDE 210',
  activo: true,
};

/** Solo los obligatorios. */
export const PACIENTE_LUIS: Paciente = {
  id: 8,
  nombre: 'Luis',
  apellido: 'Gómez',
  dni: '4111222',
  fechaNacimiento: null,
  sexo: null,
  telefono: null,
  email: null,
  direccion: null,
  obraSocialTexto: null,
  activo: true,
};

export const PACIENTE_INACTIVO: Paciente = { ...PACIENTE_LUIS, id: 9, nombre: 'Rosa', apellido: 'Díaz', dni: '20333444', activo: false };

export function pagina<T>(contenido: T[], extra: Partial<Omit<Pagina<T>, 'contenido'>> = {}): Pagina<T> {
  return {
    contenido,
    pagina: 0,
    tamanio: 20,
    totalElementos: contenido.length,
    totalPaginas: contenido.length === 0 ? 0 : 1,
    ...extra,
  };
}
