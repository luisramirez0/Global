import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import {
  MSG_FRANJA_SUPERPUESTA,
  MSG_LIMITE_SILLONES,
  MSG_NO_EXISTE,
  MSG_PROFESIONAL,
  MSG_REFERENCIA,
  MSG_SIN_PERMISO,
  mensajeDeError,
} from './mensajes';
import { puedeBorrarBloqueo, puedeEditarBloqueo, puedeGestionar } from './permisos';

describe('permisos (KB 03, spec access-control)', () => {
  it('ADMIN y PROFESIONAL gestionan sillones, prestaciones y horarios; RECEPCION no', () => {
    expect(puedeGestionar('ADMIN')).toBe(true);
    expect(puedeGestionar('PROFESIONAL')).toBe(true);
    expect(puedeGestionar('RECEPCION')).toBe(false);
  });

  it('los tres roles crean y editan bloqueos; solo ADMIN y PROFESIONAL los borran', () => {
    expect(puedeEditarBloqueo('RECEPCION')).toBe(true);
    expect(puedeEditarBloqueo('ADMIN')).toBe(true);
    expect(puedeBorrarBloqueo('RECEPCION')).toBe(false);
    expect(puedeBorrarBloqueo('PROFESIONAL')).toBe(true);
  });

  it('sin perfil: solo lectura', () => {
    expect(puedeGestionar(null)).toBe(false);
    expect(puedeEditarBloqueo(null)).toBe(false);
    expect(puedeBorrarBloqueo(null)).toBe(false);
  });
});

describe('mensajeDeError', () => {
  it('409 usa el mensaje del contexto o el genérico', () => {
    const conflicto = new ApiError('conflict', { status: 409, title: 'Límite de sillones activos' });
    expect(mensajeDeError(conflicto, { conflict: MSG_LIMITE_SILLONES })).toBe(MSG_LIMITE_SILLONES);
    expect(mensajeDeError(conflicto, { conflict: MSG_FRANJA_SUPERPUESTA })).toBe(MSG_FRANJA_SUPERPUESTA);
    expect(mensajeDeError(conflicto)).toBe('Ocurrió un error. Intentá de nuevo.');
  });

  it('404 → ya no existe; 403 → sin permiso', () => {
    expect(mensajeDeError(new ApiError('unexpected', { status: 404 }))).toBe(MSG_NO_EXISTE);
    expect(mensajeDeError(new ApiError('forbidden', { status: 403 }))).toBe(MSG_SIN_PERMISO);
  });

  it('422 → el del contexto o referencia inválida; 400 → revisar campos', () => {
    const e422 = new ApiError('validation', { status: 422, fieldErrors: [{ campo: 'profesionalId', mensaje: 'x' }] });
    expect(mensajeDeError(e422, { unprocessable: MSG_PROFESIONAL })).toBe(MSG_PROFESIONAL);
    expect(mensajeDeError(e422)).toBe(MSG_REFERENCIA);
    expect(mensajeDeError(new ApiError('validation', { status: 400 }))).toBe('Revisá los datos ingresados.');
  });

  it('red y errores no tipados', () => {
    expect(mensajeDeError(new ApiError('network'))).toBe('No se pudo conectar con el servidor.');
    expect(mensajeDeError(new Error('boom'))).toBe('Ocurrió un error. Intentá de nuevo.');
  });

  it('nunca repite el title ni el detail del servidor', () => {
    const e = new ApiError('conflict', { status: 409, title: '<b>secreto</b>' });
    expect(mensajeDeError(e, { conflict: MSG_LIMITE_SILLONES })).not.toContain('secreto');
  });
});
