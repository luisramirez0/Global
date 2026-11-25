/** Utilidades de texto compartidas. */

/** Largo en bytes UTF-8 (`TextEncoder`), como `@MaxUtf8Bytes` del backend: `ñ` ocupa 2 y un emoji 4. */
export function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}
