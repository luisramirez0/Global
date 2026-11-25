/** Armado de rutas y query strings compartido por los clientes de la API. */

/** `/recurso/{id}`; un id que no es entero positivo es un error de programación (nunca llega a la API). */
export function conId(base: string, id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Error de programación: id de ruta inválido');
  }
  return `${base}/${id}`;
}

/** Agrega los parámetros con valor; los `undefined` se omiten. */
export function conQuery(base: string, params: Readonly<Record<string, string | undefined>>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value);
  }
  const text = query.toString();
  return text === '' ? base : `${base}?${text}`;
}
