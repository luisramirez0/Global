import { describe, expect, it } from 'vitest';
import { PROBLEM_422_EMAIL, PROBLEM_422_TELEFONO, PROBLEM_502, PROBLEM_503 } from '../../../api/__fixtures__/recordatorios';
import { ApiError, toApiError } from '../../../api/errors';
import { MSG_SIN_PERMISO } from '../../config/mensajes';
import { MSG_CONNECTION } from '../../auth/messages';
import {
  MSG_EMAIL_INCIERTO,
  MSG_NO_RECORDABLE,
  MSG_SIN_EMAIL,
  MSG_SIN_TELEFONO,
  MSG_SMTP_FALLO,
  MSG_SMTP_NO_DISPONIBLE,
  MSG_WHATSAPP_INCIERTO,
  mensajeRecordatorio,
} from '../mensajes';
import { clasificarErrorRecordatorio, type RechazoRecordatorio } from './rechazos';

const headers = new Headers();
const http = (status: number, body?: unknown): ApiError => toApiError(status, headers, body);
const tipo = (error: unknown, canal: 'EMAIL' | 'WHATSAPP_LINK'): RechazoRecordatorio => clasificarErrorRecordatorio(error, canal);

describe('clasificarErrorRecordatorio', () => {
  it.each(['EMAIL', 'WHATSAPP_LINK'] as const)('422 campo telefono -> sinTelefono (%s)', (canal) => {
    expect(tipo(http(422, PROBLEM_422_TELEFONO), canal)).toBe('sinTelefono');
  });

  it.each(['EMAIL', 'WHATSAPP_LINK'] as const)('422 campo email -> sinEmail (%s)', (canal) => {
    expect(tipo(http(422, PROBLEM_422_EMAIL), canal)).toBe('sinEmail');
  });

  it('422 con otro campo o sin campos -> desconocido', () => {
    expect(tipo(http(422, { errores: [{ campo: 'otro', mensaje: 'x' }] }), 'EMAIL')).toBe('desconocido');
    expect(tipo(http(422), 'EMAIL')).toBe('desconocido');
  });

  it('409 -> noRecordable y 404 -> noExiste', () => {
    expect(tipo(http(409, { title: 'x' }), 'WHATSAPP_LINK')).toBe('noRecordable');
    expect(tipo(http(409), 'EMAIL')).toBe('noRecordable');
    expect(tipo(http(404), 'EMAIL')).toBe('noExiste');
    expect(tipo(http(404), 'WHATSAPP_LINK')).toBe('noExiste');
  });

  it('502 -> smtpFallo y 503 -> smtpNoDisponible; 502 nunca es emailIncierto', () => {
    expect(tipo(http(502, PROBLEM_502), 'EMAIL')).toBe('smtpFallo');
    expect(tipo(http(503, PROBLEM_503), 'EMAIL')).toBe('smtpNoDisponible');
    expect(tipo(http(502, PROBLEM_502), 'EMAIL')).not.toBe('emailIncierto');
  });

  it('500, timeout y network en EMAIL -> emailIncierto', () => {
    expect(tipo(http(500), 'EMAIL')).toBe('emailIncierto');
    expect(tipo(new ApiError('timeout'), 'EMAIL')).toBe('emailIncierto');
    expect(tipo(new ApiError('network'), 'EMAIL')).toBe('emailIncierto');
  });

  it('un 2xx con cuerpo ilegible en EMAIL -> emailIncierto (el email pudo salir)', () => {
    expect(tipo(new ApiError('unexpected', { status: 201 }), 'EMAIL')).toBe('emailIncierto');
    expect(tipo(new ApiError('unexpected', { status: 200 }), 'WHATSAPP_LINK')).toBe('desconocido');
  });

  it('un unexpected sin status (decoder sobre un 201 vacío o inválido) en EMAIL -> emailIncierto; en WhatsApp -> desconocido', () => {
    expect(tipo(new ApiError('unexpected'), 'EMAIL')).toBe('emailIncierto');
    expect(tipo(new ApiError('unexpected'), 'WHATSAPP_LINK')).toBe('desconocido');
  });

  it('un unexpected con un status de error (p. ej. 418) no es incierto', () => {
    expect(tipo(new ApiError('unexpected', { status: 418 }), 'EMAIL')).toBe('desconocido');
  });

  it('timeout en WHATSAPP_LINK -> whatsappIncierto; network -> conexion; 500 -> desconocido', () => {
    expect(tipo(new ApiError('timeout'), 'WHATSAPP_LINK')).toBe('whatsappIncierto');
    expect(tipo(new ApiError('network'), 'WHATSAPP_LINK')).toBe('conexion');
    expect(tipo(http(500), 'WHATSAPP_LINK')).toBe('desconocido');
  });

  it('403 -> prohibido (ambos canales)', () => {
    expect(tipo(http(403), 'EMAIL')).toBe('prohibido');
    expect(tipo(http(403), 'WHATSAPP_LINK')).toBe('prohibido');
  });

  it('un error que no es ApiError -> desconocido', () => {
    expect(tipo(new Error('boom'), 'EMAIL')).toBe('desconocido');
    expect(tipo('texto', 'WHATSAPP_LINK')).toBe('desconocido');
    expect(tipo(undefined, 'EMAIL')).toBe('desconocido');
  });

  it('dos errores iguales salvo title/detail clasifican igual', () => {
    const a = http(502, { title: 'No se pudo enviar el email', detail: 'a' });
    const b = http(502, { title: 'Otro texto cualquiera', detail: 'b' });
    expect(tipo(a, 'EMAIL')).toBe(tipo(b, 'EMAIL'));
    const c = http(422, { title: 'A', errores: [{ campo: 'telefono', mensaje: 'x' }] });
    const d = http(422, { title: 'B', errores: [{ campo: 'telefono', mensaje: 'y' }] });
    expect(tipo(c, 'WHATSAPP_LINK')).toBe(tipo(d, 'WHATSAPP_LINK'));
  });
});

