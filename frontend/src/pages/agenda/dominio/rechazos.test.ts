import { describe, expect, it } from 'vitest';
import {
  CONFLICTO_PROFESIONAL,
  CONFLICTO_SILLON,
  PROBLEM_409_CONFLICTO,
  PROBLEM_409_GENERICO,
  PROBLEM_422_BLOQUEO,
  PROBLEM_422_FUERA_DE_AGENDA,
  PROBLEM_422_PROFESIONAL,
  PROBLEM_422_REFERENCIA,
} from '../../../api/__fixtures__/turnos';
import { ApiError, toApiError } from '../../../api/errors';
import { admiteSobreturno, clasificarRechazo, requiereRecargaManual, type AccionTurno, type Rechazo } from './rechazos';

const headers = new Headers();
const http = (status: number, body?: unknown): ApiError => toApiError(status, headers, body);
const ACCIONES: readonly AccionTurno[] = ['alta', 'estado', 'reprogramar'];

describe('clasificarRechazo: 409', () => {
  it('conflicto SILLON → sillon, con el detalle', () => {
    expect(clasificarRechazo(http(409, PROBLEM_409_CONFLICTO), { accion: 'alta' })).toEqual({ tipo: 'sillon', conflicto: CONFLICTO_SILLON });
  });

  it('conflicto PROFESIONAL → profesional, con el detalle', () => {
    const body = { ...PROBLEM_409_CONFLICTO, conflicto: CONFLICTO_PROFESIONAL };
    expect(clasificarRechazo(http(409, body), { accion: 'reprogramar' })).toEqual({ tipo: 'profesional', conflicto: CONFLICTO_PROFESIONAL });
  });

  it.each(ACCIONES)('409 sin conflicto en %s → sinIdentificar', (accion) => {
    expect(clasificarRechazo(http(409, PROBLEM_409_GENERICO), { accion })).toEqual({ tipo: 'sinIdentificar' });
    expect(clasificarRechazo(http(409), { accion })).toEqual({ tipo: 'sinIdentificar' });
  });

  it('409 con conflicto mal formado se trata como sin conflicto', () => {
    expect(clasificarRechazo(http(409, { conflicto: { motivo: 'OTRO' } }), { accion: 'alta' })).toEqual({ tipo: 'sinIdentificar' });
  });
});

describe('clasificarRechazo: 404', () => {
  it.each(['estado', 'reprogramar'] as const)('404 al %s → noExiste', (accion) => {
    expect(clasificarRechazo(http(404), { accion })).toEqual({ tipo: 'noExiste' });
  });

  it('404 en el alta no habla de un turno que ya no existe: queda desconocido', () => {
    expect(clasificarRechazo(http(404), { accion: 'alta' })).toEqual({ tipo: 'desconocido' });
  });
});

describe('clasificarRechazo: 422', () => {
  it('con bloqueoId → bloqueo', () => {
    expect(clasificarRechazo(http(422, PROBLEM_422_BLOQUEO), { accion: 'alta' })).toEqual({ tipo: 'bloqueo', bloqueoId: 4 });
  });

  it('error en inicio sin bloqueo → fueraDeAgenda', () => {
    expect(clasificarRechazo(http(422, PROBLEM_422_FUERA_DE_AGENDA), { accion: 'reprogramar' })).toEqual({ tipo: 'fueraDeAgenda' });
  });

  it('error en profesionalId → profesionalNoResuelto', () => {
    expect(clasificarRechazo(http(422, PROBLEM_422_PROFESIONAL), { accion: 'alta' })).toEqual({ tipo: 'profesionalNoResuelto' });
  });

  it.each(['pacienteId', 'prestacionId', 'sillonId'])('error en %s → referencia', (campo) => {
    const body = { errores: [{ campo, mensaje: 'no existe' }] };
    expect(clasificarRechazo(http(422, body), { accion: 'alta' })).toEqual({ tipo: 'referencia', campos: [campo] });
  });

  it('referencia con varios campos los conserva sin repetir', () => {
    const body = { errores: [{ campo: 'pacienteId', mensaje: 'a' }, { campo: 'sillonId', mensaje: 'b' }, { campo: 'sillonId', mensaje: 'c' }] };
    expect(clasificarRechazo(http(422, body), { accion: 'alta' })).toEqual({ tipo: 'referencia', campos: ['pacienteId', 'sillonId'] });
  });

  it('sin campos reconocibles → validacionGenerica', () => {
    expect(clasificarRechazo(http(422, { title: 'Cualquier cosa' }), { accion: 'alta' })).toEqual({ tipo: 'validacionGenerica' });
    expect(clasificarRechazo(http(422), { accion: 'alta' })).toEqual({ tipo: 'validacionGenerica' });
    expect(clasificarRechazo(http(422, { errores: [{ campo: 'otroCampo', mensaje: 'x' }] }), { accion: 'alta' })).toEqual({ tipo: 'validacionGenerica' });
  });

  it('prioridad: inicio + profesionalId → fueraDeAgenda', () => {
    const body = { errores: [{ campo: 'profesionalId', mensaje: 'a' }, { campo: 'inicio', mensaje: 'b' }] };
    expect(clasificarRechazo(http(422, body), { accion: 'alta' })).toEqual({ tipo: 'fueraDeAgenda' });
  });

  it('prioridad: bloqueoId gana sobre el campo inicio y sobre profesionalId', () => {
    const body = { errores: [{ campo: 'profesionalId', mensaje: 'a' }], bloqueoId: 9 };
    expect(clasificarRechazo(http(422, body), { accion: 'alta' })).toEqual({ tipo: 'bloqueo', bloqueoId: 9 });
  });

  it('prioridad: profesionalId gana sobre referencias', () => {
    const body = { errores: [{ campo: 'pacienteId', mensaje: 'a' }, { campo: 'profesionalId', mensaje: 'b' }] };
    expect(clasificarRechazo(http(422, body), { accion: 'alta' })).toEqual({ tipo: 'profesionalNoResuelto' });
  });

  it('la referencia inválida del backend (fixture real) se clasifica como referencia', () => {
    expect(clasificarRechazo(http(422, PROBLEM_422_REFERENCIA), { accion: 'alta' })).toEqual({ tipo: 'referencia', campos: ['pacienteId'] });
  });
});

