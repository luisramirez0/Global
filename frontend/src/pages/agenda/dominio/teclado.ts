/**
 * Navegación por teclado dentro de la grilla (design D12 de C-13): modelo espacial con *roving tabindex*.
 * Función pura sobre el mapa de los bloques renderizados; no conoce el DOM.
 */

export type TeclaNavegacion = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/** Un bloque de la grilla: su columna (de izquierda a derecha), su hora de inicio y su carril. */
export interface EntradaTeclado {
  id: number;
  columna: number;
  inicioMin: number;
  /** Desempata turnos con el mismo inicio; ausente = 0. */
  carril?: number;
}

function comparar(a: EntradaTeclado, b: EntradaTeclado): number {
  return a.inicioMin - b.inicioMin || (a.carril ?? 0) - (b.carril ?? 0) || a.id - b.id;
}

/**
 * Id del turno al que mover el foco con `tecla` desde `actualId`. En los bordes devuelve `actualId` (sin
 * moverse, sin envolver). `null` si el mapa está vacío o el turno actual no está en él.
 */
export function siguienteTurno(mapa: readonly EntradaTeclado[], actualId: number, tecla: TeclaNavegacion): number | null {
  const actual = mapa.find((entrada) => entrada.id === actualId);
  if (actual === undefined) return null;

  const enColumna = mapa.filter((entrada) => entrada.columna === actual.columna).sort(comparar);
  const posicion = enColumna.findIndex((entrada) => entrada.id === actualId);

  switch (tecla) {
    case 'ArrowUp':
      return enColumna[posicion - 1]?.id ?? actualId;
    case 'ArrowDown':
      return enColumna[posicion + 1]?.id ?? actualId;
    case 'Home':
      return enColumna[0]?.id ?? actualId;
    case 'End':
      return enColumna[enColumna.length - 1]?.id ?? actualId;
    case 'ArrowLeft':
      return masCercanoEnColumnaAdyacente(mapa, actual, -1)?.id ?? actualId;
    case 'ArrowRight':
      return masCercanoEnColumnaAdyacente(mapa, actual, 1)?.id ?? actualId;
    default: {
      const exhaustivo: never = tecla;
      return exhaustivo;
    }
  }
}

/** Columna más cercana con turnos en esa dirección y, en ella, el inicio más cercano (empate: el más temprano). */
function masCercanoEnColumnaAdyacente(
  mapa: readonly EntradaTeclado[],
  actual: EntradaTeclado,
  sentido: -1 | 1,
): EntradaTeclado | undefined {
  const candidatas = mapa.filter((entrada) => (entrada.columna - actual.columna) * sentido > 0);
  if (candidatas.length === 0) return undefined;
  const columna = candidatas.reduce(
    (cercana, entrada) => (Math.abs(entrada.columna - actual.columna) < Math.abs(cercana - actual.columna) ? entrada.columna : cercana),
    candidatas[0]?.columna ?? actual.columna,
  );
  return candidatas
    .filter((entrada) => entrada.columna === columna)
    .sort((a, b) => Math.abs(a.inicioMin - actual.inicioMin) - Math.abs(b.inicioMin - actual.inicioMin) || comparar(a, b))[0];
}