describe('mensajeRecordatorio (textos fijos del spec)', () => {
  it('cada rechazo tiene su texto aprobado', () => {
    expect(mensajeRecordatorio('sinTelefono')).toBe('El paciente no tiene teléfono cargado.');
    expect(mensajeRecordatorio('sinEmail')).toBe('El paciente no tiene email cargado.');
    expect(mensajeRecordatorio('noRecordable')).toBe('El turno ya no admite recordatorios (cambió de estado).');
    expect(mensajeRecordatorio('smtpFallo')).toBe('No se pudo enviar el email. Probá más tarde o usá WhatsApp.');
    expect(mensajeRecordatorio('smtpNoDisponible')).toBe('El envío de emails no está disponible en este momento.');
    expect(mensajeRecordatorio('emailIncierto')).toBe(
      'No se pudo confirmar el envío. Es posible que el email ya le haya llegado al paciente: no lo reenvíes sin verificarlo.',
    );
    expect(mensajeRecordatorio('whatsappIncierto')).toBe(
      'No se recibió respuesta. Es posible que el enlace se haya generado; si volvés a intentarlo quedará otro registro.',
    );
    expect(mensajeRecordatorio('prohibido')).toBe(MSG_SIN_PERMISO);
    expect(mensajeRecordatorio('conexion')).toBe(MSG_CONNECTION);
  });

  it('emailIncierto no invita a reintentar ni dice "Probá más tarde"; whatsappIncierto avisa del nuevo registro', () => {
    expect(MSG_EMAIL_INCIERTO.toLowerCase()).not.toContain('reintentar');
    expect(MSG_EMAIL_INCIERTO).not.toContain('Probá más tarde');
    expect(MSG_EMAIL_INCIERTO).toContain('pudo');
    expect(MSG_SMTP_NO_DISPONIBLE).not.toContain('Probá más tarde');
    expect(MSG_WHATSAPP_INCIERTO).toContain('otro registro');
    expect(MSG_SIN_TELEFONO).not.toBe(MSG_SIN_EMAIL);
    expect(MSG_NO_RECORDABLE).not.toBe(MSG_SMTP_FALLO);
  });

  it('todos los rechazos tienen un mensaje no vacío y distinto del title del servidor', () => {
    const todos: readonly RechazoRecordatorio[] = [
      'sinTelefono', 'sinEmail', 'noRecordable', 'noExiste', 'smtpFallo', 'smtpNoDisponible',
      'emailIncierto', 'whatsappIncierto', 'prohibido', 'conexion', 'desconocido',
    ];
    for (const t of todos) {
      expect(mensajeRecordatorio(t)).not.toBe('');
      expect(mensajeRecordatorio(t)).not.toContain('Texto del servidor');
    }
  });
});
