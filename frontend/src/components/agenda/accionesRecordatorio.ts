/**
 * Acciones de recordatorio de un turno, compartidas por la página `#/recordatorios` y el diálogo de la agenda
 * (design D3, D5 y D10 de C-14). El enlace de WhatsApp solo se pide ante un clic explícito (el GET no es idempotente);
 * el enlace (contiene el teléfono) vive únicamente en el `href` del `<a>`: no se loguea ni se guarda.
 */
import type { RecordatoriosApi } from '../../api/recordatorios';
import type { CanalRecordatorio } from '../../api/types';
import type { RegistroEnviosSinConfirmar } from '../../pages/recordatorios/dominio/enviosSinConfirmar';
import { clasificarErrorRecordatorio, type RechazoRecordatorio } from '../../pages/recordatorios/dominio/rechazos';
import {
  MSG_AYUDA_ENLACE,
  MSG_EMAIL_ENVIADO,
  MSG_EMAIL_EN_CURSO,
  MSG_ENLACE_LISTO,
  MSG_ENVIO_SIN_CONFIRMAR,
  MSG_RECORDADO_EMAIL,
  MSG_SIN_EMAIL,
  MSG_SIN_TELEFONO,
  mensajeRecordatorio,
} from '../../pages/recordatorios/mensajes';
import { h } from '../../utils/dom';

export type ResultadoRecordatorio = 'whatsappGenerado' | 'emailEnviado' | 'emailSinConfirmar';

export interface OpcionesAccionesRecordatorio {
  turnoId: number;
  /** Texto que identifica el turno en el nombre accesible de los botones (p. ej. `10:00 Pérez, Ana`). */
  etiqueta: string;
  /** `null` = desconocido (diálogo de la agenda): el botón nace habilitado y el `422` lo resuelve. */
  tieneTelefono: boolean | null;
  tieneEmail: boolean | null;
  api: Pick<RecordatoriosApi, 'enlaceWhatsApp' | 'enviarEmail'>;
  sinConfirmar: RegistroEnviosSinConfirmar;
  alResultado(resultado: ResultadoRecordatorio): void;
  /** "Actualizar" tras un `409`/`404`; sin callback no se ofrece. */
  alActualizar?: () => void;
}

let secuencia = 0;