describe('clasificarRechazo: otros estados', () => {
  it('400 → campos, con los nombres de campo del servidor', () => {
    const body = { errores: [{ campo: 'notas', mensaje: 'demasiado larga' }, { campo: 'pacienteId', mensaje: 'obligatorio' }] };
    expect(clasificarRechazo(http(400, body), { accion: 'alta' })).toEqual({ tipo: 'campos', campos: ['notas', 'pacienteId'] });
  });

  it('400 sin errores por campo → campos vacío', () => {
    expect(clasificarRechazo(http(400), { accion: 'estado' })).toEqual({ tipo: 'campos', campos: [] });
  });

  it('403 → prohibido', () => {
    expect(clasificarRechazo(http(403), { accion: 'estado' })).toEqual({ tipo: 'prohibido' });
  });

  it.each(['network', 'timeout'] as const)('%s → conexion', (kind) => {
    expect(clasificarRechazo(new ApiError(kind), { accion: 'alta' })).toEqual({ tipo: 'conexion' });
  });

  it.each([
    ['500', http(500)],
    ['503', http(503, { title: 'x' })],
    ['429', http(429)],
    ['unexpected sin estado', new ApiError('unexpected')],
    ['418', http(418)],
    ['un error que no es ApiError', new Error('boom')],
    ['un valor cualquiera', 'x'],
  ])('%s → desconocido', (_nombre, error) => {
    expect(clasificarRechazo(error, { accion: 'reprogramar' })).toEqual({ tipo: 'desconocido' });
  });
});

describe('nunca se usa el title ni el detail del servidor', () => {
  it.each([
    [409, { conflicto: CONFLICTO_SILLON }],
    [409, {}],
    [404, {}],
    [422, { errores: [{ campo: 'inicio', mensaje: 'm' }], bloqueoId: 4 }],
    [422, { errores: [{ campo: 'inicio', mensaje: 'm' }] }],
    [422, { errores: [{ campo: 'pacienteId', mensaje: 'm' }] }],
    [422, {}],
    [400, { errores: [{ campo: 'notas', mensaje: 'm' }] }],
    [500, {}],
  ])('dos errores %i idénticos salvo title/detail clasifican igual', (status, base) => {
    const a = clasificarRechazo(http(status, { ...base, title: 'Turno en conflicto', detail: 'uno' }), { accion: 'estado' });
    const b = clasificarRechazo(http(status, { ...base, title: 'Modificación concurrente', detail: 'otro' }), { accion: 'estado' });
    expect(a).toEqual(b);
  });

  it('el resultado no arrastra el title', () => {
    const rechazo = clasificarRechazo(http(409, { title: 'TITULO-SECRETO', detail: 'DETALLE-SECRETO' }), { accion: 'estado' });
    expect(JSON.stringify(rechazo)).not.toContain('SECRETO');
  });
});

describe('admiteSobreturno', () => {
  const sillon: Rechazo = { tipo: 'sillon', conflicto: CONFLICTO_SILLON };
  const casos: readonly [Rechazo, boolean][] = [
    [{ tipo: 'profesional', conflicto: CONFLICTO_PROFESIONAL }, true],
    [{ tipo: 'fueraDeAgenda' }, true],
    [{ tipo: 'bloqueo', bloqueoId: 4 }, true],
    [sillon, false],
    [{ tipo: 'referencia', campos: ['pacienteId'] }, false],
    [{ tipo: 'profesionalNoResuelto' }, false],
    [{ tipo: 'validacionGenerica' }, false],
    [{ tipo: 'sinIdentificar' }, false],
    [{ tipo: 'noExiste' }, false],
    [{ tipo: 'campos', campos: [] }, false],
    [{ tipo: 'prohibido' }, false],
    [{ tipo: 'conexion' }, false],
    [{ tipo: 'desconocido' }, false],
  ];

  it.each(casos)('%j → %s', (rechazo, esperado) => {
    expect(admiteSobreturno(rechazo)).toBe(esperado);
  });
});

describe('requiereRecargaManual', () => {
  it.each([
    [{ tipo: 'noExiste' }, true],
    [{ tipo: 'sinIdentificar' }, true],
    [{ tipo: 'desconocido' }, true],
    [{ tipo: 'sillon', conflicto: CONFLICTO_SILLON }, false],
    [{ tipo: 'profesional', conflicto: CONFLICTO_PROFESIONAL }, false],
    [{ tipo: 'bloqueo', bloqueoId: 4 }, false],
    [{ tipo: 'fueraDeAgenda' }, false],
    [{ tipo: 'profesionalNoResuelto' }, false],
    [{ tipo: 'referencia', campos: ['sillonId'] }, false],
    [{ tipo: 'validacionGenerica' }, false],
    [{ tipo: 'campos', campos: ['notas'] }, false],
    [{ tipo: 'prohibido' }, false],
    [{ tipo: 'conexion' }, false],
  ] as const satisfies readonly (readonly [Rechazo, boolean])[])('%j → %s', (rechazo, esperado) => {
    expect(requiereRecargaManual(rechazo)).toBe(esperado);
  });
});
