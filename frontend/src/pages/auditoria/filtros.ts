import { ACCIONES_AUDITORIA, type AccionAuditoria, type FiltrosAuditoria, type ValorDetalle } from '../../api/types';
import { aInstanteUtc, siguienteDia, ZONA_CONSULTORIO } from '../../utils/zonaHoraria';

/**
 * Validación y formato de la pantalla de auditoría (C-15 design D8/D9). Las fechas se eligen en la hora del
 * consultorio y viajan como instantes UTC: `desde` al inicio del día, `hasta` al inicio del día siguiente
 * (exclusivo). El id de entidad solo se envía con una entidad, porque el backend no distingue entidades por id.
 */

export const MSG_FECHA_INVALIDA = 'Fecha inválida.';
export const MSG_RANGO_INVERTIDO = 'Debe ser igual o posterior a "Desde".';
export const MSG_NUMERO_INVALIDO = 'Ingresá un número válido.';
export const MSG_ACCION_INVALIDA = 'Acción inválida.';

export interface ValoresFiltros {
  desde: string;
  hasta: string;
  accion: string;
  entidad: string;
  entidadId: string;
  usuarioId: string;
}

export type CampoFiltro = keyof ValoresFiltros;
export type Filtros = Omit<FiltrosAuditoria, 'page'>;
export type ResultadoFiltros = { ok: true; value: Filtros } | { ok: false; errors: Partial<Record<CampoFiltro, string>> };

function numeroPositivo(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d{1,15}$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function esAccion(valor: string): valor is AccionAuditoria {
  return ACCIONES_AUDITORIA.some((a) => a === valor);
}

export function validarFiltros(v: ValoresFiltros, zona: string = ZONA_CONSULTORIO): ResultadoFiltros {
  const errors: Partial<Record<CampoFiltro, string>> = {};
  const value: Filtros = {};

  if (v.desde !== '') {
    const desde = aInstanteUtc(v.desde, '00:00', zona);
    if (desde === null) errors.desde = MSG_FECHA_INVALIDA;
    else value.desde = desde;
  }
  if (v.hasta !== '') {
    const siguiente = siguienteDia(v.hasta);
    const hasta = siguiente === null ? null : aInstanteUtc(siguiente, '00:00', zona);
    if (hasta === null) errors.hasta = MSG_FECHA_INVALIDA;
    else value.hasta = hasta;
  }
  if (value.desde !== undefined && value.hasta !== undefined && Date.parse(value.desde) >= Date.parse(value.hasta)) {
    errors.hasta = MSG_RANGO_INVERTIDO;
  }

  if (v.accion !== '') {
    if (esAccion(v.accion)) value.accion = v.accion;
    else errors.accion = MSG_ACCION_INVALIDA;
  }
  if (v.entidad !== '') {
    value.entidad = v.entidad;
    if (v.entidadId.trim() !== '') {
      const id = numeroPositivo(v.entidadId);
      if (id === null) errors.entidadId = MSG_NUMERO_INVALIDO;
      else value.entidadId = id;
    }
  }
  if (v.usuarioId.trim() !== '') {
    const id = numeroPositivo(v.usuarioId);
    if (id === null) errors.usuarioId = MSG_NUMERO_INVALIDO;
    else value.usuarioId = id;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

/** `clave: valor, …` en el orden del backend; guion si no hay detalle. */
export function formatearDetalle(detalle: Readonly<Record<string, ValorDetalle>> | null): string {
  if (detalle === null) return '—';
  const partes = Object.entries(detalle).map(([clave, valor]) => `${clave}: ${String(valor)}`);
  return partes.length === 0 ? '—' : partes.join(', ');
}
