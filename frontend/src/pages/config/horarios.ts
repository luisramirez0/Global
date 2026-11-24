import type { DiaSemana, Horario, HorarioRequest } from '../../api/types';
import { createField, createSelectField } from '../../components/form';
import type { Page } from '../../router/router';
import type { PageContext } from '../context';
import { createCrudPage, type CrudForm } from './crudPage';
import { MSG_FRANJA_SUPERPUESTA, MSG_PROFESIONAL } from './mensajes';
import { puedeGestionar, rolActual } from './permisos';
import { GRILLA_MINUTOS, validarHorario } from './validacion';

export const DIAS: Readonly<Record<DiaSemana, string>> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const DIAS_ORDEN: readonly DiaSemana[] = [1, 2, 3, 4, 5, 6, 7];

function ordenar(horarios: readonly Horario[]): Horario[] {
  return [...horarios].sort((a, b) => a.diaSemana - b.diaSemana || a.horaDesde.localeCompare(b.horaDesde));
}

/**
 * Horarios de atención (US-002): franjas semanales en hora local del consultorio, sin solapamiento.
 * El alta omite `profesionalId` y el backend usa el único profesional activo; la edición reenvía el de la franja
 * (design D5 de C-11).
 */
export function renderHorarios(ctx: PageContext): Page {
  const gestiona = puedeGestionar(rolActual(ctx));

  const formulario = (): CrudForm<Horario, HorarioRequest> => {
    const dia = createSelectField({
      id: 'horario-dia',
      name: 'diaSemana',
      label: 'Día',
      options: DIAS_ORDEN.map((d) => ({ value: String(d), label: DIAS[d] })),
    });
    const desde = createField({ id: 'horario-desde', name: 'horaDesde', label: 'Desde', type: 'time', autocomplete: 'off', required: true });
    const hasta = createField({ id: 'horario-hasta', name: 'horaHasta', label: 'Hasta', type: 'time', autocomplete: 'off', required: true });
    return {
      controls: [dia, desde, hasta],
      elements: [dia.element, desde.element, hasta.element],
      fill(item) {
        dia.setValue(String(item?.diaSemana ?? 1));
        desde.setValue(item?.horaDesde ?? '');
        hasta.setValue(item?.horaHasta ?? '');
      },
      read(editing) {
        const result = validarHorario({ diaSemana: dia.value(), horaDesde: desde.value(), horaHasta: hasta.value() });
        if (!result.ok) return result;
        const request: HorarioRequest = editing === null ? result.value : { profesionalId: editing.profesionalId, ...result.value };
        return { ok: true, value: request };
      },
    };
  };

  const errores = { conflict: MSG_FRANJA_SUPERPUESTA, unprocessable: MSG_PROFESIONAL };

  return createCrudPage<Horario, HorarioRequest>({
    seccion: '/config/horarios',
    titulo: 'Horarios de atención',
    descripcion: `Franjas semanales de atención, en hora del consultorio y en múltiplos de ${GRILLA_MINUTOS} minutos. Las franjas de un mismo día no pueden superponerse.`,
    tituloAlta: 'Nueva franja',
    tituloEdicion: 'Editar franja',
    columnas: ['Día', 'Desde', 'Hasta'],
    celdas: (h) => [DIAS[h.diaSemana], h.horaDesde, h.horaHasta],
    etiqueta: (h) => `${DIAS[h.diaSemana]} ${h.horaDesde} a ${h.horaHasta}`,
    vacio: 'Todavía no hay horarios de atención.',
    cargar: async () => ordenar(await ctx.agenda.listarHorarios()),
    crear: (request) => ctx.agenda.crearHorario(request),
    editar: (item, request) => ctx.agenda.editarHorario(item.id, request),
    borrar: { etiqueta: 'Eliminar', ejecutar: (h) => ctx.agenda.borrarHorario(h.id), exito: 'Franja eliminada.' },
    puedeEscribir: gestiona,
    puedeBorrar: gestiona,
    formulario,
    contexto: { crear: errores, editar: errores },
    exito: { crear: 'Franja agregada.', editar: 'Franja actualizada.' },
  });
}
