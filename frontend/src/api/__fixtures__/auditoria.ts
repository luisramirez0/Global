/**
 * Cuerpos del contrato real de `GET /api/auditoria` (knowledge-base/entrega/C-06.md) y del export de C-15 para
 * los tests. Datos ficticios, sin personas reales.
 */
import type { EntradaAuditoria, Pagina } from '../types';

export const ENTRADA_FICHA: EntradaAuditoria = {
  id: 11,
  fecha: '2026-11-24T13:05:00Z',
  usuarioId: 2,
  accion: 'UPDATE',
  entidad: 'FichaClinica',
  entidadId: 7,
  detalle: { fichaId: 3, version: 1 },
  ip: '127.0.0.1',
};

export const ENTRADA_LOGIN: EntradaAuditoria = {
  id: 10,
  fecha: '2026-11-24T12:00:00Z',
  usuarioId: null,
  accion: 'LOGIN',
  entidad: 'Usuario',
  entidadId: null,
  detalle: null,
  ip: null,
};

export const ENTRADA_EXPORT: EntradaAuditoria = {
  id: 12,
  fecha: '2026-11-24T13:10:00Z',
  usuarioId: 2,
  accion: 'EXPORT',
  entidad: 'Paciente',
  entidadId: 7,
  detalle: { consentimientos: 1, ficha: true, notas: 2, turnos: 0 },
  ip: '127.0.0.1',
};

export function paginaDe<T>(contenido: readonly T[], extra: Partial<Pagina<T>> = {}): Pagina<T> {
  return { contenido: [...contenido], pagina: 0, tamanio: 20, totalElementos: contenido.length, totalPaginas: 1, ...extra };
}

export const EXPORT_PACIENTE_7 = {
  exportadoEn: '2026-11-24T13:10:00Z',
  paciente: { id: 7, nombre: 'Paciente', apellido: 'De Prueba', dni: '30111222', activo: true },
  consentimientos: [],
  ficha: null,
  notas: [],
  turnos: [],
};
