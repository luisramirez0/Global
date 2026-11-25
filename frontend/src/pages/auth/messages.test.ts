import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import { MSG_CHECK_FIELDS, MSG_GENERIC, messageForError } from './messages';

/** A-D3 (C-12): un codigo de negocio desconocido muestra el mensaje genérico fijo del kind, nunca el codigo crudo. */
describe('messageForError con codigo de negocio', () => {
  it('un 409 con codigo desconocido da el mensaje genérico de conflict', () => {
    const err = new ApiError('conflict', { status: 409, codigo: 'CODIGO_NUEVO_DEL_BACKEND' });
    expect(messageForError(err)).toBe(MSG_GENERIC);
    expect(messageForError(err)).toBe(messageForError(new ApiError('conflict', { status: 409 })));
  });

  it('un 422 con codigo desconocido da el mensaje genérico de validation', () => {
    const err = new ApiError('validation', { status: 422, codigo: 'OTRO_CODIGO' });
    expect(messageForError(err)).toBe(MSG_CHECK_FIELDS);
  });

  it('nunca incluye el codigo crudo', () => {
    for (const codigo of ['FICHA_DESACTUALIZADA', 'CODIGO_NUEVO_DEL_BACKEND']) {
      expect(messageForError(new ApiError('conflict', { status: 409, codigo }))).not.toContain(codigo);
    }
  });

  it('respeta los overrides por kind aunque haya codigo', () => {
    const err = new ApiError('conflict', { status: 409, codigo: 'X' });
    expect(messageForError(err, { conflict: 'Mensaje propio.' })).toBe('Mensaje propio.');
  });

  it('un error que no es ApiError da el mensaje genérico', () => {
    expect(messageForError(new TypeError('bug'))).toBe(MSG_GENERIC);
  });
});
