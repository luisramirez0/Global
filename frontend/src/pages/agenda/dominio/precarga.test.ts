import { afterEach, describe, expect, it } from 'vitest';
import { BLOQUEO_CONSULTORIO, BLOQUEO_SILLON, HORARIO_MARTES, PRESTACION_CONTROL, PRESTACION_LIMPIEZA } from '../../../api/__fixtures__/agendaConfig';
import { TURNO_CANCELADO, TURNO_PROGRAMADO } from '../../../api/__fixtures__/turnos';
import type { Bloqueo, Horario, Turno } from '../../../api/types';
import { avisoHoraSugerida, precargaNuevoTurno, turnoEnfocadoVigente, type ContextoPrecarga } from './precarga';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env['TZ'];
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete env['TZ'];
  else env['TZ'] = ORIGINAL_TZ;
});

// 24/11/2026 es martes. 10:00 AR = 13:00Z.
const turno = (id: number, inicio: string, fin: string, sillonId: number, extra: Partial<Turno> = {}): Turno => ({
  ...TURNO_PROGRAMADO,
  id,
  inicio,
  fin,
  sillonId,
  ...extra,
});
const T_10_S2 = turno(10, '2026-11-24T13:00:00Z', '2026-11-24T13:30:00Z', 2);
const T_15_S2 = turno(11, '2026-11-24T18:00:00Z', '2026-11-24T18:30:00Z', 2);
const T_2330_S1 = turno(12, '2026-11-25T02:30:00Z', '2026-11-25T03:00:00Z', 1);
const T_CRUCE_S1 = turno(13, '2026-11-25T02:30:00Z', '2026-11-25T03:15:00Z', 1);

const ctx = (over: Partial<ContextoPrecarga> = {}): ContextoPrecarga => ({
  vista: 'dia',
  fechaVisible: '2026-11-24',
  sillonFiltrado: null,
  turnoEnfocadoId: null,
  turnosRenderizados: [T_10_S2, T_15_S2, T_2330_S1, T_CRUCE_S1],
  ...over,
});

describe('precargaNuevoTurno (5.1.a)', () => {
  it('turno enfocado de 10:00–10:30 del Sillón 2: fecha del turno, hora = su fin, su sillón', () => {
    expect(precargaNuevoTurno(ctx({ turnoEnfocadoId: 10 }))).toEqual({ fecha: '2026-11-24', hora: '10:30', sillonId: 2 });
  });

  it('otro turno enfocado da otra precarga (15:00–15:30 → 15:30)', () => {
    expect(precargaNuevoTurno(ctx({ turnoEnfocadoId: 11 }))).toEqual({ fecha: '2026-11-24', hora: '15:30', sillonId: 2 });
  });

  it('vista semanal: fecha y sillón del turno, no la fecha visible', () => {
    expect(precargaNuevoTurno(ctx({ vista: 'semana', fechaVisible: '2026-11-25', turnoEnfocadoId: 10 }))).toEqual({
      fecha: '2026-11-24',
      hora: '10:30',
      sillonId: 2,
    });
  });

  it('fin a 00:00 (23:30–00:00): la fecha es la del día siguiente', () => {
    expect(precargaNuevoTurno(ctx({ turnoEnfocadoId: 12 }))).toEqual({ fecha: '2026-11-25', hora: '00:00', sillonId: 1 });
  });

  it('un turno que cruza la medianoche: fecha del día siguiente y la hora de su fin', () => {
    expect(precargaNuevoTurno(ctx({ turnoEnfocadoId: 13 }))).toEqual({ fecha: '2026-11-25', hora: '00:15', sillonId: 1 });
  });

  it('sin turno enfocado: fecha visible, sillón filtrado y hora vacía', () => {
    expect(precargaNuevoTurno(ctx({ sillonFiltrado: 2 }))).toEqual({ fecha: '2026-11-24', hora: '', sillonId: 2 });
  });

  it('sin turno enfocado ni filtro: sillón null', () => {
    expect(precargaNuevoTurno(ctx())).toEqual({ fecha: '2026-11-24', hora: '', sillonId: null });
  });

  it('contexto obsoleto (el id enfocado ya no está renderizado): mismo fallback, sin datos del turno anterior', () => {
    expect(precargaNuevoTurno(ctx({ turnoEnfocadoId: 99, fechaVisible: '2026-11-25', sillonFiltrado: 1 }))).toEqual({
      fecha: '2026-11-25',
      hora: '',
      sillonId: 1,
    });
    expect(precargaNuevoTurno(ctx({ turnoEnfocadoId: 10, turnosRenderizados: [] }))).toEqual({ fecha: '2026-11-24', hora: '', sillonId: null });
  });

  it('turnoEnfocadoVigente devuelve el turno solo si sigue renderizado', () => {
    expect(turnoEnfocadoVigente(ctx({ turnoEnfocadoId: 10 }))).toBe(T_10_S2);
    expect(turnoEnfocadoVigente(ctx({ turnoEnfocadoId: 99 }))).toBeNull();
    expect(turnoEnfocadoVigente(ctx())).toBeNull();
  });

  it.each(['Asia/Tokyo', 'America/Los_Angeles'])('con TZ=%s el resultado es el mismo', (zona) => {
    env['TZ'] = zona;
    expect(precargaNuevoTurno(ctx({ turnoEnfocadoId: 10 }))).toEqual({ fecha: '2026-11-24', hora: '10:30', sillonId: 2 });
    expect(precargaNuevoTurno(ctx({ turnoEnfocadoId: 12 }))).toEqual({ fecha: '2026-11-25', hora: '00:00', sillonId: 1 });
  });
});

