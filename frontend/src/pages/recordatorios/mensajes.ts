/** Mensajes fijos de los recordatorios (design D4 de C-14): nunca el title/detail del servidor ni datos del paciente. */
import { MSG_CONNECTION } from '../auth/messages';
import { MSG_SIN_PERMISO } from '../config/mensajes';
import type { RechazoRecordatorio } from './dominio/rechazos';

export const MSG_SIN_TELEFONO = 'El paciente no tiene teléfono cargado.';
export const MSG_SIN_EMAIL = 'El paciente no tiene email cargado.';
export const MSG_NO_RECORDABLE = 'El turno ya no admite recordatorios (cambió de estado).';
export const MSG_NO_EXISTE = 'El turno ya no existe.';
export const MSG_SMTP_FALLO = 'No se pudo enviar el email. Probá más tarde o usá WhatsApp.';
export const MSG_SMTP_NO_DISPONIBLE = 'El envío de emails no está disponible en este momento.';
export const MSG_EMAIL_INCIERTO =
  'No se pudo confirmar el envío. Es posible que el email ya le haya llegado al paciente: no lo reenvíes sin verificarlo.';
export const MSG_WHATSAPP_INCIERTO =
  'No se recibió respuesta. Es posible que el enlace se haya generado; si volvés a intentarlo quedará otro registro.';
export const MSG_DESCONOCIDO = 'Ocurrió un error inesperado. Probá de nuevo o actualizá la lista.';

export function mensajeRecordatorio(rechazo: RechazoRecordatorio): string {
  switch (rechazo) {
    case 'sinTelefono':
      return MSG_SIN_TELEFONO;
    case 'sinEmail':
      return MSG_SIN_EMAIL;
    case 'noRecordable':
      return MSG_NO_RECORDABLE;
    case 'noExiste':
      return MSG_NO_EXISTE;
    case 'smtpFallo':
      return MSG_SMTP_FALLO;
    case 'smtpNoDisponible':
      return MSG_SMTP_NO_DISPONIBLE;
    case 'emailIncierto':
      return MSG_EMAIL_INCIERTO;
    case 'whatsappIncierto':
      return MSG_WHATSAPP_INCIERTO;
    case 'prohibido':
      return MSG_SIN_PERMISO;
    case 'conexion':
      return MSG_CONNECTION;
    case 'desconocido':
      return MSG_DESCONOCIDO;
    default: {
      const exhaustivo: never = rechazo;
      return exhaustivo;
    }
  }
}

export const MSG_ENLACE_LISTO = 'Enlace de WhatsApp listo.';
export const MSG_EMAIL_ENVIADO = 'Email enviado.';
export const MSG_AYUDA_ENLACE = 'Cada enlace generado queda registrado.';
export const MSG_ENVIO_SIN_CONFIRMAR = 'Envío por email sin confirmar: verificá con el paciente.';
export const MSG_RECORDADO_EMAIL = 'Recordatorio enviado por email.';
export const MSG_EMAIL_EN_CURSO = 'Enviando email…';
