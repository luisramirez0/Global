/**
 * Zona de rechazo de un diálogo de turno (design D2, D3 y D11 de C-13): mensaje fijo en `role="alert"`, ofrecimiento
 * de sobreturno (solo a quien corresponde, DP-2), aviso de rol y "Recargar agenda" manual. Nunca muestra `title` ni
 * `detail` del servidor.
 */
import { h } from '../../utils/dom';
import { admiteSobreturno, requiereRecargaManual, type Rechazo } from './dominio/rechazos';
import { MSG_SOBRETURNO_ROL, mensajeRechazo } from './mensajes';

export interface OpcionesZonaRechazo {
  puedeOfrecerSobreturno: boolean;
  alPedirSobreturno(): void;
  alRecargar(): void;
}

export interface ZonaRechazo {
  readonly alerta: HTMLElement;
  /** Botones asociados al rechazo (sobreturno, recargar). */
  readonly acciones: HTMLElement;
  /** `fueSobreturno`: el rechazo es de un reintento ya confirmado como sobreturno, que no se vuelve a ofrecer. */
  mostrar(rechazo: Rechazo, fueSobreturno: boolean): void;
  limpiar(): void;
  /** El último rechazo mostrado es de horario (conflicto, fuera de agenda o bloqueo). */
  esDeHorario(): boolean;
}

export function crearZonaRechazo(opciones: OpcionesZonaRechazo): ZonaRechazo {
  const alerta = h('div', { className: 'alerta alerta-accion', attrs: { role: 'alert' } });
  const acciones = h('div', { className: 'acciones-rechazo' });
  let deHorario = false;

  return {
    alerta,
    acciones,
    mostrar(rechazo, fueSobreturno) {
      const mensajes = [h('p', {}, mensajeRechazo(rechazo))];
      const botones: HTMLElement[] = [];
      if (admiteSobreturno(rechazo) && !fueSobreturno) {
        if (opciones.puedeOfrecerSobreturno) {
          botones.push(h('button', { attrs: { type: 'button' }, on: { click: () => opciones.alPedirSobreturno() } }, 'Agendar como sobreturno'));
        } else {
          mensajes.push(h('p', {}, MSG_SOBRETURNO_ROL));
        }
      }
      if (requiereRecargaManual(rechazo)) {
        botones.push(h('button', { attrs: { type: 'button' }, on: { click: () => opciones.alRecargar() } }, 'Recargar agenda'));
      }
      alerta.replaceChildren(...mensajes);
      acciones.replaceChildren(...botones);
      deHorario = rechazo.tipo === 'sillon' || rechazo.tipo === 'profesional' || rechazo.tipo === 'fueraDeAgenda' || rechazo.tipo === 'bloqueo';
    },
    limpiar() {
      alerta.replaceChildren();
      acciones.replaceChildren();
      deHorario = false;
    },
    esDeHorario: () => deHorario,
  };
}
