import type { Bloqueo, BloqueoRequest, FiltroBloqueos, Sillon } from '../../api/types';
import { applyFieldErrors, createField, createSelectField, type SelectField, type SelectOption } from '../../components/form';
import type { Page } from '../../router/router';
import { h } from '../../utils/dom';
import { aFechaHoraLocal, formatearFechaHora, hoyEnZona } from '../../utils/zonaHoraria';
import type { PageContext } from '../context';
import { createCrudPage, type CrudForm, type CrudPage } from './crudPage';
import { puedeBorrarBloqueo, puedeEditarBloqueo, rolActual } from './permisos';
import { validarBloqueo, validarFiltroBloqueos } from './validacion';

const ALCANCE_CONSULTORIO = 'consultorio';
const SIN_MOTIVO = '—';
export const MSG_AVISO_PROFESIONAL = 'Este bloqueo también aplica a un profesional; se conserva al guardar.';

const valorSillon = (id: number): string => `sillon-${id}`;

function sillonDeAlcance(value: string): number | null {
  const m = /^sillon-(\d+)$/.exec(value);
  return m === null ? null : Number(m[1]);
}

/** `datetime-local` (`YYYY-MM-DDTHH:mm`) en hora del consultorio a partir de un instante UTC. */
function aInputLocal(iso: string): string {
  const local = aFechaHoraLocal(iso);
  return local === null ? '' : `${local.fecha}T${local.hora}`;
}

/**
 * Bloqueos de agenda (US-013). Se ingresan y muestran en hora de Argentina y viajan en UTC (design D4 de C-11).
 * El alcance se elige entre todo el consultorio o un sillón; un `profesionalId` existente se conserva (D5).
 * El listado arranca hoy, en Argentina (D8).
 */
