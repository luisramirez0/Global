/** Contenido del diálogo de un turno (detalle). Todo dato de la API entra como texto (regla 3). */
import type { Turno } from '../../api/types';
import { h } from '../../utils/dom';
import { aFechaHoraLocal } from '../../utils/zonaHoraria';
import { etiquetaDia, nombrePaciente } from './dominio/formato';
import { ETIQUETA_ESTADO } from './dominio/transiciones';

function fila(termino: string, valor: string): HTMLElement[] {
  return [h('dt', {}, termino), h('dd', {}, valor)];
}

export function contenidoDetalle(turno: Turno, nombreSillon: string): HTMLElement {
  const inicio = aFechaHoraLocal(turno.inicio);
  const fin = aFechaHoraLocal(turno.fin);
  const cuando = inicio === null || fin === null ? '' : `${etiquetaDia(inicio.fecha)}, ${inicio.hora}–${fin.hora}`;
  return h(
    'dl',
    { className: 'detalle-turno' },
    ...fila('Paciente', nombrePaciente(turno.paciente)),
    ...fila('Prestación', turno.prestacion.nombre),
    ...fila('Sillón', nombreSillon),
    ...fila('Cuándo', cuando),
    ...fila('Estado', ETIQUETA_ESTADO[turno.estado]),
    ...(turno.sobreturno ? fila('Tipo', 'Sobreturno') : []),
    ...(turno.notas === null ? [] : fila('Notas', turno.notas)),
    ...(turno.motivoCancelacion === null ? [] : fila('Motivo de cancelación', turno.motivoCancelacion)),
  );
}
