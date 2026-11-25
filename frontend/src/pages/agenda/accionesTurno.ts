/**
 * Diálogo de acciones de un turno (design D3, D7, D9, D11 y D12 de C-13): detalle y acciones de estado válidas
 * para su estado ("Confirmar", "Cancelar", "Reprogramar", "Asistió", "Ausente"), cancelación con motivo
 * obligatorio medido en bytes UTF-8 y paso de reprogramación, todo en un solo diálogo. "Asistió" y "Ausente" quedan
 * con `aria-disabled` (enfocables, con el motivo por `aria-describedby`) hasta que el turno empieza. Los errores no
 * identificables dejan el diálogo abierto con "Recargar agenda" manual: nada se recarga solo.
 */
import type { TurnosApi } from '../../api/turnos';
import type { EstadoTurno, Sillon, Turno } from '../../api/types';
import type { Dialogo, OpcionesDialogo } from '../../components/agenda/dialogo';
import { applyFieldErrors, createTextAreaField, setBusy } from '../../components/form';
import { h } from '../../utils/dom';
import { serverFieldErrors } from '../auth/messages';
import { contenidoDetalle } from './detalleTurno';
import { nombrePaciente } from './dominio/formato';
import { clasificarRechazo } from './dominio/rechazos';
import { esReprogramable, puedeMarcarAsistencia, transicionesPermitidas } from './dominio/transiciones';
import { validarMotivoCancelacion } from './dominio/validacion';
import { crearPasoReprogramar, type PasoReprogramar } from './reprogramar';
import { crearZonaRechazo } from './zonaRechazo';

export type CambioExitoso =
  | { tipo: 'estado'; estado: EstadoTurno }
  | { tipo: 'reprogramado'; turno: Turno; sillonCambio: boolean };

export interface OpcionesAcciones {
  turno: Turno;
  nombreSillon(id: number): string;
  /** Sillones activos elegibles al reprogramar. */
  sillones: readonly Sillon[];
  api: Pick<TurnosApi, 'cambiarEstado' | 'reprogramar'>;
  ahora(): number;
  puedeOfrecerSobreturno: boolean;
  opener: HTMLElement;
  abrir(opciones: OpcionesDialogo): Dialogo | null;
  /** Mutación exitosa; el diálogo ya está cerrado y el foco lo decide la página. */
  alExito(cambio: CambioExitoso): void;
  /** "Recargar agenda" manual; el diálogo ya está cerrado. */
  alRecargar(): void;
}

const ETIQUETA_ACCION: Readonly<Partial<Record<EstadoTurno, string>>> = {
  CONFIRMADO: 'Confirmar',
  CANCELADO: 'Cancelar',
  ASISTIO: 'Asistió',
  AUSENTE: 'Ausente',
};
const MSG_ASISTENCIA_FUTURA = 'Disponible cuando empiece el turno.';
let secuencia = 0;

