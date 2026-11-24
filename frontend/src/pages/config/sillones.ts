import type { Sillon, SillonRequest } from '../../api/types';
import { createField } from '../../components/form';
import type { Page } from '../../router/router';
import type { PageContext } from '../context';
import { createCrudPage, type CrudForm } from './crudPage';
import { createCasilla } from './herramientas';
import { MSG_LIMITE_SILLONES, MSG_ULTIMO_SILLON } from './mensajes';
import { puedeGestionar, rolActual } from './permisos';
import { validarSillon } from './validacion';

/** Sillones (US-002): máximo 2 activos y al menos 1; baja lógica con reactivación (design D7 de C-11). */
export function renderSillones(ctx: PageContext): Page {
  const gestiona = puedeGestionar(rolActual(ctx));
  let incluirInactivos = false;

  const formulario = (): CrudForm<Sillon, SillonRequest> => {
    const nombre = createField({ id: 'sillon-nombre', name: 'nombre', label: 'Nombre', type: 'text', autocomplete: 'off', required: true });
    return {
      controls: [nombre],
      elements: [nombre.element],
      fill: (item) => nombre.setValue(item?.nombre ?? ''),
      // La edición omite `activo`: el backend lo deja como está.
      read: () => validarSillon({ nombre: nombre.value() }),
    };
  };

  const page = createCrudPage<Sillon, SillonRequest>({
    seccion: '/config/sillones',
    titulo: 'Sillones',
    descripcion: 'El consultorio puede tener hasta 2 sillones activos y necesita al menos uno.',
    tituloAlta: 'Nuevo sillón',
    tituloEdicion: 'Editar sillón',
    columnas: ['Nombre', 'Estado'],
    celdas: (s) => [s.nombre, s.activo ? 'Activo' : 'Inactivo'],
    etiqueta: (s) => s.nombre,
    vacio: 'Todavía no hay sillones.',
    cargar: () => ctx.agenda.listarSillones(incluirInactivos),
    crear: (request) => ctx.agenda.crearSillon(request),
    editar: (item, request) => ctx.agenda.editarSillon(item.id, request),
    borrar: {
      etiqueta: 'Dar de baja',
      visible: (s) => s.activo,
      ejecutar: (s) => ctx.agenda.borrarSillon(s.id),
      exito: 'Sillón dado de baja.',
      contexto: { conflict: MSG_ULTIMO_SILLON },
    },
    accionesEscritura: [
      {
        etiqueta: 'Reactivar',
        visible: (s) => !s.activo,
        ejecutar: (s) => ctx.agenda.editarSillon(s.id, { nombre: s.nombre, activo: true }),
        exito: 'Sillón reactivado.',
        contexto: { conflict: MSG_LIMITE_SILLONES },
      },
    ],
    puedeEscribir: gestiona,
    puedeBorrar: gestiona,
    formulario,
    contexto: { crear: { conflict: MSG_LIMITE_SILLONES } },
    exito: { crear: 'Sillón agregado.', editar: 'Sillón actualizado.' },
    herramientas: [
      createCasilla({
        id: 'sillones-inactivos',
        name: 'incluirInactivos',
        label: 'Mostrar inactivos',
        onChange: (checked) => {
          incluirInactivos = checked;
          page.recargar();
        },
      }),
    ],
  });
  return page;
}
