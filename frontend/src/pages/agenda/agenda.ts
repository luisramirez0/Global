/**
 * Página `/agenda` (design D5, D6, D11 y D12 de C-13): vistas diaria y semanal sobre una grilla, lista accesible
 * equivalente, filtro de sillón, cancelados, alta de turno, acciones de estado, reprogramación y aviso por varios
 * profesionales (DP-1). Toda fecha y hora se calcula en la zona del consultorio; ningún texto de la API se
 * interpreta como HTML. Tras una mutación exitosa lo único que recarga solo es la agenda, y la recarga vigente
 * decide el foco (`focoTrasCambio`) y el anuncio.
 */
import type { Bloqueo, Horario, Prestacion, Sillon, Turno } from '../../api/types';
import { abrirDialogo, type Dialogo, type OpcionesDialogo } from '../../components/agenda/dialogo';
import { crearGrilla, type Hueco } from '../../components/agenda/grilla';
import { crearLista } from '../../components/agenda/listaTurnos';
import { createSelectField } from '../../components/form';
import type { Page } from '../../router/router';
import { h } from '../../utils/dom';
import { GRILLA_MINUTOS } from '../../utils/grilla';
import { hoyEnZona } from '../../utils/zonaHoraria';
import { messageForError } from '../auth/messages';
import { rolActual } from '../config/permisos';
import type { PageContext } from '../context';
import { abrirAccionesTurno, type CambioExitoso } from './accionesTurno';
import { abrirAltaTurno } from './altaTurno';
import { armarColumnas, nombreSillon, type Vista } from './dominio/columnas';
import { calcularFranja } from './dominio/franja';
import { anuncioCambio, focoTrasCambio, sigueVisible, type DestinoFoco, type OrigenFoco, type VistaRenderizada } from './dominio/foco';
import { etiquetaRango } from './dominio/formato';
import { instantaneaVista } from './dominio/instantanea';
import { puedeOfrecerSobreturno } from './dominio/permisos';
import { precargaNuevoTurno, turnoEnfocadoVigente, type Precarga } from './dominio/precarga';
import { hayVariosProfesionales } from './dominio/profesionales';
import { diasDeSemana, rangoDia, rangoSemana, sumarDias, type RangoUtc } from './dominio/rango';
import { MSG_TURNO_CREADO } from './mensajes';

export const MSG_VARIOS_PROFESIONALES = 'La agenda con varios profesionales no está disponible en esta versión.';
export const MSG_SIN_TURNOS = 'No hay turnos en este rango.';
const MSG_CARGANDO = 'Cargando…';

function ddmm(fecha: string): string {
  const [, mes, dia] = fecha.split('-');
  return `${dia ?? ''}/${mes ?? ''}`;
}

/** Una mutación exitosa (o "Recargar agenda") cuyo foco y anuncio decide la recarga vigente (D11, D12). */
interface Tras {
  turnoId: number;
  origen: OrigenFoco;
  /** Elemento que abrió el diálogo: recibe el foco si la recarga falla y sigue en el documento. */
  opener: HTMLElement;
  /** Texto del `role="status"`; recibe lo renderizado tras la recarga, o `null` si no la hubo (falló o quedó obsoleta). */
  anuncio: ((despues: VistaRenderizada | null) => string) | null;
  /** Lo renderizado antes de la mutación; se fija en la primera recarga y se reutiliza al reintentar. */
  antes?: VistaRenderizada;
}