export function abrirAccionesTurno(opciones: OpcionesAcciones): Dialogo | null {
  const { turno } = opciones;
  secuencia += 1;
  let cerrado = false;
  let ocupado = false;
  let dialogo: Dialogo | null = null;
  let pasoReprogramar: PasoReprogramar | null = null;

  const zona = crearZonaRechazo({ puedeOfrecerSobreturno: false, alPedirSobreturno: () => undefined, alRecargar: () => recargar() });

  function recargar(): void {
    if (!cerrado) dialogo?.cerrar({ devolverFoco: false });
    opciones.alRecargar();
  }

  /* --------------------------------- acciones --------------------------------- */

  const idAviso = `acciones-aviso-asistencia-${secuencia}`;
  const asistenciaHabilitada = puedeMarcarAsistencia(turno, opciones.ahora());
  const botonesAccion: HTMLButtonElement[] = [];

  function boton(texto: string, alClick: () => void, asistencia = false): HTMLButtonElement {
    const el = h('button', { attrs: { type: 'button' } }, texto);
    if (asistencia && !asistenciaHabilitada) {
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('aria-describedby', idAviso);
    }
    el.addEventListener('click', () => {
      if (el.getAttribute('aria-disabled') === 'true' || ocupado) return;
      alClick();
    });
    botonesAccion.push(el);
    return el;
  }

  async function mutar(llamada: () => Promise<Turno>, cambio: () => CambioExitoso, alFallar: (error: unknown) => void): Promise<void> {
    if (ocupado) return;
    ocupado = true;
    for (const b of botonesAccion) b.disabled = true;
    zona.limpiar();
    try {
      await llamada();
      if (!cerrado) dialogo?.cerrar({ devolverFoco: false });
      opciones.alExito(cambio());
    } catch (error) {
      if (cerrado) return;
      alFallar(error);
    } finally {
      ocupado = false;
      if (!cerrado) for (const b of botonesAccion) b.disabled = false;
    }
  }

  function cambiarEstado(estado: EstadoTurno): void {
    void mutar(
      () => opciones.api.cambiarEstado(turno.id, { estado }),
      () => ({ tipo: 'estado', estado }),
      (error) => zona.mostrar(clasificarRechazo(error, { accion: 'estado' }), false),
    );
  }

  const destinos = transicionesPermitidas(turno.estado);
  const acciones: HTMLButtonElement[] = [];
  if (destinos.includes('CONFIRMADO')) acciones.push(boton('Confirmar', () => cambiarEstado('CONFIRMADO')));
  if (destinos.includes('CANCELADO')) acciones.push(boton(ETIQUETA_ACCION.CANCELADO ?? 'Cancelar', () => mostrarCancelacion()));
  if (esReprogramable(turno.estado)) acciones.push(boton('Reprogramar', () => mostrarReprogramar()));
  if (destinos.includes('ASISTIO')) acciones.push(boton('Asistió', () => cambiarEstado('ASISTIO'), true));
  if (destinos.includes('AUSENTE')) acciones.push(boton('Ausente', () => cambiarEstado('AUSENTE'), true));
  const hayAsistencia = destinos.includes('ASISTIO') || destinos.includes('AUSENTE');

  const contenidoAcciones: Node[] = [
    contenidoDetalle(turno, opciones.nombreSillon(turno.sillonId)),
    ...(acciones.length > 0 ? [h('div', { className: 'acciones-turno' }, ...acciones)] : []),
    ...(hayAsistencia && !asistenciaHabilitada ? [h('p', { id: idAviso, className: 'aviso-asistencia' }, MSG_ASISTENCIA_FUTURA)] : []),
    zona.alerta,
    zona.acciones,
  ];
  const tituloAcciones = `Turno de ${nombrePaciente(turno.paciente)}`;

  function mostrarAcciones(): void {
    dialogo?.reemplazar(tituloAcciones, contenidoAcciones, () => acciones[0] ?? null);
  }

  /* -------------------------------- cancelación -------------------------------- */

  const motivo = createTextAreaField({ id: `cancelar-motivo-${secuencia}`, name: 'motivoCancelacion', label: 'Motivo de la cancelación' });
  const zonaCancelacion = crearZonaRechazo({ puedeOfrecerSobreturno: false, alPedirSobreturno: () => undefined, alRecargar: () => recargar() });
  const confirmarCancelacion = h('button', { attrs: { type: 'submit' } }, 'Confirmar cancelación');
  const formularioCancelacion = h(
    'form',
    {
      attrs: { novalidate: true },
      on: {
        submit: (event) => {
          event.preventDefault();
          enviarCancelacion();
        },
      },
    },
    motivo.element,
    zonaCancelacion.alerta,
    zonaCancelacion.acciones,
    h('div', { className: 'acciones-form' }, confirmarCancelacion, h('button', { attrs: { type: 'button' }, on: { click: () => mostrarAcciones() } }, 'Volver')),
  );

  function mostrarCancelacion(): void {
    dialogo?.reemplazar('Cancelar turno', [formularioCancelacion], () => motivo.textarea);
  }

  function enviarCancelacion(): void {
    if (ocupado) return;
    zonaCancelacion.limpiar();
    motivo.setError(null);
    const resultado = validarMotivoCancelacion(motivo.value());
    if (!resultado.ok) {
      motivo.setError(resultado.error);
      motivo.focus();
      return;
    }
    setBusy(formularioCancelacion, confirmarCancelacion, true);
    void mutar(
      () => opciones.api.cambiarEstado(turno.id, { estado: 'CANCELADO', motivoCancelacion: resultado.value }),
      () => ({ tipo: 'estado', estado: 'CANCELADO' }),
      (error) => {
        const rechazo = clasificarRechazo(error, { accion: 'estado' });
        zonaCancelacion.mostrar(rechazo, false);
        if (rechazo.tipo === 'campos') applyFieldErrors([motivo], serverFieldErrors(error));
      },
    ).finally(() => {
      if (!cerrado) setBusy(formularioCancelacion, confirmarCancelacion, false);
    });
  }

  /* ------------------------------- reprogramación ------------------------------ */

  function mostrarReprogramar(): void {
    pasoReprogramar ??= crearPasoReprogramar({
      turno,
      sillones: opciones.sillones,
      nombreSillon: opciones.nombreSillon,
      reprogramar: (id, cuerpo) => opciones.api.reprogramar(id, cuerpo),
      puedeOfrecerSobreturno: opciones.puedeOfrecerSobreturno,
      dialogo: () => dialogo as Dialogo,
      cerrado: () => cerrado,
      alVolver: () => mostrarAcciones(),
      alExito: (respuesta, sillonCambio) => opciones.alExito({ tipo: 'reprogramado', turno: respuesta, sillonCambio }),
      alRecargar: () => recargar(),
    });
    dialogo?.reemplazar(pasoReprogramar.titulo, pasoReprogramar.contenido, () => pasoReprogramar?.foco() ?? null);
  }

  /* --------------------------------- apertura --------------------------------- */

  dialogo = opciones.abrir({
    titulo: tituloAcciones,
    contenido: contenidoAcciones,
    opener: opciones.opener,
    alCerrar: () => {
      cerrado = true;
    },
  });
  return dialogo;
}
