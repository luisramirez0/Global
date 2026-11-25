/** Instant de Java (ISO-8601 con zona): nunca una fecha local ambigua. */
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export function esInstanteIso(value: unknown): value is string {
  return typeof value === 'string' && INSTANTE.test(value) && !Number.isNaN(Date.parse(value));
}
