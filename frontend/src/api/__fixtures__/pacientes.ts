/** Cuerpos del contrato real de C-05 (knowledge-base/entrega/C-05.md) para los tests. Datos ficticios. */
import type { Paciente, Pagina } from '../types';

export const PACIENTE_ANA: Paciente = {
  id: 5,
  nombre: 'Ana',
  apellido: 'Pérez',
  dni: '30111222',
  fechaNacimiento: '1990-05-17',
  sexo: 'F',
  telefono: '1155550000',
  email: 'ana.perez@ejemplo.test',
  direccion: 'Calle Falsa 123',
  obraSocialTexto: 'OSDE 210',
  activo: true,
};

/** Solo los obligatorios; el resto llega `null`. */
export const PACIENTE_MINIMO: Paciente = {
  id: 6,
  nombre: 'Luis',
  apellido: 'Gómez',
  dni: '28999111',
  fechaNacimiento: null,
  sexo: null,
  telefono: null,
  email: null,
  direccion: null,
  obraSocialTexto: null,
  activo: true,
};

export const PAGINA_PACIENTES: Pagina<Paciente> = {
  contenido: [PACIENTE_ANA, PACIENTE_MINIMO],
  pagina: 0,
  tamanio: 10,
  totalElementos: 2,
  totalPaginas: 1,
};
