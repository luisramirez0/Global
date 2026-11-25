/**
 * Página `#/recordatorios` (design D7 y D8 de C-14): turnos pendientes de recordatorio de una fecha, con las acciones
 * de WhatsApp y email por turno y la respuesta del paciente (confirmar o cancelar). Todo dato de la API se inserta
 * como texto (regla 3). Nada se pide ni se envía sin un clic explícito, salvo la lista de pendientes.
 */
import { ApiError } from '../../api/errors';
import type { EstadoTurno, TurnoPendiente } from '../../api/types';
import { crearAccionesRecordatorio } from '../../components/agenda/accionesRecordatorio';
import { abrirDialogo, type Dialogo } from '../../components/agenda/dialogo';
import { applyFieldErrors, createField, createTextAreaField, setBusy } from '../../components/form';
import type { Page } from '../../router/router';
import { h } from '../../utils/dom';
import { ZONA_CONSULTORIO, hoyEnZona, siguienteDia } from '../../utils/zonaHoraria';
import { horaLocal, nombrePaciente } from '../agenda/dominio/formato';
import { clasificarRechazo, requiereRecargaManual } from '../agenda/dominio/rechazos';
import { ETIQUETA_ESTADO } from '../agenda/dominio/transiciones';
import { MSG_FECHA_INVALIDA, validarMotivoCancelacion } from '../agenda/dominio/validacion';
import { MSG_TURNO_CANCELADO, MSG_TURNO_CONFIRMADO, mensajeRechazo } from '../agenda/mensajes';
import { MSG_CONNECTION, MSG_GENERIC, serverFieldErrors } from '../auth/messages';
import { MSG_RECORDADO_EMAIL } from './mensajes';
import { MSG_SIN_PERMISO } from '../config/mensajes';
import type { PageContext } from '../context';

export const MSG_SIN_PENDIENTES = 'No hay turnos pendientes de recordatorio para esta fecha.';
export const MSG_ULTIMO_EMAIL_FALLO = 'El último envío por email falló.';
export const MSG_RECORDADO_WHATSAPP = 'Recordatorio por WhatsApp generado.';

let secuenciaItems = 0;

function mensajeDeCarga(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'forbidden') return MSG_SIN_PERMISO;
    if (error.kind === 'network' || error.kind === 'timeout') return MSG_CONNECTION;
  }
  return MSG_GENERIC;
}

function porInicio(a: TurnoPendiente, b: TurnoPendiente): number {
  return Date.parse(a.inicio) - Date.parse(b.inicio) || a.turnoId - b.turnoId;
}

