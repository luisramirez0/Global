/**
 * Validación de la historia clínica con las mismas reglas que el backend de C-08 (C-12b, design D4/D5/D7/D9):
 * `FichaRequest` (4000 por campo; en blanco → `null`, sin recortar), `NotaRequest` (`@NotBlank`, 10000) y la casilla
 * de aceptación del consentimiento. El servidor sigue siendo la fuente de verdad (A-D9).
 */
import type { FichaRequest } from '../../api/types';
import { MSG_REQUIRED } from '../auth/validation';

export const MAX_CAMPO_FICHA = 4000;
export const MAX_NOTA = 10_000;

export const MSG_EMBARAZO = 'Elegí una opción.';
export const MSG_ACEPTACION = 'Marcá la casilla para confirmar que el paciente aceptó el texto.';

const maxMsg = (max: number): string => `Máximo ${max} caracteres.`;

/** Valores del select de embarazo (tres estados, D5). */
export const EMBARAZO_OPCIONES = [
  { value: '', label: 'Sin dato' },
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
] as const;

export interface ValoresFicha {
  alergias: string;
  medicacionActual: string;
  antecedentesMedicos: string;
  enfermedadesRelevantes: string;
  /** `''`, `'si'` o `'no'`. */
  embarazo: string;
  motivoConsulta: string;
  observaciones: string;
}

export type CampoFicha = keyof ValoresFicha;

export const CAMPOS_TEXTO_FICHA = [
  'alergias',
  'medicacionActual',
  'antecedentesMedicos',
  'enfermedadesRelevantes',
  'motivoConsulta',
  'observaciones',
] as const satisfies readonly CampoFicha[];

export type Resultado<T, K extends string> = { ok: true; value: T } | { ok: false; errors: Partial<Record<K, string>> };

function texto(value: string): string | null {
  return value.trim() === '' ? null : value;
}

function embarazoDe(value: string): boolean | null | undefined {
  if (value === '') return null;
  if (value === 'si') return true;
  if (value === 'no') return false;
  return undefined;
}

/** `version` es la que leyó el cliente (`null` si la ficha no estaba cargada). */
export function validarFicha(valores: ValoresFicha, version: number | null): Resultado<FichaRequest, CampoFicha> {
  const errors: Partial<Record<CampoFicha, string>> = {};
  for (const campo of CAMPOS_TEXTO_FICHA) {
    if (valores[campo].length > MAX_CAMPO_FICHA) errors[campo] = maxMsg(MAX_CAMPO_FICHA);
  }
  const embarazo = embarazoDe(valores.embarazo);
  if (embarazo === undefined) errors.embarazo = MSG_EMBARAZO;
  if (Object.keys(errors).length > 0 || embarazo === undefined) return { ok: false, errors };
  return {
    ok: true,
    value: {
      alergias: texto(valores.alergias),
      medicacionActual: texto(valores.medicacionActual),
      antecedentesMedicos: texto(valores.antecedentesMedicos),
      enfermedadesRelevantes: texto(valores.enfermedadesRelevantes),
      embarazo,
      motivoConsulta: texto(valores.motivoConsulta),
      observaciones: texto(valores.observaciones),
      version,
    },
  };
}

export function validarNota(valor: string): Resultado<string, 'texto'> {
  if (valor.trim() === '') return { ok: false, errors: { texto: MSG_REQUIRED } };
  if (valor.length > MAX_NOTA) return { ok: false, errors: { texto: maxMsg(MAX_NOTA) } };
  return { ok: true, value: valor };
}

/** La casilla de aceptación es obligatoria (D4); devuelve el error o `null`. */
export function validarAceptacion(aceptado: boolean): string | null {
  return aceptado ? null : MSG_ACEPTACION;
}
