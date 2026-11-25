/** Resumen de lo renderizado en la vista (grilla y lista), calculado sin DOM para decidir el foco tras un cambio. */
import type { Turno } from '../../../api/types';
import { turnosDelDia, type ColumnaAgenda } from './columnas';
import type { VistaRenderizada } from './foco';
import { asignarCarriles } from './posicion';

export function instantaneaVista(datos: { columnas: readonly ColumnaAgenda[]; turnos: readonly Turno[]; fechas: readonly string[] }): VistaRenderizada {
  const grilla = datos.columnas.flatMap((columna, indice) => {
    const carriles = asignarCarriles(columna.turnos.map((t) => t.segmento));
    return columna.turnos.map(({ turno, segmento }, i) => ({
      id: turno.id,
      columna: indice,
      inicioMin: segmento.inicioMin,
      carril: carriles[i]?.carril ?? 0,
    }));
  });
  const lista = datos.fechas.flatMap((fecha) =>
    turnosDelDia(datos.turnos, fecha, null)
      .sort((a, b) => a.segmento.inicioMin - b.segmento.inicioMin || a.turno.id - b.turno.id)
      .map(({ turno }) => ({ id: turno.id, fecha })),
  );
  return { grilla, lista, fechas: datos.fechas };
}