export function renderRecordatorios(ctx: PageContext): Page {
  let disposed = false;
  let secuencia = 0;
  const dialogosAbiertos = new Set<Dialogo>();

  const titulo = h('h1', { attrs: { tabindex: '-1' } }, 'Recordatorios');
  const fechaInicial = siguienteDia(hoyEnZona(Date.now(), ZONA_CONSULTORIO)) ?? '';
  const campoFecha = createField({ id: 'recordatorios-fecha', name: 'fecha', label: 'Fecha', type: 'date', autocomplete: 'off' });
  campoFecha.setValue(fechaInicial);
  const anuncio = h('p', { className: 'anuncio-pagina', attrs: { role: 'status' } });

  /** Valida la fecha del selector (calendario real) y recién entonces pide la lista. */
  function pedirDelSelector(): void {
    const fecha = campoFecha.value();
    if (siguienteDia(fecha) === null) {
      campoFecha.setError(MSG_FECHA_INVALIDA);
      return;
    }
    campoFecha.setError(null);
    void cargar(fecha);
  }
  campoFecha.input.addEventListener('change', pedirDelSelector);

  const estadoCarga = h('div', { className: 'estado-carga' });
  const lista = h('div', { className: 'lista-recordatorios' });

  function crearItem(p: TurnoPendiente): HTMLLIElement {
    secuenciaItems += 1;
    const hora = horaLocal(p.inicio);
    const paciente = nombrePaciente(p.paciente);
    const etiqueta = `${hora} ${paciente}`;
    let estado: EstadoTurno = p.estado;
    let ocupado = false;

    const textoEstado = h('span', { className: 'estado-turno' }, ETIQUETA_ESTADO[estado]);
    const datos = h(
      'p',
      { className: 'recordatorio-datos', attrs: { tabindex: '-1' } },
      h('strong', {}, hora),
      ' ',
      h('span', {}, paciente),
      ' · Profesional: ',
      h('span', {}, nombrePaciente(p.profesional)),
      ' · ',
      textoEstado,
    );
    const recordado = h('p', { className: 'estado-recordatorio' });
    const alerta = h('div', { className: 'alerta alerta-item', attrs: { role: 'alert' } });
    const botonesRespuesta = h('div', { className: 'respuesta-paciente' });
    const acciones = crearAccionesRecordatorio({
      turnoId: p.turnoId,
      etiqueta,
      tieneTelefono: p.tieneTelefono,
      tieneEmail: p.tieneEmail,
      api: ctx.recordatorios,
      sinConfirmar: ctx.enviosSinConfirmar,
      alResultado: (resultado) => {
        // La lista no se recarga sola: el ítem queda visible hasta "Actualizar" (D7).
        if (resultado === 'whatsappGenerado') recordado.textContent = MSG_RECORDADO_WHATSAPP;
        else if (resultado === 'emailEnviado') recordado.textContent = MSG_RECORDADO_EMAIL;
      },
      alActualizar: () => pedirDelSelector(),
    });

    const botonesDeEstado: HTMLButtonElement[] = [];
    function botonRespuesta(texto: string, alClick: (opener: HTMLButtonElement) => void): HTMLButtonElement {
      const b = h('button', { attrs: { type: 'button', 'aria-label': `${texto}, ${etiqueta}` } }, texto);
      b.addEventListener('click', () => {
        if (!ocupado) alClick(b);
      });
      botonesDeEstado.push(b);
      return b;
    }

    function dibujarRespuesta(): void {
      botonesDeEstado.length = 0;
      const botones: HTMLButtonElement[] = [];
      if (estado === 'PROGRAMADO') botones.push(botonRespuesta('Confirmar', (opener) => void confirmar(opener)));
      if (estado === 'PROGRAMADO' || estado === 'CONFIRMADO') botones.push(botonRespuesta('Cancelar', (opener) => abrirCancelacion(opener)));
      botonesRespuesta.replaceChildren(...botones);
    }

    function fijarOcupado(valor: boolean): void {
      ocupado = valor;
      for (const b of botonesDeEstado) b.disabled = valor;
    }

    function aplicarNuevoEstado(nuevo: EstadoTurno, mensaje: string): void {
      estado = nuevo;
      textoEstado.textContent = ETIQUETA_ESTADO[nuevo];
      alerta.replaceChildren();
      dibujarRespuesta();
      if (nuevo === 'CANCELADO') acciones.remove();
      anuncio.textContent = mensaje;
      datos.focus();
    }

    /** Mensaje fijo del rechazo y, si no se identifica la causa, "Actualizar" manual (nunca recarga sola). */
    function contenidoRechazo(error: unknown, alActualizar: () => void): HTMLElement[] {
      const rechazo = clasificarRechazo(error, { accion: 'estado' });
      const partes: HTMLElement[] = [h('p', {}, mensajeRechazo(rechazo))];
      if (requiereRecargaManual(rechazo)) {
        partes.push(h('button', { attrs: { type: 'button' }, on: { click: () => alActualizar() } }, 'Actualizar'));
      }
      return partes;
    }

    async function confirmar(opener: HTMLButtonElement): Promise<void> {
      const tenia = document.activeElement === opener;
      fijarOcupado(true);
      alerta.replaceChildren();
      try {
        await ctx.turnos.cambiarEstado(p.turnoId, { estado: 'CONFIRMADO' });
        if (disposed) return;
        fijarOcupado(false);
        aplicarNuevoEstado('CONFIRMADO', MSG_TURNO_CONFIRMADO);
      } catch (error) {
        if (disposed) return;
        fijarOcupado(false);
        alerta.replaceChildren(...contenidoRechazo(error, () => pedirDelSelector()));
        // Un botón deshabilitado pierde el foco: vuelve al botón re-habilitado (B2 de la revisión).
        if (tenia) opener.focus();
      }
    }

    function abrirCancelacion(opener: HTMLButtonElement): void {
      const motivo = createTextAreaField({ id: `recordatorio-motivo-${secuenciaItems}`, name: 'motivoCancelacion', label: 'Motivo de la cancelación' });
      const zona = h('div', { className: 'alerta alerta-accion', attrs: { role: 'alert' } });
      const enviar = h('button', { attrs: { type: 'submit' } }, 'Confirmar cancelación');
      let dialogo: Dialogo | null = null;
      const formulario = h(
        'form',
        {
          attrs: { novalidate: true },
          on: {
            submit: (event) => {
              event.preventDefault();
              void cancelar();
            },
          },
        },
        motivo.element,
        zona,
        h('div', { className: 'acciones-form' }, enviar),
      );

      async function cancelar(): Promise<void> {
        if (ocupado) return;
        zona.replaceChildren();
        motivo.setError(null);
        const resultado = validarMotivoCancelacion(motivo.value());
        if (!resultado.ok) {
          motivo.setError(resultado.error);
          motivo.focus();
          return;
        }
        const teniaEnviar = document.activeElement === enviar;
        fijarOcupado(true);
        setBusy(formulario, enviar, true);
        try {
          await ctx.turnos.cambiarEstado(p.turnoId, { estado: 'CANCELADO', motivoCancelacion: resultado.value });
          if (disposed) return;
          fijarOcupado(false);
          dialogo?.cerrar({ devolverFoco: false });
          aplicarNuevoEstado('CANCELADO', MSG_TURNO_CANCELADO);
        } catch (error) {
          if (disposed) return;
          fijarOcupado(false);
          setBusy(formulario, enviar, false);
          zona.replaceChildren(
            ...contenidoRechazo(error, () => {
              dialogo?.cerrar({ devolverFoco: false });
              pedirDelSelector();
            }),
          );
          if (clasificarRechazo(error, { accion: 'estado' }).tipo === 'campos') applyFieldErrors([motivo], serverFieldErrors(error));
          else zona.querySelector('button')?.focus();
          if (teniaEnviar && dialogo?.element.contains(document.activeElement) !== true) enviar.focus();
        }
      }

      dialogo = abrirDialogo({
        titulo: 'Cancelar turno',
        contenido: [formulario],
        opener,
        foco: () => motivo.textarea,
        alCerrar: () => {
          if (dialogo !== null) dialogosAbiertos.delete(dialogo);
        },
      });
      dialogosAbiertos.add(dialogo);
    }

    dibujarRespuesta();
    const item = h('li', { className: 'recordatorio-item' }, datos);
    if (p.ultimoRecordatorio?.estado === 'ERROR' && p.ultimoRecordatorio.canal === 'EMAIL') {
      item.append(h('p', { className: 'aviso' }, MSG_ULTIMO_EMAIL_FALLO));
    }
    item.append(recordado, acciones, botonesRespuesta, alerta);
    item.dataset['turnoId'] = String(p.turnoId);
    return item;
  }

  function mostrar(pendientes: readonly TurnoPendiente[]): void {
    if (pendientes.length === 0) {
      lista.replaceChildren(h('p', { className: 'vacio' }, MSG_SIN_PENDIENTES));
      return;
    }
    lista.replaceChildren(h('ul', { className: 'recordatorios' }, ...[...pendientes].sort(porInicio).map(crearItem)));
  }

  async function cargar(fecha: string): Promise<void> {
    const propia = ++secuencia;
    estadoCarga.replaceChildren(h('p', { className: 'cargando', attrs: { role: 'status' } }, 'Cargando…'));
    try {
      const pendientes = await ctx.recordatorios.pendientes(fecha);
      if (disposed || propia !== secuencia) return;
      estadoCarga.replaceChildren();
      mostrar(pendientes);
    } catch (error) {
      if (disposed || propia !== secuencia) return;
      lista.replaceChildren();
      estadoCarga.replaceChildren(
        h(
          'div',
          { className: 'error-carga', attrs: { role: 'alert' } },
          h('p', {}, mensajeDeCarga(error)),
          h('button', { attrs: { type: 'button' }, on: { click: () => void cargar(fecha) } }, 'Reintentar'),
        ),
      );
    }
  }

  const element = h(
    'section',
    { className: 'pagina-recordatorios' },
    titulo,
    h(
      'div',
      { className: 'filtro-fecha' },
      campoFecha.element,
      h('button', { attrs: { type: 'button' }, on: { click: () => pedirDelSelector() } }, 'Actualizar'),
    ),
    anuncio,
    estadoCarga,
    lista,
  );

  void cargar(fechaInicial);

  return {
    title: 'Recordatorios',
    element,
    dispose() {
      disposed = true;
      for (const d of [...dialogosAbiertos]) d.cerrar({ devolverFoco: false });
    },
  };
}