describe('avisoHoraSugerida (5.1.b)', () => {
  const HORARIO_MARTES_9_18: Horario = { ...HORARIO_MARTES, horaDesde: '09:00', horaHasta: '18:00' };
  const base = {
    fecha: '2026-11-24',
    hora: '10:30',
    sillonId: 2 as number | null,
    prestacion: PRESTACION_LIMPIEZA as { duracionMinutos: number } | null,
    turnos: [] as readonly Turno[],
    horarios: [HORARIO_MARTES_9_18] as readonly Horario[],
    bloqueos: [] as readonly Bloqueo[],
    minutosGrilla: 15,
  };
  const OCUPANTE = turno(20, '2026-11-24T13:30:00Z', '2026-11-24T14:00:00Z', 2); // 10:30–11:00

  it('hora libre, dentro del horario y alineada: sin aviso', () => {
    expect(avisoHoraSugerida(base)).toBeNull();
  });

  it('ocupada: prestación de 30 min contra un turno no cancelado de 10:30–11:00 del mismo sillón', () => {
    expect(avisoHoraSugerida({ ...base, turnos: [OCUPANTE] })).toEqual({ tipo: 'ocupada', desde: '10:30', hasta: '11:00' });
  });

  it('ocupada por la cola de un turno anterior que invade el inicio', () => {
    const anterior = turno(21, '2026-11-24T13:00:00Z', '2026-11-24T13:45:00Z', 2); // 10:00–10:45
    expect(avisoHoraSugerida({ ...base, turnos: [anterior] })).toEqual({ tipo: 'ocupada', desde: '10:00', hasta: '10:45' });
  });

  it('un turno que empieza dentro de la duración de la prestación también cuenta (10:15 + 30 min pisa 10:30)', () => {
    expect(avisoHoraSugerida({ ...base, hora: '10:15', turnos: [OCUPANTE] })).toEqual({ tipo: 'ocupada', desde: '10:30', hasta: '11:00' });
  });

  it('un turno cancelado no ocupa', () => {
    expect(avisoHoraSugerida({ ...base, turnos: [{ ...OCUPANTE, estado: 'CANCELADO' }, TURNO_CANCELADO] })).toBeNull();
  });

  it('un turno de otro sillón no ocupa', () => {
    expect(avisoHoraSugerida({ ...base, turnos: [{ ...OCUPANTE, sillonId: 1 }] })).toBeNull();
  });

  it('turnos adyacentes [a,b) no se superponen: termina a las 10:30 y empieza a las 11:00', () => {
    const previo = turno(22, '2026-11-24T13:00:00Z', '2026-11-24T13:30:00Z', 2); // 10:00–10:30
    const posterior = turno(23, '2026-11-24T14:00:00Z', '2026-11-24T14:30:00Z', 2); // 11:00–11:30
    expect(avisoHoraSugerida({ ...base, turnos: [previo, posterior] })).toBeNull();
  });

  it('sin prestación: ocupada solo si el inicio cae dentro de otro turno', () => {
    const sinPrestacion = { ...base, prestacion: null };
    expect(avisoHoraSugerida({ ...sinPrestacion, turnos: [OCUPANTE] })).toEqual({ tipo: 'ocupada', desde: '10:30', hasta: '11:00' });
    // Ningún turno contiene las 10:30 y otro empieza a las 10:45.
    const luego = turno(24, '2026-11-24T13:45:00Z', '2026-11-24T14:15:00Z', 2);
    expect(avisoHoraSugerida({ ...sinPrestacion, turnos: [luego] })).toBeNull();
  });

  it('con una prestación corta (15 min) el turno que empieza a las 10:45 no molesta, con una de 30 sí', () => {
    const luego = turno(24, '2026-11-24T13:45:00Z', '2026-11-24T14:15:00Z', 2);
    expect(avisoHoraSugerida({ ...base, prestacion: PRESTACION_CONTROL, turnos: [luego] })).toBeNull();
    expect(avisoHoraSugerida({ ...base, turnos: [luego] })).toEqual({ tipo: 'ocupada', desde: '10:45', hasta: '11:15' });
  });

  it('fueraDeHorario: 18:00 con horario hasta las 18:00 (fin exclusivo)', () => {
    expect(avisoHoraSugerida({ ...base, hora: '18:00' })).toEqual({ tipo: 'fueraDeHorario' });
  });

  it('fueraDeHorario: antes de abrir y un día sin horario (miércoles)', () => {
    expect(avisoHoraSugerida({ ...base, hora: '08:45' })).toEqual({ tipo: 'fueraDeHorario' });
    expect(avisoHoraSugerida({ ...base, fecha: '2026-11-25' })).toEqual({ tipo: 'fueraDeHorario' });
  });

  it('la apertura es inclusiva: 09:00 está dentro', () => {
    expect(avisoHoraSugerida({ ...base, hora: '09:00' })).toBeNull();
  });

  it('bloqueada: bloqueo del sillón de 12:00 a 13:00 con hora sugerida 12:00', () => {
    const bloqueo: Bloqueo = { ...BLOQUEO_SILLON, sillonId: 2, inicio: '2026-11-24T15:00:00Z', fin: '2026-11-24T16:00:00Z' };
    expect(avisoHoraSugerida({ ...base, hora: '12:00', bloqueos: [bloqueo] })).toEqual({ tipo: 'bloqueada' });
  });

  it('bloqueada por un bloqueo de todo el consultorio; no por el de otro sillón', () => {
    const todo: Bloqueo = { ...BLOQUEO_CONSULTORIO, inicio: '2026-11-24T15:00:00Z', fin: '2026-11-24T16:00:00Z' };
    const otro: Bloqueo = { ...BLOQUEO_SILLON, sillonId: 1, inicio: '2026-11-24T15:00:00Z', fin: '2026-11-24T16:00:00Z' };
    expect(avisoHoraSugerida({ ...base, hora: '12:30', bloqueos: [todo] })).toEqual({ tipo: 'bloqueada' });
    expect(avisoHoraSugerida({ ...base, hora: '12:30', bloqueos: [otro] })).toBeNull();
  });

  it('el fin del bloqueo es exclusivo: 13:00 no está bloqueada', () => {
    const bloqueo: Bloqueo = { ...BLOQUEO_SILLON, sillonId: 2, inicio: '2026-11-24T15:00:00Z', fin: '2026-11-24T16:00:00Z' };
    expect(avisoHoraSugerida({ ...base, hora: '13:00', bloqueos: [bloqueo] })).toBeNull();
  });

  it('fueraDeGrilla: 09:20 con grilla 15; con grilla 20 está alineada', () => {
    expect(avisoHoraSugerida({ ...base, hora: '09:20' })).toEqual({ tipo: 'fueraDeGrilla' });
    expect(avisoHoraSugerida({ ...base, hora: '09:20', minutosGrilla: 20 })).toBeNull();
  });

  it.each([['', '2026-11-24'], ['25:00', '2026-11-24'], ['10:30', ''], ['10:30', '2026-02-30']])('inválida: hora %j fecha %j', (hora, fecha) => {
    expect(avisoHoraSugerida({ ...base, hora, fecha })).toEqual({ tipo: 'invalida' });
  });

  it('sin sillón elegido no se evalúa ocupación ni bloqueos de sillón', () => {
    const bloqueo: Bloqueo = { ...BLOQUEO_SILLON, sillonId: 2, inicio: '2026-11-24T13:30:00Z', fin: '2026-11-24T14:30:00Z' };
    expect(avisoHoraSugerida({ ...base, sillonId: null, turnos: [OCUPANTE], bloqueos: [bloqueo] })).toBeNull();
  });

  it('fecha fuera de los datos cargados: solo horario, grilla y validez (nunca se inventa ocupación)', () => {
    const cobertura = { desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z', sillonId: null };
    const otroDia = turno(30, '2026-11-26T13:30:00Z', '2026-11-26T14:00:00Z', 2);
    const horarioJueves: Horario = { ...HORARIO_MARTES_9_18, diaSemana: 4 };
    expect(avisoHoraSugerida({ ...base, fecha: '2026-11-26', turnos: [otroDia], horarios: [horarioJueves], cobertura })).toBeNull();
  });

  it('sillón distinto del filtrado en los datos cargados: no se evalúa ocupación', () => {
    const cobertura = { desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z', sillonId: 1 };
    expect(avisoHoraSugerida({ ...base, turnos: [OCUPANTE], cobertura })).toBeNull();
  });

  it('con cobertura que incluye la fecha y el sillón, la ocupación se detecta', () => {
    const cobertura = { desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z', sillonId: 2 };
    expect(avisoHoraSugerida({ ...base, turnos: [OCUPANTE], cobertura })).toEqual({ tipo: 'ocupada', desde: '10:30', hasta: '11:00' });
  });

  it('prioridad: ocupada gana sobre fuera de horario', () => {
    const tarde = turno(31, '2026-11-24T21:00:00Z', '2026-11-24T21:30:00Z', 2); // 18:00–18:30
    expect(avisoHoraSugerida({ ...base, hora: '18:00', turnos: [tarde] })).toEqual({ tipo: 'ocupada', desde: '18:00', hasta: '18:30' });
  });

  it.each(['Asia/Tokyo', 'America/Los_Angeles'])('con TZ=%s el aviso es el mismo', (zona) => {
    env['TZ'] = zona;
    expect(avisoHoraSugerida({ ...base, turnos: [OCUPANTE] })).toEqual({ tipo: 'ocupada', desde: '10:30', hasta: '11:00' });
    expect(avisoHoraSugerida({ ...base, hora: '18:00' })).toEqual({ tipo: 'fueraDeHorario' });
  });
});