export function renderBloqueos(ctx: PageContext): Page {
  const rol = rolActual(ctx);
  let sillones: readonly Sillon[] = [];
  let alcance: SelectField | null = null;
  let page: CrudPage<Bloqueo> | null = null;

  // Filtro: "hoy" en la zona del consultorio, no en UTC (V-D8).
  const hoy = hoyEnZona(Date.now());
  const filtroDesde = createField({ id: 'bloqueos-desde', name: 'filtroDesde', label: 'Desde', type: 'date', autocomplete: 'off' });
  const filtroHasta = createField({ id: 'bloqueos-hasta', name: 'filtroHasta', label: 'Hasta (inclusive)', type: 'date', autocomplete: 'off' });
  filtroDesde.setValue(hoy);
  let filtro: FiltroBloqueos = (() => {
    const inicial = validarFiltroBloqueos({ desde: hoy, hasta: '' });
    return inicial.ok ? inicial.value : {};
  })();

  function aplicarFiltro(): void {
    const result = validarFiltroBloqueos({ desde: filtroDesde.value(), hasta: filtroHasta.value() });
    // Los campos del filtro tienen nombres propios para no chocar con `inicio`/`fin` del formulario.
    applyFieldErrors([filtroDesde, filtroHasta], result.ok ? {} : { filtroDesde: result.errors.desde, filtroHasta: result.errors.hasta });
    if (!result.ok) return;
    filtro = result.value;
    page?.recargar();
  }

  const filtros = h(
    'div',
    { className: 'filtros', attrs: { role: 'search', 'aria-label': 'Filtrar bloqueos por fecha' } },
    filtroDesde.element,
    filtroHasta.element,
    h('button', { attrs: { type: 'button' }, on: { click: () => aplicarFiltro() } }, 'Filtrar'),
  );

  function nombreSillon(id: number): string {
    return sillones.find((s) => s.id === id)?.nombre ?? `Sillón #${id}`;
  }

  function opcionesAlcance(incluir: number | null): SelectOption[] {
    const opciones: SelectOption[] = [{ value: ALCANCE_CONSULTORIO, label: 'Todo el consultorio' }];
    for (const s of sillones) {
      if (s.activo) opciones.push({ value: valorSillon(s.id), label: s.nombre });
    }
    if (incluir !== null && !opciones.some((o) => o.value === valorSillon(incluir))) {
      const sillon = sillones.find((s) => s.id === incluir);
      opciones.push({ value: valorSillon(incluir), label: sillon === undefined ? `Sillón #${incluir}` : `${sillon.nombre} (inactivo)` });
    }
    return opciones;
  }

  function textoAlcance(b: Bloqueo): string {
    const partes: string[] = [];
    if (b.sillonId !== null) partes.push(`Sillón: ${nombreSillon(b.sillonId)}`);
    if (b.profesionalId !== null) partes.push('Profesional');
    return partes.length === 0 ? 'Todo el consultorio' : partes.join(' · ');
  }

  const avisoProfesional = h('p', { className: 'aviso aviso-profesional', attrs: { hidden: true } }, MSG_AVISO_PROFESIONAL);

  const formulario = (): CrudForm<Bloqueo, BloqueoRequest> => {
    const campoAlcance = createSelectField({ id: 'bloqueo-alcance', name: 'alcance', label: 'Alcance', options: opcionesAlcance(null) });
    alcance = campoAlcance;
    const inicio = createField({ id: 'bloqueo-inicio', name: 'inicio', label: 'Inicio', type: 'datetime-local', autocomplete: 'off', required: true });
    const fin = createField({ id: 'bloqueo-fin', name: 'fin', label: 'Fin', type: 'datetime-local', autocomplete: 'off', required: true });
    const motivo = createField({ id: 'bloqueo-motivo', name: 'motivo', label: 'Motivo (opcional)', type: 'text', autocomplete: 'off' });
    return {
      controls: [campoAlcance, inicio, fin, motivo],
      elements: [
        h('p', { className: 'ayuda' }, 'Fechas y horas en hora del consultorio (Argentina).'),
        campoAlcance.element,
        inicio.element,
        fin.element,
        motivo.element,
        avisoProfesional,
      ],
      fill(item) {
        campoAlcance.setOptions(opcionesAlcance(item?.sillonId ?? null));
        campoAlcance.setValue(item?.sillonId == null ? ALCANCE_CONSULTORIO : valorSillon(item.sillonId));
        inicio.setValue(item === null ? '' : aInputLocal(item.inicio));
        fin.setValue(item === null ? '' : aInputLocal(item.fin));
        motivo.setValue(item?.motivo ?? '');
      },
      read(editing) {
        const result = validarBloqueo({ inicio: inicio.value(), fin: fin.value(), motivo: motivo.value() });
        if (!result.ok) return result;
        return {
          ok: true,
          value: {
            sillonId: sillonDeAlcance(campoAlcance.value()),
            // Sin selector de profesional en el MVP: el de un bloqueo existente se conserva (D5).
            profesionalId: editing?.profesionalId ?? null,
            ...result.value,
          },
        };
      },
    };
  };

  page = createCrudPage<Bloqueo, BloqueoRequest>({
    seccion: '/config/bloqueos',
    titulo: 'Bloqueos de agenda',
    descripcion: 'Franjas en las que no se pueden dar turnos (vacaciones, feriados, mantenimiento), para todo el consultorio o un sillón.',
    tituloAlta: 'Nuevo bloqueo',
    tituloEdicion: 'Editar bloqueo',
    columnas: ['Inicio', 'Fin', 'Alcance', 'Motivo'],
    celdas: (b) => [formatearFechaHora(b.inicio), formatearFechaHora(b.fin), textoAlcance(b), b.motivo ?? SIN_MOTIVO],
    etiqueta: (b) => `bloqueo del ${formatearFechaHora(b.inicio)}`,
    vacio: 'No hay bloqueos en el rango elegido.',
    async cargar() {
      const [bloqueos, lista] = await Promise.all([ctx.agenda.listarBloqueos(filtro), ctx.agenda.listarSillones(true)]);
      sillones = lista;
      alcance?.setOptions(opcionesAlcance(sillonDeAlcance(alcance.value())));
      return [...bloqueos].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
    },
    crear: (request) => ctx.agenda.crearBloqueo(request),
    editar: (item, request) => ctx.agenda.editarBloqueo(item.id, request),
    borrar: { etiqueta: 'Eliminar', ejecutar: (b) => ctx.agenda.borrarBloqueo(b.id), exito: 'Bloqueo eliminado.' },
    puedeEscribir: puedeEditarBloqueo(rol),
    puedeBorrar: puedeBorrarBloqueo(rol),
    formulario,
    exito: { crear: 'Bloqueo agregado.', editar: 'Bloqueo actualizado.' },
    herramientas: [filtros],
    alCambiarEdicion(item) {
      avisoProfesional.hidden = item?.profesionalId == null;
    },
  });
  return page;
}