export function crearAccionesRecordatorio(opciones: OpcionesAccionesRecordatorio): HTMLElement {
  secuencia += 1;
  const sufijo = String(secuencia);
  const { turnoId, etiqueta, api } = opciones;

  const idAvisoTel = `recordatorio-aviso-telefono-${sufijo}`;
  const idAvisoEmail = `recordatorio-aviso-email-${sufijo}`;
  let sinTelefono = opciones.tieneTelefono === false;
  let sinEmail = opciones.tieneEmail === false;
  let ocupadoWa = false;
  let ocupadoEmail = false;

  const botonWa = h('button', { attrs: { type: 'button', 'aria-label': `WhatsApp, ${etiqueta}` } }, 'WhatsApp');
  const botonEmail = h('button', { attrs: { type: 'button', 'aria-label': `Email, ${etiqueta}` } }, 'Email');
  const avisoTel = h('p', { id: idAvisoTel, className: 'aviso-recordatorio', attrs: { tabindex: '-1', hidden: true } }, MSG_SIN_TELEFONO);
  const avisoEmail = h('p', { id: idAvisoEmail, className: 'aviso-recordatorio', attrs: { tabindex: '-1', hidden: true } }, MSG_SIN_EMAIL);
  const zonaEnlace = h('div', { className: 'zona-enlace' });
  const anuncio = h('p', { className: 'anuncio-recordatorio', attrs: { role: 'status' } });
  const alerta = h('div', { className: 'alerta alerta-recordatorio', attrs: { role: 'alert' } });

  function mostrarAlerta(rechazo: RechazoRecordatorio): void {
    const partes: HTMLElement[] = [h('p', {}, mensajeRecordatorio(rechazo))];
    const alActualizar = opciones.alActualizar;
    if ((rechazo === 'noRecordable' || rechazo === 'noExiste') && alActualizar !== undefined) {
      partes.push(h('button', { attrs: { type: 'button' }, on: { click: () => alActualizar() } }, 'Actualizar'));
    }
    alerta.replaceChildren(...partes);
  }

  function aplicarBloqueoTelefono(): void {
    botonWa.disabled = sinTelefono || ocupadoWa;
    avisoTel.hidden = !sinTelefono;
    if (sinTelefono) botonWa.setAttribute('aria-describedby', idAvisoTel);
    else botonWa.removeAttribute('aria-describedby');
  }

  /** Motivo por el que "Email" está bloqueado, o `null` si se puede enviar. */
  function textoBloqueoEmail(): string | null {
    if (sinEmail) return MSG_SIN_EMAIL;
    if (opciones.sinConfirmar.enviado(turnoId)) return MSG_RECORDADO_EMAIL;
    if (opciones.sinConfirmar.tiene(turnoId)) return MSG_ENVIO_SIN_CONFIRMAR;
    if (opciones.sinConfirmar.enCurso(turnoId)) return MSG_EMAIL_EN_CURSO;
    return null;
  }

  function aplicarBloqueoEmail(): void {
    const motivo = textoBloqueoEmail();
    botonEmail.disabled = motivo !== null || ocupadoEmail;
    avisoEmail.hidden = motivo === null;
    if (motivo === MSG_EMAIL_EN_CURSO) botonEmail.setAttribute('aria-busy', 'true');
    else if (!ocupadoEmail) botonEmail.removeAttribute('aria-busy');
    if (motivo === null) {
      botonEmail.removeAttribute('aria-describedby');
    } else {
      avisoEmail.textContent = motivo;
      botonEmail.setAttribute('aria-describedby', idAvisoEmail);
    }
  }

  function ocupar(boton: HTMLButtonElement, ocupado: boolean): boolean {
    const tenia = document.activeElement === boton;
    boton.disabled = ocupado;
    if (ocupado) boton.setAttribute('aria-busy', 'true');
    else boton.removeAttribute('aria-busy');
    return tenia;
  }

  async function pedirEnlace(): Promise<void> {
    if (ocupadoWa || sinTelefono) return;
    ocupadoWa = true;
    const tenia = ocupar(botonWa, true);
    alerta.replaceChildren();
    anuncio.textContent = '';
    try {
      const respuesta = await api.enlaceWhatsApp(turnoId);
      ocupadoWa = false;
      ocupar(botonWa, false);
      const enlace = h('a', { attrs: { href: respuesta.enlace } }, 'Abrir WhatsApp');
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      zonaEnlace.replaceChildren(enlace);
      anuncio.textContent = MSG_ENLACE_LISTO;
      enlace.focus();
      opciones.alResultado('whatsappGenerado');
    } catch (error) {
      ocupadoWa = false;
      const rechazo = clasificarErrorRecordatorio(error, 'WHATSAPP_LINK' satisfies CanalRecordatorio);
      if (rechazo === 'sinTelefono') {
        sinTelefono = true;
        botonWa.removeAttribute('aria-busy');
        aplicarBloqueoTelefono();
        // Un botón recién deshabilitado pierde el foco: pasa al aviso que explica el motivo.
        if (tenia) avisoTel.focus();
        return;
      }
      ocupar(botonWa, false);
      mostrarAlerta(rechazo);
      if (tenia) botonWa.focus();
    }
  }

  async function enviarEmail(): Promise<void> {
    if (ocupadoEmail || textoBloqueoEmail() !== null) return;
    ocupadoEmail = true;
    opciones.sinConfirmar.iniciarEnvio(turnoId);
    const tenia = ocupar(botonEmail, true);
    alerta.replaceChildren();
    anuncio.textContent = '';
    let exito = false;
    let error: unknown = null;
    try {
      await api.enviarEmail(turnoId);
      exito = true;
    } catch (e) {
      error = e;
    } finally {
      // Siempre se libera el "en curso" compartido, pase lo que pase con el pedido (M1).
      opciones.sinConfirmar.terminarEnvio(turnoId);
      ocupadoEmail = false;
    }
    if (exito) {
      ocupar(botonEmail, false);
      opciones.sinConfirmar.marcarEnviado(turnoId);
      aplicarBloqueoEmail();
      anuncio.textContent = MSG_EMAIL_ENVIADO;
      // Un botón recién deshabilitado pierde el foco: pasa al aviso.
      if (tenia) avisoEmail.focus();
      opciones.alResultado('emailEnviado');
    } else {
      const rechazo = clasificarErrorRecordatorio(error, 'EMAIL' satisfies CanalRecordatorio);
      botonEmail.removeAttribute('aria-busy');
      if (rechazo === 'sinEmail') {
        sinEmail = true;
      } else if (rechazo === 'emailIncierto') {
        opciones.sinConfirmar.marcar(turnoId);
        mostrarAlerta(rechazo);
        opciones.alResultado('emailSinConfirmar');
      } else {
        mostrarAlerta(rechazo);
      }
      aplicarBloqueoEmail();
      // Un botón recién deshabilitado pierde el foco: pasa al aviso que explica el motivo.
      if (tenia) (botonEmail.disabled ? avisoEmail : botonEmail).focus();
    }
  }

  botonEmail.addEventListener('click', () => {
    void enviarEmail();
  });

  botonWa.addEventListener('click', () => {
    void pedirEnlace();
  });

  aplicarBloqueoTelefono();
  aplicarBloqueoEmail();

  return h(
    'div',
    { className: 'acciones-recordatorio' },
    h('div', { className: 'botones-recordatorio' }, botonWa, botonEmail),
    h('p', { className: 'ayuda-recordatorio' }, MSG_AYUDA_ENLACE),
    avisoTel,
    avisoEmail,
    zonaEnlace,
    anuncio,
    alerta,
  );
}
