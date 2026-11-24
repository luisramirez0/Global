import type { Prestacion, PrestacionRequest } from '../../api/types';
import { createField } from '../../components/form';
import type { Page } from '../../router/router';
import type { PageContext } from '../context';
import { createCrudPage, type CrudForm } from './crudPage';
import { createCasilla } from './herramientas';
import { puedeGestionar, rolActual } from './permisos';
import { GRILLA_MINUTOS, validarPrestacion } from './validacion';

/** Prestaciones (US-002, RN-AG-03): duración múltiplo de la grilla; baja lógica con reactivación. */
export function renderPrestaciones(ctx: PageContext): Page {
  const gestiona = puedeGestionar(rolActual(ctx));
  let incluirInactivas = false;

  const formulario = (): CrudForm<Prestacion, PrestacionRequest> => {
    const nombre = createField({
      id: 'prestacion-nombre',
      name: 'nombre',
      label: 'Nombre',
      type: 'text',
      autocomplete: 'off',
      required: true,
    });
    const duracion = createField({
      id: 'prestacion-duracion',
      name: 'duracionMinutos',
      label: `Duración (minutos, múltiplo de ${GRILLA_MINUTOS})`,
      type: 'text',
      autocomplete: 'off',
      inputmode: 'numeric',
      required: true,
    });
    return {
      controls: [nombre, duracion],
      elements: [nombre.element, duracion.element],
      fill(item) {
        nombre.setValue(item?.nombre ?? '');
        duracion.setValue(item === null ? '' : String(item.duracionMinutos));
      },
      read: () => validarPrestacion({ nombre: nombre.value(), duracion: duracion.value() }),
    };
  };

  const page = createCrudPage<Prestacion, PrestacionRequest>({
    seccion: '/config/prestaciones',
    titulo: 'Prestaciones',
    descripcion: `Cada prestación define la duración del turno, en múltiplos de ${GRILLA_MINUTOS} minutos.`,
    tituloAlta: 'Nueva prestación',
    tituloEdicion: 'Editar prestación',
    columnas: ['Nombre', 'Duración', 'Estado'],
    celdas: (p) => [p.nombre, `${p.duracionMinutos} min`, p.activo ? 'Activa' : 'Inactiva'],
    etiqueta: (p) => p.nombre,
    vacio: 'Todavía no hay prestaciones.',
    cargar: () => ctx.agenda.listarPrestaciones(incluirInactivas),
    crear: (request) => ctx.agenda.crearPrestacion(request),
    editar: (item, request) => ctx.agenda.editarPrestacion(item.id, request),
    borrar: {
      etiqueta: 'Dar de baja',
      visible: (p) => p.activo,
      ejecutar: (p) => ctx.agenda.borrarPrestacion(p.id),
      exito: 'Prestación dada de baja.',
    },
    accionesEscritura: [
      {
        etiqueta: 'Reactivar',
        visible: (p) => !p.activo,
        ejecutar: (p) => ctx.agenda.editarPrestacion(p.id, { nombre: p.nombre, duracionMinutos: p.duracionMinutos, activo: true }),
        exito: 'Prestación reactivada.',
      },
    ],
    puedeEscribir: gestiona,
    puedeBorrar: gestiona,
    formulario,
    exito: { crear: 'Prestación agregada.', editar: 'Prestación actualizada.' },
    herramientas: [
      createCasilla({
        id: 'prestaciones-inactivas',
        name: 'incluirInactivas',
        label: 'Mostrar inactivas',
        onChange: (checked) => {
          incluirInactivas = checked;
          page.recargar();
        },
      }),
    ],
  });
  return page;
}