export function renderAgenda(ctx: PageContext): Page {
  let disposed = false;
  let vista: Vista = 'dia';
  let fecha = hoyEnZona(Date.now());
  let filtroSillon: number | null = null;
  let mostrarCancelados = false;

  let sillones: Sillon[] = [];
  let prestaciones: Prestacion[] = [];
  let horarios: Horario[] = [];
  let turnos: Turno[] = [];
  let bloqueos: Bloqueo[] = [];
  let configLista = false;
  let cargaSeq = 0;
  let varios = false;
  /** Último turno que recibió el foco desde la última renderización (precarga del alta, D12). */
  let turnoEnfocadoId: number | null = null;
  let dialogoActivo: Dialogo | null = null;

  const grilla = crearGrilla({
    alAbrirAcciones: (id, opener) => abrirAcciones(id, opener),
    alElegirHueco: (hueco) => abrirAltaDesdeHueco(hueco),
    alEnfocarTurno: (id) => {
      turnoEnfocadoId = id;
    },
  });
  const lista = crearLista({
    alAbrirAcciones: (id, opener) => abrirAcciones(id, opener),
    alEnfocarTurno: (id) => {
      turnoEnfocadoId = id;
    },
  });

  const botonDia = h('button', { attrs: { type: 'button', 'aria-pressed': 'true' }, on: { click: () => cambiarVista('dia') } }, 'Día');
  const botonSemana = h('button', { attrs: { type: 'button', 'aria-pressed': 'false' }, on: { click: () => cambiarVista('semana') } }, 'Semana');
  const rangoTexto = h('p', { className: 'rango-visible', attrs: { 'aria-live': 'polite' } });
  const filtro = createSelectField({ id: 'agenda-sillon', name: 'sillon', label: 'Sillón', options: [{ value: '', label: 'Todos' }] });
  filtro.select.addEventListener('change', () => {
    filtroSillon = filtro.value() === '' ? null : Number(filtro.value());
    void cargar();
  });
  const cancelados = h('input', { id: 'agenda-cancelados', attrs: { type: 'checkbox', name: 'cancelados' } });
  cancelados.addEventListener('change', () => {
    mostrarCancelados = cancelados.checked;
    void cargar();
  });
  const avisoProfesionales = h('p', { id: 'agenda-aviso-profesionales', className: 'aviso', attrs: { role: 'status' } });
  const botonNuevo = h('button', { attrs: { type: 'button' }, on: { click: () => abrirAltaDesdeBoton() } }, 'Nuevo turno');
  const anuncio = h('p', { className: 'anuncio', attrs: { role: 'status' } });
  const estadoCarga = h('div', { className: 'estado-carga' });
  const contenido = h('div', { className: 'contenido-agenda' }, grilla.element, lista.element);

  const barra = h(
    'div',
    { className: 'barra-agenda' },
    h('div', { className: 'grupo-botones', attrs: { role: 'group', 'aria-label': 'Vista' } }, botonDia, botonSemana),
    h(
      'div',
      { className: 'grupo-botones', attrs: { role: 'group', 'aria-label': 'Navegación de fechas' } },
      h('button', { attrs: { type: 'button' }, on: { click: () => mover(-1) } }, 'Anterior'),
      h('button', { attrs: { type: 'button' }, on: { click: () => irAHoy() } }, 'Hoy'),
      h('button', { attrs: { type: 'button' }, on: { click: () => mover(1) } }, 'Siguiente'),
    ),
    rangoTexto,
    filtro.element,
    h('div', { className: 'campo campo-casilla' }, cancelados, h('label', { attrs: { for: 'agenda-cancelados' } }, 'Mostrar cancelados')),
    botonNuevo,
  );

  const titulo = h('h1', { attrs: { tabindex: '-1' } }, 'Agenda');
  const element = h('section', { className: 'pagina-agenda' }, titulo, barra, avisoProfesionales, anuncio, estadoCarga, contenido);

  function rangoActual(): RangoUtc | null {
    return vista === 'dia' ? rangoDia(fecha) : rangoSemana(fecha);
  }

  function visibles(): Turno[] {
    return mostrarCancelados ? turnos : turnos.filter((t) => t.estado !== 'CANCELADO');
  }

  function anunciar(mensaje: string): void {
    anuncio.textContent = mensaje;
  }

  /* ------------------------------ renderizado ------------------------------ */

  function actualizarFiltro(): void {
    const referenciados = turnos.map((t) => t.sillonId);
    const ids = sillones.filter((s) => s.activo).map((s) => s.id);
    for (const id of referenciados) if (!ids.includes(id)) ids.push(id);
    filtro.setOptions([{ value: '', label: 'Todos' }, ...ids.map((id) => ({ value: String(id), label: nombreSillon(id, sillones) }))]);
    filtro.setValue(filtroSillon === null ? '' : String(filtroSillon));
  }

  /** Lo que se renderiza con los datos actuales (también para decidir el foco antes de dibujar). */
  function armarVista() {
    const visiblesAhora = visibles();
    const columnas = armarColumnas({ vista, fecha, sillones, turnos: visiblesAhora, bloqueos, filtroSillonId: filtroSillon });
    const dias = vista === 'dia' ? [fecha] : diasDeSemana(fecha);
    return { visiblesAhora, columnas, dias };
  }

  function instantaneaActual(): VistaRenderizada {
    const { visiblesAhora, columnas, dias } = armarVista();
    return instantaneaVista({ columnas, turnos: visiblesAhora, fechas: dias });
  }

  /** `activoId`: destino de `focoTrasCambio`, que recibe el `tabindex="0"` de la grilla. */
  function renderizar(activoId: number | null = null): void {
    const { visiblesAhora, columnas, dias } = armarVista();
    const franja = calcularFranja(
      horarios,
      columnas.flatMap((c) => c.turnos.map((t) => t.segmento)),
      GRILLA_MINUTOS,
    );
    grilla.renderizar(
      {
        etiqueta: vista === 'dia' ? `Agenda del ${ddmm(fecha)}` : `Agenda de la semana del ${ddmm(dias[0] ?? fecha)}`,
        columnas,
        franja,
        minutosGrilla: GRILLA_MINUTOS,
        mostrarSillon: vista === 'semana',
        nombreSillon: (id) => nombreSillon(id, sillones),
      },
      { activoId },
    );
    lista.renderizar({ fechas: dias, turnos: visiblesAhora, nombreSillon: (id) => nombreSillon(id, sillones) });

    rangoTexto.textContent = etiquetaRango(vista, fecha);
    botonDia.setAttribute('aria-pressed', String(vista === 'dia'));
    botonSemana.setAttribute('aria-pressed', String(vista === 'semana'));
    actualizarFiltro();

    varios = hayVariosProfesionales(horarios);
    avisoProfesionales.textContent = varios ? MSG_VARIOS_PROFESIONALES : '';
    if (varios) {
      botonNuevo.setAttribute('aria-disabled', 'true');
      botonNuevo.setAttribute('aria-describedby', avisoProfesionales.id);
    } else {
      botonNuevo.removeAttribute('aria-disabled');
      botonNuevo.removeAttribute('aria-describedby');
    }
    estadoCarga.replaceChildren(...(visiblesAhora.length === 0 ? [h('p', { className: 'vacio', attrs: { role: 'status' } }, MSG_SIN_TURNOS)] : []));
  }

  function aplicarFoco(destino: DestinoFoco, tras: Tras): void {
    if (destino.tipo === 'turno') {
      const enfocado = tras.origen === 'grilla' ? grilla.enfocar(destino.id) : lista.enfocarTurno(destino.id);
      if (!enfocado) grilla.element.focus();
    } else if (destino.tipo === 'grupo') {
      grilla.element.focus();
    } else if (destino.tipo === 'diaLista') {
      if (!lista.enfocarDia(destino.fecha)) titulo.focus();
    } else {
      titulo.focus();
    }
  }

  /* --------------------------------- carga --------------------------------- */

  async function cargar(tras?: Tras): Promise<void> {
    const seq = ++cargaSeq;
    const rango = rangoActual();
    if (rango === null) return;
    const antes = tras === undefined ? null : (tras.antes ?? instantaneaActual());
    // Cualquier recarga borra la referencia al turno enfocado (D12).
    turnoEnfocadoId = null;
    contenido.hidden = false;
    element.setAttribute('aria-busy', 'true');
    estadoCarga.replaceChildren(h('p', { className: 'cargando', attrs: { role: 'status' } }, MSG_CARGANDO));
    try {
      const configurar = configLista
        ? Promise.resolve(null)
        : Promise.all([ctx.agenda.listarSillones(true), ctx.agenda.listarPrestaciones(false), ctx.agenda.listarHorarios()]);
      const [config, listado, bloqueados] = await Promise.all([
        configurar,
        ctx.turnos.listar({
          desde: rango.desde,
          hasta: rango.hasta,
          ...(filtroSillon === null ? {} : { sillonId: filtroSillon }),
          ...(mostrarCancelados ? { incluirCancelados: true } : {}),
        }),
        ctx.agenda.listarBloqueos({ desde: rango.desde, hasta: rango.hasta }),
      ]);
      if (disposed) return;
      if (seq !== cargaSeq) {
        // Recarga obsoleta: no decide el foco, pero el resultado de la mutación igual se anuncia.
        if (tras?.anuncio != null) anunciar(tras.anuncio(null));
        return;
      }
      if (config !== null) {
        [sillones, prestaciones, horarios] = config;
        configLista = true;
      }
      turnos = listado;
      bloqueos = bloqueados;
      element.removeAttribute('aria-busy');
      if (tras === undefined || antes === null) {
        renderizar();
        return;
      }
      const despues = instantaneaActual();
      const destino = focoTrasCambio(antes, despues, tras.turnoId, tras.origen);
      renderizar(destino.tipo === 'turno' && tras.origen === 'grilla' ? destino.id : null);
      aplicarFoco(destino, tras);
      if (tras.anuncio !== null) anunciar(tras.anuncio(despues));
    } catch (error) {
      if (disposed) return;
      if (seq !== cargaSeq) {
        if (tras?.anuncio != null) anunciar(tras.anuncio(null));
        return;
      }
      element.removeAttribute('aria-busy');
      if (tras === undefined || antes === null) {
        contenido.hidden = true;
        estadoCarga.replaceChildren(
          h(
            'div',
            { className: 'error-carga', attrs: { role: 'alert' } },
            h('p', {}, messageForError(error)),
            h('button', { attrs: { type: 'button' }, on: { click: () => void cargar() } }, 'Reintentar'),
          ),
        );
        return;
      }
      // Tras una mutación la grilla anterior sigue visible para no perder el lugar; "Recargar agenda" repite la recarga.
      estadoCarga.replaceChildren(
        h(
          'div',
          { className: 'error-carga', attrs: { role: 'alert' } },
          h('p', {}, messageForError(error)),
          h('button', { attrs: { type: 'button' }, on: { click: () => void cargar({ ...tras, antes }) } }, 'Recargar agenda'),
        ),
      );
      if (tras.opener.isConnected) tras.opener.focus();
      else grilla.element.focus();
      if (tras.anuncio !== null) anunciar(tras.anuncio(null));
    }
  }

  /* ------------------------------- navegación ------------------------------ */

  function cambiarVista(nueva: Vista): void {
    if (nueva === vista) return;
    vista = nueva;
    void cargar();
  }

  function mover(sentido: -1 | 1): void {
    const siguiente = sumarDias(fecha, sentido * (vista === 'dia' ? 1 : 7));
    if (siguiente === null) return;
    fecha = siguiente;
    void cargar();
  }

  function irAHoy(): void {
    fecha = hoyEnZona(Date.now());
    void cargar();
  }

  /* -------------------------------- diálogos ------------------------------- */

  function abrir(opciones: OpcionesDialogo): Dialogo | null {
    if (dialogoActivo?.abierto() === true) return null;
    const alCerrar = opciones.alCerrar;
    const dialogo = abrirDialogo({
      ...opciones,
      alCerrar: () => {
        dialogoActivo = null;
        alCerrar?.();
      },
    });
    dialogoActivo = dialogo;
    return dialogo;
  }

  function anuncioDe(cambio: CambioExitoso): (despues: VistaRenderizada | null) => string {
    return (despues) =>
      anuncioCambio(
        cambio.tipo === 'estado'
          ? { tipo: 'estado', estado: cambio.estado }
          : {
              tipo: 'reprogramado',
              inicio: cambio.turno.inicio,
              sillonNombre: cambio.sillonCambio ? nombreSillon(cambio.turno.sillonId, sillones) : null,
              fueraDeVista: despues !== null && !sigueVisible(despues, cambio.turno.id),
            },
      );
  }

  function abrirAcciones(turnoId: number, opener: HTMLElement): void {
    const turno = turnos.find((t) => t.id === turnoId);
    if (turno === undefined) return;
    const origen: OrigenFoco = opener.closest('.grilla') === null ? 'lista' : 'grilla';
    abrirAccionesTurno({
      turno,
      nombreSillon: (id) => nombreSillon(id, sillones),
      sillones: sillones.filter((s) => s.activo),
      api: {
        cambiarEstado: (id, cuerpo) => ctx.turnos.cambiarEstado(id, cuerpo),
        reprogramar: (id, cuerpo) => ctx.turnos.reprogramar(id, cuerpo),
      },
      ahora: () => Date.now(),
      puedeOfrecerSobreturno: puedeOfrecerSobreturno(rolActual(ctx)),
      opener,
      abrir,
      alExito: (cambio) => {
        if (disposed) return;
        void cargar({ turnoId, origen, opener, anuncio: anuncioDe(cambio) });
      },
      alRecargar: () => {
        if (disposed) return;
        void cargar({ turnoId, origen, opener, anuncio: null });
      },
    });
  }

  function abrirAlta(precarga: Precarga, conAviso: boolean): void {
    if (varios) return;
    const rango = rangoActual();
    if (rango === null) return;
    abrirAltaTurno({
      crear: (cuerpo) => ctx.turnos.crear(cuerpo),
      buscarPacientes: (filtroPacientes) => ctx.pacientes.buscar(filtroPacientes),
      sillones: sillones.filter((s) => s.activo),
      prestaciones,
      precarga,
      conAviso,
      datosAviso: () => ({
        turnos,
        horarios,
        bloqueos,
        minutosGrilla: GRILLA_MINUTOS,
        cobertura: { desde: rango.desde, hasta: rango.hasta, sillonId: filtroSillon },
      }),
      puedeOfrecerSobreturno: puedeOfrecerSobreturno(rolActual(ctx)),
      opener: botonNuevo,
      abrir,
      alCrear: () => {
        if (disposed) return;
        anunciar(MSG_TURNO_CREADO);
        void cargar();
      },
      alRecargar: () => {
        if (disposed) return;
        void cargar();
      },
    });
  }

  /** "Nuevo turno": precarga desde el turno enfocado en la vista actual (D12); nunca envía nada. */
  function abrirAltaDesdeBoton(): void {
    if (varios) return;
    const contexto = { vista, fechaVisible: fecha, sillonFiltrado: filtroSillon, turnoEnfocadoId, turnosRenderizados: visibles() };
    abrirAlta(precargaNuevoTurno(contexto), turnoEnfocadoVigente(contexto) !== null);
  }

  /** Clic en un hueco: conveniencia de puntero, sin aviso (la fecha, la hora y el sillón son los de la celda). */
  function abrirAltaDesdeHueco(hueco: Hueco): void {
    abrirAlta({ fecha: hueco.fecha, hora: hueco.hora, sillonId: hueco.sillonId ?? filtroSillon }, false);
  }

  void cargar();

  return {
    title: 'Agenda',
    element,
    dispose: () => {
      disposed = true;
      dialogoActivo?.cerrar({ devolverFoco: false });
    },
  };
}
