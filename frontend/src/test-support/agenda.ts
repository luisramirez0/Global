/** Utilidades de test para la página de agenda (solo se importan desde *.test.ts). */
import { SILLON_1, SILLON_2, PRESTACION_CONTROL, PRESTACION_LIMPIEZA, HORARIO_LUNES, HORARIO_MARTES } from '../api/__fixtures__/agendaConfig';
import { PAGINA_PACIENTES } from '../api/__fixtures__/pacientes';
import { vi } from 'vitest';
import { TURNO_PROGRAMADO } from '../api/__fixtures__/turnos';
import { toApiError, type ApiError } from '../api/errors';
import type { Bloqueo, EstadoTurno, Horario, Paciente, Pagina, Prestacion, Rol, Sillon, Turno } from '../api/types';
import { renderAgenda } from '../pages/agenda/agenda';
import type { Page } from '../router/router';
import { createLoggedContext, flush, type TestContext } from './pages';

export interface DatosAgenda {
  sillones?: Sillon[];
  prestaciones?: Prestacion[];
  horarios?: Horario[];
  turnos?: Turno[];
  bloqueos?: Bloqueo[];
  pacientes?: Pagina<Paciente>;
}

/** Horarios de lunes a viernes de 09:00 a 18:00 del profesional 7 (martes 24/11 incluido). */
export const HORARIOS_ESTANDAR: Horario[] = [
  { ...HORARIO_LUNES, horaDesde: '09:00', horaHasta: '18:00' },
  { ...HORARIO_MARTES, horaDesde: '09:00', horaHasta: '18:00' },
  { id: 22, profesionalId: 7, diaSemana: 3, horaDesde: '09:00', horaHasta: '18:00' },
  { id: 23, profesionalId: 7, diaSemana: 4, horaDesde: '09:00', horaHasta: '18:00' },
  { id: 24, profesionalId: 7, diaSemana: 5, horaDesde: '09:00', horaHasta: '18:00' },
];

/** Deja los mocks de la API respondiendo con los datos dados (por defecto, una agenda vacía y razonable). */
export function configurarAgenda(ctx: TestContext, datos: DatosAgenda = {}): void {
  ctx.agenda.listarSillones.mockResolvedValue(datos.sillones ?? [SILLON_1, SILLON_2]);
  ctx.agenda.listarPrestaciones.mockResolvedValue(datos.prestaciones ?? [PRESTACION_CONTROL, PRESTACION_LIMPIEZA]);
  ctx.agenda.listarHorarios.mockResolvedValue(datos.horarios ?? HORARIOS_ESTANDAR);
  ctx.agenda.listarBloqueos.mockResolvedValue(datos.bloqueos ?? []);
  ctx.turnos.listar.mockResolvedValue(datos.turnos ?? []);
  ctx.pacientes.buscar.mockResolvedValue(datos.pacientes ?? PAGINA_PACIENTES);
}

export interface AgendaMontada {
  page: Page;
  root: HTMLElement;
  ctx: TestContext;
}

export async function montarAgenda(ctx: TestContext, datos: DatosAgenda = {}): Promise<AgendaMontada> {
  configurarAgenda(ctx, datos);
  const page = renderAgenda(ctx);
  document.body.replaceChildren(page.element);
  await flush();
  return { page, root: page.element, ctx };
}

export const boton = (nombre: string): HTMLButtonElement => {
  const encontrado = [...document.querySelectorAll('button')].filter((b) => b.textContent === nombre || b.getAttribute('aria-label') === nombre);
  if (encontrado.length !== 1 || encontrado[0] === undefined) throw new Error(`Se esperaba un botón "${nombre}" y hay ${encontrado.length}`);
  return encontrado[0];
};

export const bloqueDe = (id: number): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`.grilla [data-turno-id="${id}"]`);
  if (el === null) throw new Error(`sin bloque del turno ${id}`);
  return el;
};

export const dialogo = (): HTMLDialogElement | null => document.querySelector('dialog');

/* ---- Utilidades para las pruebas de integración de la página (acciones, reprogramar, foco) ---- */

/** Reloj falso (fecha y timers del *debounce*) con "ahora" = martes 24/11/2026 12:00 en Argentina. */
export function usarRelojFalso(): void {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-11-24T15:00:00Z'));
}

export const tick = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

export const http = (status: number, body?: unknown): ApiError => toApiError(status, new Headers(), body);

/** Contexto con sesión del rol dado, API simulada y la página real montada (con el reloj falso activo). */
export async function montarConTimers(rol: Rol = 'ADMIN', datos: DatosAgenda = {}) {
  const ctx = createLoggedContext(rol);
  configurarAgenda(ctx, datos);
  const page = renderAgenda(ctx);
  document.body.replaceChildren(page.element);
  await tick();
  return { ctx, page };
}

/** Turno del 24/11/2026 (o `fecha`) que empieza a la hora de Argentina `hhmm` y dura `minutos`. */
export function turnoAR(
  id: number,
  hhmm: string,
  opciones: { minutos?: number; sillonId?: number; estado?: EstadoTurno; fecha?: string; sobreturno?: boolean } = {},
): Turno {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const [anio = 2026, mes = 11, dia = 24] = (opciones.fecha ?? '2026-11-24').split('-').map(Number);
  const inicio = Date.UTC(anio, mes - 1, dia, h + 3, m);
  const fin = inicio + (opciones.minutos ?? 30) * 60_000;
  return {
    ...TURNO_PROGRAMADO,
    id,
    inicio: new Date(inicio).toISOString().replace('.000Z', 'Z'),
    fin: new Date(fin).toISOString().replace('.000Z', 'Z'),
    estado: opciones.estado ?? 'PROGRAMADO',
    sillonId: opciones.sillonId ?? 1,
    sobreturno: opciones.sobreturno ?? false,
  };
}

/** Botón del diálogo abierto con ese texto. */
export function botonDialogo(texto: string): HTMLButtonElement {
  const encontrados = [...(dialogo()?.querySelectorAll('button') ?? [])].filter((b) => b.textContent === texto);
  if (encontrados.length !== 1 || encontrados[0] === undefined) throw new Error(`Se esperaba un botón "${texto}" en el diálogo y hay ${encontrados.length}`);
  return encontrados[0];
}

export const textosBotonesDialogo = (): string[] => [...(dialogo()?.querySelectorAll('button') ?? [])].map((b) => b.textContent ?? '');
export const anuncioAgenda = (): string => document.querySelector('.anuncio')?.textContent ?? '';
export const escape = (): void => {
  dialogo()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
};
