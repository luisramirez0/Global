/**
 * Pruebas de integración del alta de turno (tareas 5.1 a 5.4 de C-13): se renderiza la página real `/agenda` con
 * sus componentes y funciones de dominio reales; solo la API está simulada con los mocks de test-support.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOQUEO_SILLON } from '../../api/__fixtures__/agendaConfig';
import { PACIENTE_ANA, PACIENTE_MINIMO } from '../../api/__fixtures__/pacientes';
import {
  CONFLICTO_PROFESIONAL,
  PROBLEM_409_CONFLICTO,
  PROBLEM_409_GENERICO,
  PROBLEM_422_BLOQUEO,
  PROBLEM_422_FUERA_DE_AGENDA,
  PROBLEM_422_PROFESIONAL,
  PROBLEM_422_REFERENCIA,
  TURNO_PROGRAMADO,
  XSS_IMG,
} from '../../api/__fixtures__/turnos';
import { ApiError, toApiError } from '../../api/errors';
import type { Paciente, Turno, TurnoCreateRequest } from '../../api/types';
import { bloqueDe, boton, configurarAgenda, dialogo, type DatosAgenda } from '../../test-support/agenda';
import { createLoggedContext, deferred, type TestContext } from '../../test-support/pages';
import type { Rol } from '../../api/types';
import { renderAgenda } from './agenda';

// Se simulan también los timers del *debounce* del buscador; el reloj marca martes 24/11/2026 12:00 (Argentina).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-11-24T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  sessionStorage.clear();
});

const tick = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};
const headers = new Headers();
const http = (status: number, body?: unknown): ApiError => toApiError(status, headers, body);

async function montar(rol: Rol = 'ADMIN', datos: DatosAgenda = {}) {
  const ctx: TestContext = createLoggedContext(rol);
  configurarAgenda(ctx, datos);
  const page = renderAgenda(ctx);
  document.body.replaceChildren(page.element);
  await tick();
  return { ctx, page };
}

const ALTA_OK: Turno = { ...TURNO_PROGRAMADO, id: 500 };
const el = (name: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
  const e = dialogo()?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
  if (e === null || e === undefined) throw new Error(`sin campo ${name}`);
  return e;
};
const valores = () => ({
  paciente: el('paciente').value,
  prestacionId: el('prestacionId').value,
  sillonId: el('sillonId').value,
  fecha: el('fecha').value,
  hora: el('hora').value,
  notas: el('notas').value,
});
const alertaAlta = (): string => dialogo()?.querySelector('.alerta-alta')?.textContent ?? '';
const textoDialogo = (): string => dialogo()?.textContent ?? '';
const ofreceSobreturno = (): boolean => [...(dialogo()?.querySelectorAll('button') ?? [])].some((b) => b.textContent === 'Agendar como sobreturno');
const estado = (): string => document.querySelector('.anuncio')?.textContent ?? '';
const crearLlamadas = (ctx: TestContext): TurnoCreateRequest[] => ctx.turnos.crear.mock.calls.map((c) => c[0]);
const confirmar = (): void => boton('Confirmar').click();

function escribir(name: string, valor: string): void {
  const campo = el(name);
  campo.value = valor;
  campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

async function elegirPaciente(texto = 'pé', cual = 0): Promise<void> {
  escribir('paciente', texto);
  await tick(300);
  const opciones = [...(dialogo()?.querySelectorAll<HTMLButtonElement>('.resultados-paciente button') ?? [])];
  opciones[cual]?.click();
}

/** Completa el alta con Ana Pérez, Limpieza, Sillón 1, 24/11 a las 10:00. */
async function completarAlta(extra: { hora?: string; notas?: string } = {}): Promise<void> {
  await elegirPaciente();
  escribir('prestacionId', '11');
  escribir('sillonId', '1');
  escribir('fecha', '2026-11-24');
  escribir('hora', extra.hora ?? '10:00');
  if (extra.notas !== undefined) escribir('notas', extra.notas);
}

const COMPLETA = { paciente: 'Pérez, Ana', prestacionId: '11', sillonId: '1', fecha: '2026-11-24', hora: '10:00', notas: 'Control' };

async function abrirYCompletar(rol: Rol = 'ADMIN', datos: DatosAgenda = {}) {
  const m = await montar(rol, datos);
  boton('Nuevo turno').click();
  await completarAlta({ notas: 'Control' });
  return m;
}

describe('5.1 apertura del alta', () => {
  it('"Nuevo turno" abre el diálogo "Nuevo turno" con el foco en el buscador de paciente', async () => {
    await montar();
    boton('Nuevo turno').click();
    const d = dialogo();
    expect(d?.querySelector('h2')?.textContent).toBe('Nuevo turno');
    expect(document.getElementById(d?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Nuevo turno');
    expect(document.activeElement).toBe(el('paciente'));
    expect(['paciente', 'prestacionId', 'sillonId', 'fecha', 'hora', 'notas'].every((n) => d?.querySelector(`[name="${n}"]`) !== null)).toBe(true);
  });

  it('sin precarga: fecha visible, sillón sin elegir y hora vacía; no se envía nada', async () => {
    const { ctx } = await montar();
    boton('Nuevo turno').click();
    expect(valores()).toEqual({ paciente: '', prestacionId: '', sillonId: '', fecha: '2026-11-24', hora: '', notas: '' });
    expect(ctx.turnos.crear).not.toHaveBeenCalled();
  });

  it('las prestaciones y sillones elegibles son los activos, con etiquetas como texto', async () => {
    await montar();
    boton('Nuevo turno').click();
    expect([...(el('prestacionId') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Elegí una prestación', 'Control (15 min)', 'Limpieza (30 min)']);
    expect([...(el('sillonId') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Elegí un sillón', 'Sillón 1', 'Sillón 2']);
  });

  it('Escape cierra el diálogo y el foco vuelve a "Nuevo turno"', async () => {
    await montar();
    const nuevo = boton('Nuevo turno');
    nuevo.focus();
    nuevo.click();
    dialogo()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(dialogo()).toBeNull();
    expect(document.activeElement).toBe(nuevo);
  });

  it('el hueco de las 11:15 del Sillón 2 abre el alta con fecha, hora y sillón elegidos', async () => {
    await montar();
    document.querySelector<HTMLElement>('.grilla-columna[data-clave="sillon-2"] .celda[data-hora="11:15"]')?.click();
    expect(valores()).toMatchObject({ fecha: '2026-11-24', hora: '11:15', sillonId: '2' });
    expect(document.activeElement).toBe(el('paciente'));
  });

  it('el hueco no muestra aviso de hora sugerida (solo la precarga desde un turno enfocado)', async () => {
    await montar(undefined, { turnos: [{ ...TURNO_PROGRAMADO, sillonId: 2 }] });
    document.querySelector<HTMLElement>('.grilla-columna[data-clave="sillon-2"] .celda[data-hora="10:00"]')?.click();
    expect(dialogo()?.querySelector('.aviso-hora')?.textContent ?? '').toBe('');
  });

  it('con el filtro en Sillón 2 y sin turno enfocado, el alta abre con ese sillón', async () => {
    const { ctx } = await montar();
    const filtro = document.querySelector<HTMLSelectElement>('select[name="sillon"]');
    if (filtro !== null) {
      filtro.value = '2';
      filtro.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await tick();
    boton('Nuevo turno').click();
    expect(valores()).toMatchObject({ fecha: '2026-11-24', sillonId: '2', hora: '' });
    expect(ctx.turnos.crear).not.toHaveBeenCalled();
  });
});

describe('5.1 buscador de paciente dentro del alta', () => {
  it('escribir "pér" pide GET /pacientes?q=pér (a través del cliente) y lista Apellido, Nombre — DNI', async () => {
    const { ctx } = await montar();
    boton('Nuevo turno').click();
    escribir('paciente', 'pér');
    await tick(300);
    expect(ctx.pacientes.buscar).toHaveBeenCalledWith({ q: 'pér', size: 10 });
    expect([...(dialogo()?.querySelectorAll('.resultados-paciente button') ?? [])].map((b) => b.textContent)).toEqual([
      'Pérez, Ana — DNI 30111222',
      'Gómez, Luis — DNI 28999111',
    ]);
  });

  it('XSS: un paciente con <img onerror> se ve como texto en las opciones y al elegirlo, sin elementos img', async () => {
    const malicioso: Paciente = { ...PACIENTE_ANA, nombre: XSS_IMG };
    await montar('ADMIN', { pacientes: { contenido: [malicioso], pagina: 0, tamanio: 10, totalElementos: 1, totalPaginas: 1 } });
    boton('Nuevo turno').click();
    await elegirPaciente('pé', 0);
    expect(document.querySelector('img')).toBeNull();
    expect(el('paciente').value).toBe(`Pérez, ${XSS_IMG}`);
  });
});

describe('5.1 alta exitosa', () => {
  it('envía exactamente el cuerpo esperado, cierra, recarga el rango y anuncia "Turno creado."', async () => {
    const { ctx } = await montar();
    ctx.turnos.crear.mockResolvedValue(ALTA_OK);
    const nuevo = boton('Nuevo turno');
    nuevo.focus();
    nuevo.click();
    await completarAlta();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
    confirmar();
    await tick();
    expect(crearLlamadas(ctx)).toEqual([{ pacienteId: 5, prestacionId: 11, sillonId: 1, inicio: '2026-11-24T13:00:00Z' }]);
    expect(dialogo()).toBeNull();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
    expect(estado()).toBe('Turno creado.');
    expect(document.activeElement).toBe(nuevo);
  });

  it('22:30 del consultorio viaja como 01:30Z del día siguiente y las notas recortadas se incluyen', async () => {
    const { ctx } = await montar();
    ctx.turnos.crear.mockResolvedValue(ALTA_OK);
    boton('Nuevo turno').click();
    await completarAlta({ hora: '22:30', notas: '  Urgencia  ' });
    confirmar();
    await tick();
    expect(crearLlamadas(ctx)).toEqual([{ pacienteId: 5, prestacionId: 11, sillonId: 1, inicio: '2026-11-25T01:30:00Z', notas: 'Urgencia' }]);
  });

  it('desde un hueco: el alta del Sillón 2 a las 11:15 envía esos datos y recarga', async () => {
    const { ctx } = await montar();
    ctx.turnos.crear.mockResolvedValue(ALTA_OK);
    document.querySelector<HTMLElement>('.grilla-columna[data-clave="sillon-2"] .celda[data-hora="11:15"]')?.click();
    await elegirPaciente('pé', 1);
    escribir('prestacionId', '10');
    confirmar();
    await tick();
    expect(crearLlamadas(ctx)).toEqual([{ pacienteId: 6, prestacionId: 10, sillonId: 2, inicio: '2026-11-24T14:15:00Z' }]);
    expect(estado()).toBe('Turno creado.');
  });

  it('el alta completa con teclado: Abajo desde el buscador va a las opciones y se elige con un clic nativo', async () => {
    await montar();
    boton('Nuevo turno').click();
    escribir('paciente', 'pé');
    await tick(300);
    el('paciente').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(document.activeElement?.textContent).toBe('Pérez, Ana — DNI 30111222');
    (document.activeElement as HTMLElement).click();
    expect(el('paciente').value).toBe('Pérez, Ana');
  });

  it('el botón se deshabilita mientras envía y el envío doble genera una sola request', async () => {
    const { ctx } = await montar();
    const respuesta = deferred<Turno>();
    ctx.turnos.crear.mockReturnValue(respuesta.promise);
    boton('Nuevo turno').click();
    await completarAlta();
    const confirmarBtn = boton('Confirmar');
    confirmarBtn.click();
    confirmarBtn.click();
    dialogo()?.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    expect(ctx.turnos.crear).toHaveBeenCalledTimes(1);
    expect(confirmarBtn.disabled).toBe(true);
    respuesta.resolve(ALTA_OK);
    await tick();
    expect(ctx.turnos.crear).toHaveBeenCalledTimes(1);
    expect(dialogo()).toBeNull();
  });

  it('una respuesta que llega después de cerrar la página se ignora: no recarga ni anuncia', async () => {
    const { ctx, page } = await montar();
    const respuesta = deferred<Turno>();
    ctx.turnos.crear.mockReturnValue(respuesta.promise);
    boton('Nuevo turno').click();
    await completarAlta();
    confirmar();
    await tick();
    page.dispose?.();
    respuesta.resolve(ALTA_OK);
    await tick();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
    expect(estado()).toBe('');
    expect(dialogo()).toBeNull();
  });

  it('un error que llega después de cerrar el diálogo con Escape se ignora', async () => {
    const { ctx } = await montar();
    const respuesta = deferred<Turno>();
    ctx.turnos.crear.mockReturnValue(respuesta.promise);
    boton('Nuevo turno').click();
    await completarAlta();
    confirmar();
    await tick();
    dialogo()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    respuesta.reject(http(409, PROBLEM_409_CONFLICTO));
    await tick();
    expect(dialogo()).toBeNull();
    expect(document.body.textContent).not.toContain('El sillón ya tiene un turno');
  });
});

describe('5.1 validación sin request', () => {
  it('confirmar sin paciente ni prestación marca los dos campos y no llama a la API', async () => {
    const { ctx } = await montar();
    boton('Nuevo turno').click();
    escribir('sillonId', '1');
    escribir('hora', '10:00');
    confirmar();
    await tick();
    expect(ctx.turnos.crear).not.toHaveBeenCalled();
    const error = (n: string): string => {
      const ids = (el(n).getAttribute('aria-describedby') ?? '').split(' ');
      return ids.map((i) => document.getElementById(i)?.textContent ?? '').join(' ');
    };
    expect(error('paciente')).toContain('Elegí un paciente.');
    expect(error('prestacionId')).toBe('Elegí una prestación.');
    expect(el('sillonId').hasAttribute('aria-invalid')).toBe(false);
    expect(dialogo()).not.toBeNull();
  });

  it('hora vacía y notas de 1001 caracteres marcan sus campos', async () => {
    const { ctx } = await montar();
    boton('Nuevo turno').click();
    await completarAlta({ hora: '', notas: 'a'.repeat(1001) });
    confirmar();
    await tick();
    expect(ctx.turnos.crear).not.toHaveBeenCalled();
    expect(el('hora').getAttribute('aria-invalid')).toBe('true');
    expect(el('notas').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('5.2 rechazos del servidor', () => {
  const rechazos: readonly (readonly [string, () => ApiError, string])[] = [
    ['409 SILLON', () => http(409, PROBLEM_409_CONFLICTO), 'El sillón ya tiene un turno en ese horario.'],
    ['409 PROFESIONAL', () => http(409, { ...PROBLEM_409_CONFLICTO, conflicto: CONFLICTO_PROFESIONAL }), 'El profesional ya tiene un turno en ese horario.'],
    ['422 fuera de agenda', () => http(422, PROBLEM_422_FUERA_DE_AGENDA), 'El horario no está disponible según las reglas de la agenda. Revisá el horario de atención y la grilla.'],
    ['422 bloqueo', () => http(422, PROBLEM_422_BLOQUEO), 'El horario está bloqueado.'],
    ['422 referencia', () => http(422, PROBLEM_422_REFERENCIA), 'Alguno de los datos elegidos ya no existe; actualizá la agenda.'],
    ['422 profesionalId', () => http(422, PROBLEM_422_PROFESIONAL), 'No se pudo asignar el profesional del consultorio. Contactá al administrador.'],
    ['422 sin campos', () => http(422, { title: 'Algo' }), 'No se pudo validar el turno. Revisá los datos e intentá de nuevo.'],
    ['400 con campos', () => http(400, { errores: [{ campo: 'notas', mensaje: 'demasiado larga' }] }), 'Revisá los datos ingresados.'],
    ['409 sin conflicto', () => http(409, PROBLEM_409_GENERICO), 'No se pudo completar la acción. Es posible que el turno haya cambiado.'],
    ['500', () => http(500, { title: 'Error interno' }), 'Ocurrió un error inesperado. Probá de nuevo o recargá la agenda.'],
    ['404', () => http(404), 'Ocurrió un error inesperado. Probá de nuevo o recargá la agenda.'],
    ['403', () => http(403), 'No tenés permiso para realizar esta acción.'],
    ['red caída', () => new ApiError('network'), 'No se pudo conectar con el servidor.'],
  ];

  it.each(rechazos)('%s: mensaje fijo, diálogo abierto, TODOS los datos conservados y sin recarga automática', async (_n, error, mensaje) => {
    const { ctx } = await abrirYCompletar();
    ctx.turnos.crear.mockRejectedValue(error());
    confirmar();
    await tick();
    expect(dialogo()).not.toBeNull();
    expect(alertaAlta()).toContain(mensaje);
    expect(valores()).toEqual(COMPLETA);
    await tick(60_000);
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
    expect(textoDialogo()).not.toContain('Turno en conflicto:  ');
    for (const secreto of ['Algo', 'Error interno', 'Modificación concurrente', 'Turno fuera de agenda', 'Referencia inválida']) {
      expect(document.body.textContent).not.toContain(secreto);
    }
  });

  it('409 SILLON: muestra la hora del turno en conflicto (10:00), asocia el mensaje al campo hora y no ofrece sobreturno', async () => {
    const { ctx } = await abrirYCompletar();
    ctx.turnos.crear.mockRejectedValue(http(409, PROBLEM_409_CONFLICTO));
    confirmar();
    await tick();
    expect(alertaAlta()).toContain('10:00–10:30');
    expect(ofreceSobreturno()).toBe(false);
    expect(el('hora').getAttribute('aria-invalid')).toBe('true');
    const ids = (el('hora').getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids.some((id) => document.getElementById(id)?.classList.contains('alerta-alta') === true)).toBe(true);
  });

  it.each([
    ['409 PROFESIONAL', () => http(409, { ...PROBLEM_409_CONFLICTO, conflicto: CONFLICTO_PROFESIONAL })],
    ['422 fuera de agenda', () => http(422, PROBLEM_422_FUERA_DE_AGENDA)],
    ['422 bloqueo', () => http(422, PROBLEM_422_BLOQUEO)],
  ])('%s ofrece "Agendar como sobreturno" al administrador', async (_n, error) => {
    const { ctx } = await abrirYCompletar();
    ctx.turnos.crear.mockRejectedValue(error());
    confirmar();
    await tick();
    expect(ofreceSobreturno()).toBe(true);
    expect(textoDialogo()).not.toContain('El sobreturno requiere');
  });

  it.each([
    ['409 SILLON', () => http(409, PROBLEM_409_CONFLICTO)],
    ['422 referencia', () => http(422, PROBLEM_422_REFERENCIA)],
    ['422 profesionalId', () => http(422, PROBLEM_422_PROFESIONAL)],
    ['422 sin campos', () => http(422)],
    ['409 sin conflicto', () => http(409, PROBLEM_409_GENERICO)],
  ])('%s no ofrece sobreturno', async (_n, error) => {
    const { ctx } = await abrirYCompletar();
    ctx.turnos.crear.mockRejectedValue(error());
    confirmar();
    await tick();
    expect(ofreceSobreturno()).toBe(false);
  });

  it('422 en profesionalId (DP-1): sin selector de profesional y el cuerpo nunca lo incluyó', async () => {
    const { ctx } = await abrirYCompletar();
    ctx.turnos.crear.mockRejectedValue(http(422, PROBLEM_422_PROFESIONAL));
    confirmar();
    await tick();
    expect(crearLlamadas(ctx)[0]).not.toHaveProperty('profesionalId');
    expect(valores()).toEqual(COMPLETA);
  });

  it('400 con errores por campo: cada mensaje queda en su campo (inicio → hora) y el primero recibe el foco', async () => {
    const { ctx } = await abrirYCompletar();
    ctx.turnos.crear.mockRejectedValue(
      http(400, { errores: [{ campo: 'notas', mensaje: 'demasiado larga' }, { campo: 'inicio', mensaje: 'obligatorio' }, { campo: 'prestacionId', mensaje: 'requerido' }] }),
    );
    confirmar();
    await tick();
    const texto = (n: string): string =>
      (el(n).getAttribute('aria-describedby') ?? '').split(' ').map((i) => document.getElementById(i)?.textContent ?? '').join(' ');
    expect(texto('notas')).toContain('demasiado larga');
    expect(texto('hora')).toContain('obligatorio');
    expect(texto('prestacionId')).toContain('requerido');
    expect(valores()).toEqual(COMPLETA);
  });

  it('409 sin conflicto: "Recargar agenda" manual; sin pulsarlo no hay recarga; al pulsarlo cierra y pide el rango una vez', async () => {
    const { ctx } = await abrirYCompletar();
    ctx.turnos.crear.mockRejectedValue(http(409, PROBLEM_409_GENERICO));
    confirmar();
    await tick();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
    await tick(120_000);
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(1);
    boton('Recargar agenda').click();
    await tick();
    expect(dialogo()).toBeNull();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
  });

  it('los errores que no requieren recarga manual no muestran "Recargar agenda"', async () => {
    const { ctx } = await abrirYCompletar();
    ctx.turnos.crear.mockRejectedValue(http(422, PROBLEM_422_REFERENCIA));
    confirmar();
    await tick();
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Recargar agenda')).toBe(false);
  });

  it('tras un rechazo se puede corregir y reintentar: el segundo envío usa el dato corregido', async () => {
    const { ctx } = await abrirYCompletar();
    ctx.turnos.crear.mockRejectedValueOnce(http(409, PROBLEM_409_CONFLICTO)).mockResolvedValueOnce(ALTA_OK);
    confirmar();
    await tick();
    escribir('hora', '11:00');
    confirmar();
    await tick();
    expect(crearLlamadas(ctx).map((c) => c.inicio)).toEqual(['2026-11-24T13:00:00Z', '2026-11-24T14:00:00Z']);
    expect(dialogo()).toBeNull();
  });

  it('un mensaje de rechazo se limpia al reintentar', async () => {
    const { ctx } = await abrirYCompletar();
    const respuesta = deferred<Turno>();
    ctx.turnos.crear.mockRejectedValueOnce(http(409, PROBLEM_409_CONFLICTO)).mockReturnValueOnce(respuesta.promise);
    confirmar();
    await tick();
    expect(alertaAlta()).not.toBe('');
    confirmar();
    await tick();
    expect(alertaAlta()).toBe('');
    expect(el('hora').hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('5.3 sobreturno con confirmación explícita', () => {
  const fueraDeAgenda = () => http(422, PROBLEM_422_FUERA_DE_AGENDA);
  const profesional = () => http(409, { ...PROBLEM_409_CONFLICTO, conflicto: CONFLICTO_PROFESIONAL });

  async function hastaOferta(error: () => ApiError = profesional, rol: Rol = 'ADMIN') {
    const m = await abrirYCompletar(rol);
    m.ctx.turnos.crear.mockRejectedValueOnce(error());
    confirmar();
    await tick();
    return m;
  }

  it('elegir "Agendar como sobreturno" pide confirmación (foco en "Confirmar sobreturno") y todavía no envía nada', async () => {
    const { ctx } = await hastaOferta();
    boton('Agendar como sobreturno').click();
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Confirmar sobreturno');
    expect(textoDialogo()).toContain('Se registrará como sobreturno, fuera de las reglas habituales de la agenda. ¿Confirmás?');
    expect(document.activeElement).toBe(boton('Confirmar sobreturno'));
    expect(ctx.turnos.crear).toHaveBeenCalledTimes(1);
    expect(crearLlamadas(ctx).some((c) => c.sobreturno === true)).toBe(false);
  });

  it('confirmar reenvía el mismo cuerpo con sobreturno: true; éxito cierra, recarga y anuncia', async () => {
    const { ctx } = await hastaOferta();
    ctx.turnos.crear.mockResolvedValueOnce({ ...ALTA_OK, sobreturno: true });
    boton('Agendar como sobreturno').click();
    boton('Confirmar sobreturno').click();
    await tick();
    const [primero, segundo] = crearLlamadas(ctx);
    expect(segundo).toEqual({ ...primero, sobreturno: true });
    expect(dialogo()).toBeNull();
    expect(ctx.turnos.listar).toHaveBeenCalledTimes(2);
    expect(estado()).toBe('Turno creado.');
  });

  it('también tras fuera de agenda (422 en el inicio)', async () => {
    const { ctx } = await hastaOferta(fueraDeAgenda);
    ctx.turnos.crear.mockResolvedValueOnce(ALTA_OK);
    boton('Agendar como sobreturno').click();
    boton('Confirmar sobreturno').click();
    await tick();
    expect(crearLlamadas(ctx)[1]).toEqual({ pacienteId: 5, prestacionId: 11, sillonId: 1, inicio: '2026-11-24T13:00:00Z', notas: 'Control', sobreturno: true });
  });

  it('"Volver" regresa al formulario con los datos intactos y sin enviar nada', async () => {
    const { ctx } = await hastaOferta();
    boton('Agendar como sobreturno').click();
    boton('Volver').click();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Nuevo turno');
    expect(valores()).toEqual(COMPLETA);
    expect(ctx.turnos.crear).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
  });

  it('después de "Volver" se puede volver a elegir el sobreturno', async () => {
    const { ctx } = await hastaOferta();
    boton('Agendar como sobreturno').click();
    boton('Volver').click();
    expect(ofreceSobreturno()).toBe(true);
    ctx.turnos.crear.mockResolvedValueOnce(ALTA_OK);
    boton('Agendar como sobreturno').click();
    boton('Confirmar sobreturno').click();
    await tick();
    expect(crearLlamadas(ctx)[1]?.sobreturno).toBe(true);
  });

  it('si el reintento falla con 409 SILLON se muestra su mensaje y no se vuelve a ofrecer el sobreturno', async () => {
    const { ctx } = await hastaOferta();
    ctx.turnos.crear.mockRejectedValueOnce(http(409, PROBLEM_409_CONFLICTO));
    boton('Agendar como sobreturno').click();
    boton('Confirmar sobreturno').click();
    await tick();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Nuevo turno');
    expect(alertaAlta()).toContain('El sillón ya tiene un turno en ese horario.');
    expect(ofreceSobreturno()).toBe(false);
    expect(valores()).toEqual(COMPLETA);
    expect(ctx.turnos.crear).toHaveBeenCalledTimes(2);
  });

  it('si el reintento falla de nuevo por profesional, tampoco se vuelve a ofrecer (solo tras una operación nueva)', async () => {
    const { ctx } = await hastaOferta();
    ctx.turnos.crear.mockRejectedValueOnce(profesional());
    boton('Agendar como sobreturno').click();
    boton('Confirmar sobreturno').click();
    await tick();
    expect(ofreceSobreturno()).toBe(false);
    // Una operación nueva (envío normal) sí puede volver a ofrecerlo.
    ctx.turnos.crear.mockRejectedValueOnce(profesional());
    confirmar();
    await tick();
    expect(ofreceSobreturno()).toBe(true);
  });

  it('el botón de confirmación se deshabilita mientras envía (sin envío doble)', async () => {
    const { ctx } = await hastaOferta();
    const respuesta = deferred<Turno>();
    ctx.turnos.crear.mockReturnValueOnce(respuesta.promise);
    boton('Agendar como sobreturno').click();
    const confirmarSobreturno = boton('Confirmar sobreturno');
    confirmarSobreturno.click();
    confirmarSobreturno.click();
    await tick();
    expect(ctx.turnos.crear).toHaveBeenCalledTimes(2);
    expect(confirmarSobreturno.disabled).toBe(true);
    respuesta.resolve(ALTA_OK);
    await tick();
    expect(dialogo()).toBeNull();
  });

  it('ninguna request lleva sobreturno: true sin confirmación, en todo el recorrido del alta', async () => {
    const { ctx } = await hastaOferta();
    boton('Agendar como sobreturno').click();
    boton('Volver').click();
    escribir('hora', '11:00');
    ctx.turnos.crear.mockRejectedValueOnce(profesional());
    confirmar();
    await tick();
    expect(crearLlamadas(ctx).every((c) => c.sobreturno === undefined)).toBe(true);
  });

  it('Escape durante la confirmación cierra el diálogo sin enviar y devuelve el foco', async () => {
    const { ctx } = await hastaOferta();
    boton('Agendar como sobreturno').click();
    dialogo()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(dialogo()).toBeNull();
    expect(ctx.turnos.crear).toHaveBeenCalledTimes(1);
  });
});

describe('5.4 sobreturno según el rol (DP-2)', () => {
  const profesional = () => http(409, { ...PROBLEM_409_CONFLICTO, conflicto: CONFLICTO_PROFESIONAL });

  it('RECEPCION con 409 PROFESIONAL: mensaje normal + aviso de rol, sin botón y sin request con sobreturno', async () => {
    const { ctx } = await abrirYCompletar('RECEPCION');
    ctx.turnos.crear.mockRejectedValue(profesional());
    confirmar();
    await tick();
    expect(alertaAlta()).toContain('El profesional ya tiene un turno en ese horario.');
    expect(alertaAlta()).toContain('El sobreturno requiere un usuario profesional o administrador.');
    expect(ofreceSobreturno()).toBe(false);
    expect(crearLlamadas(ctx).every((c) => c.sobreturno === undefined)).toBe(true);
  });

  it.each([
    ['422 fuera de agenda', () => http(422, PROBLEM_422_FUERA_DE_AGENDA), 'El horario no está disponible según las reglas de la agenda. Revisá el horario de atención y la grilla.'],
    ['422 bloqueo', () => http(422, PROBLEM_422_BLOQUEO), 'El horario está bloqueado.'],
  ])('RECEPCION con %s: mensaje normal + aviso de rol y sin ofrecimiento', async (_n, error, mensaje) => {
    const { ctx } = await abrirYCompletar('RECEPCION');
    ctx.turnos.crear.mockRejectedValue(error());
    confirmar();
    await tick();
    expect(alertaAlta()).toContain(mensaje);
    expect(alertaAlta()).toContain('El sobreturno requiere un usuario profesional o administrador.');
    expect(ofreceSobreturno()).toBe(false);
  });

  it('RECEPCION con 409 SILLON: sin ofrecimiento y sin aviso de rol (nunca fue posible)', async () => {
    const { ctx } = await abrirYCompletar('RECEPCION');
    ctx.turnos.crear.mockRejectedValue(http(409, PROBLEM_409_CONFLICTO));
    confirmar();
    await tick();
    expect(alertaAlta()).not.toContain('El sobreturno requiere');
  });

  it.each(['ADMIN', 'PROFESIONAL'] as const)('%s recibe el ofrecimiento y no ve el aviso de rol', async (rol) => {
    const { ctx } = await abrirYCompletar(rol);
    ctx.turnos.crear.mockRejectedValue(profesional());
    confirmar();
    await tick();
    expect(ofreceSobreturno()).toBe(true);
    expect(alertaAlta()).not.toContain('El sobreturno requiere');
  });
});

describe('5.1.c precarga desde el turno enfocado (página real)', () => {
  const T_10_S2: Turno = { ...TURNO_PROGRAMADO, id: 10, sillonId: 2 }; // 10:00–10:30 del Sillón 2
  const T_15_S2: Turno = { ...TURNO_PROGRAMADO, id: 11, sillonId: 2, inicio: '2026-11-24T18:00:00Z', fin: '2026-11-24T18:30:00Z' };

  it('con el foco en el bloque de 10:00–10:30 del Sillón 2: fecha 24/11, hora 10:30 y Sillón 2, editables y sin enviar', async () => {
    const { ctx } = await montar('ADMIN', { turnos: [T_10_S2] });
    bloqueDe(10).focus();
    boton('Nuevo turno').click();
    expect(valores()).toMatchObject({ fecha: '2026-11-24', hora: '10:30', sillonId: '2' });
    expect(ctx.turnos.crear).not.toHaveBeenCalled();
    escribir('hora', '12:00');
    expect(el('hora').value).toBe('12:00');
  });

  it('con el foco en un ítem de la lista también precarga', async () => {
    await montar('ADMIN', { turnos: [T_10_S2] });
    document.querySelector<HTMLButtonElement>('.lista-turnos button')?.focus();
    boton('Nuevo turno').click();
    expect(valores()).toMatchObject({ fecha: '2026-11-24', hora: '10:30', sillonId: '2' });
  });

  it('una parada inicial de Tab que el usuario nunca enfocó no cuenta como turno enfocado', async () => {
    await montar('ADMIN', { turnos: [T_10_S2] });
    boton('Nuevo turno').click();
    expect(valores()).toMatchObject({ hora: '', sillonId: '' });
  });

  it('turno que termina a medianoche: fecha 25/11, hora 00:00 y su sillón', async () => {
    const t: Turno = { ...TURNO_PROGRAMADO, id: 12, sillonId: 1, inicio: '2026-11-25T02:30:00Z', fin: '2026-11-25T03:00:00Z' };
    await montar('ADMIN', { turnos: [t] });
    bloqueDe(12).focus();
    boton('Nuevo turno').click();
    expect(valores()).toMatchObject({ fecha: '2026-11-25', hora: '00:00', sillonId: '1' });
  });

  it('contexto cambiado: tras "Siguiente" la precarga es la fecha nueva, sin datos del turno anterior', async () => {
    const { ctx } = await montar('ADMIN', { turnos: [T_10_S2] });
    bloqueDe(10).focus();
    ctx.turnos.listar.mockResolvedValue([]);
    boton('Siguiente').click();
    await tick();
    boton('Nuevo turno').click();
    expect(valores()).toMatchObject({ fecha: '2026-11-25', hora: '', sillonId: '' });
  });

  it.each([
    ['el filtro de sillón', () => {
      const f = document.querySelector<HTMLSelectElement>('select[name="sillon"]');
      if (f !== null) {
        f.value = '1';
        f.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }],
    ['"Mostrar cancelados"', () => document.querySelector<HTMLInputElement>('input[name="cancelados"]')?.click()],
    ['la vista semanal', () => boton('Semana').click()],
  ])('cambiar %s invalida la precarga', async (_n, cambio) => {
    await montar('ADMIN', { turnos: [T_10_S2] });
    bloqueDe(10).focus();
    cambio();
    await tick();
    boton('Nuevo turno').click();
    expect(valores().hora).toBe('');
  });

  it('cerrar descarta todo: se enfoca otro turno de 15:00 a 15:30 y la hora precargada es 15:30', async () => {
    await montar('ADMIN', { turnos: [T_10_S2, T_15_S2] });
    bloqueDe(10).focus();
    boton('Nuevo turno').click();
    escribir('hora', '12:00');
    dialogo()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    bloqueDe(11).focus();
    boton('Nuevo turno').click();
    expect(valores().hora).toBe('15:30');
  });

  it('hueco sin cambios: con el foco previo en un turno, el clic en el hueco de las 11:15 usa ese hueco', async () => {
    await montar('ADMIN', { turnos: [T_10_S2] });
    bloqueDe(10).focus();
    document.querySelector<HTMLElement>('.grilla-columna[data-clave="sillon-2"] .celda[data-hora="11:15"]')?.click();
    expect(valores()).toMatchObject({ hora: '11:15', sillonId: '2' });
  });

  it('con DP-1 activo (dos profesionales) no se abre el alta aunque haya un turno enfocado', async () => {
    const dos = [
      { id: 1, profesionalId: 7, diaSemana: 2 as const, horaDesde: '09:00', horaHasta: '18:00' },
      { id: 2, profesionalId: 8, diaSemana: 2 as const, horaDesde: '09:00', horaHasta: '18:00' },
    ];
    await montar('ADMIN', { turnos: [T_10_S2], horarios: dos });
    bloqueDe(10).focus();
    boton('Nuevo turno').click();
    expect(dialogo()).toBeNull();
  });

  describe('aviso no bloqueante de la hora sugerida', () => {
    const OCUPANTE: Turno = { ...TURNO_PROGRAMADO, id: 20, sillonId: 2, inicio: '2026-11-24T13:30:00Z', fin: '2026-11-24T14:00:00Z' }; // 10:30–11:00
    const avisoEl = (): HTMLElement | null => dialogo()?.querySelector('.aviso-hora') ?? null;
    const describedPorAviso = (): boolean => {
      const a = avisoEl();
      return a !== null && (el('hora').getAttribute('aria-describedby') ?? '').split(' ').includes(a.id);
    };

    it('hora ocupada con prestación de 30 min: texto exacto junto a la hora, por aria-describedby, sin role=alert y "Confirmar" habilitado', async () => {
      await montar('ADMIN', { turnos: [T_10_S2, OCUPANTE] });
      bloqueDe(10).focus();
      boton('Nuevo turno').click();
      escribir('prestacionId', '11');
      expect(avisoEl()?.textContent).toBe('La hora sugerida se superpone con otro turno de este sillón (10:30–11:00). Podés cambiarla.');
      expect(describedPorAviso()).toBe(true);
      expect(avisoEl()?.hasAttribute('role')).toBe(false);
      expect(avisoEl()?.closest('[role="alert"]')).toBeNull();
      expect(boton('Confirmar').disabled).toBe(false);
    });

    it('sin prestación elegida no hay aviso de superposición cuando ningún turno contiene la hora', async () => {
      const posterior: Turno = { ...TURNO_PROGRAMADO, id: 21, sillonId: 2, inicio: '2026-11-24T13:45:00Z', fin: '2026-11-24T14:15:00Z' };
      await montar('ADMIN', { turnos: [T_10_S2, posterior] });
      bloqueDe(10).focus();
      boton('Nuevo turno').click();
      expect(avisoEl()?.textContent ?? '').toBe('');
      expect(describedPorAviso()).toBe(false);
    });

    it('el aviso se actualiza al editar: cambiar la hora a una libre lo quita y la hora deja de referenciarlo', async () => {
      await montar('ADMIN', { turnos: [T_10_S2, OCUPANTE] });
      bloqueDe(10).focus();
      boton('Nuevo turno').click();
      escribir('prestacionId', '11');
      expect(describedPorAviso()).toBe(true);
      escribir('hora', '12:00');
      expect(avisoEl()?.textContent ?? '').toBe('');
      expect(el('hora').hasAttribute('aria-describedby')).toBe(false);
    });

    it('recalcula al editar la fecha, el sillón y la prestación', async () => {
      await montar('ADMIN', { turnos: [T_10_S2, OCUPANTE] });
      bloqueDe(10).focus();
      boton('Nuevo turno').click();
      escribir('prestacionId', '11');
      escribir('sillonId', '1');
      expect(avisoEl()?.textContent ?? '').not.toContain('se superpone');
      escribir('sillonId', '2');
      expect(avisoEl()?.textContent).toContain('se superpone');
      escribir('fecha', '2026-11-29');
      // El domingo no tiene horario de atención y no hay datos cargados de ese día: no se inventa ocupación.
      expect(avisoEl()?.textContent).toBe('La hora sugerida está fuera del horario de atención. Podés cambiarla.');
    });

    it('fuera de horario: la hora sugerida 18:00 cuando el horario termina a las 18:00', async () => {
      const t: Turno = { ...TURNO_PROGRAMADO, id: 22, sillonId: 2, inicio: '2026-11-24T20:30:00Z', fin: '2026-11-24T21:00:00Z' }; // 17:30–18:00
      await montar('ADMIN', { turnos: [t] });
      bloqueDe(22).focus();
      boton('Nuevo turno').click();
      expect(el('hora').value).toBe('18:00');
      expect(avisoEl()?.textContent).toBe('La hora sugerida está fuera del horario de atención. Podés cambiarla.');
    });

    it('bloqueo del Sillón 2 de 12:00 a 13:00 con hora sugerida 12:00', async () => {
      const t: Turno = { ...TURNO_PROGRAMADO, id: 23, sillonId: 2, inicio: '2026-11-24T14:30:00Z', fin: '2026-11-24T15:00:00Z' }; // 11:30–12:00
      const bloqueo = { ...BLOQUEO_SILLON, sillonId: 2, inicio: '2026-11-24T15:00:00Z', fin: '2026-11-24T16:00:00Z' };
      await montar('ADMIN', { turnos: [t], bloqueos: [bloqueo] });
      bloqueDe(23).focus();
      boton('Nuevo turno').click();
      expect(el('hora').value).toBe('12:00');
      expect(avisoEl()?.textContent).toBe('La hora sugerida cae en un bloqueo de la agenda. Podés cambiarla.');
    });

    it('sobreturno de 09:10 a 09:20: la hora sugerida es 09:20 y se avisa que está fuera de la grilla', async () => {
      const t: Turno = { ...TURNO_PROGRAMADO, id: 24, sobreturno: true, sillonId: 2, inicio: '2026-11-24T12:10:00Z', fin: '2026-11-24T12:20:00Z' };
      await montar('ADMIN', { turnos: [t] });
      bloqueDe(24).focus();
      boton('Nuevo turno').click();
      expect(el('hora').value).toBe('09:20');
      expect(avisoEl()?.textContent).toBe('La hora sugerida no está alineada a la grilla de la agenda. Podés cambiarla.');
    });

    it('el servidor decide: sin aviso, un 409 SILLON se muestra como en 5.2 y queda asociado al campo hora', async () => {
      const { ctx } = await montar('ADMIN', { turnos: [T_10_S2] });
      bloqueDe(10).focus();
      boton('Nuevo turno').click();
      await elegirPaciente();
      escribir('prestacionId', '10');
      expect(avisoEl()?.textContent ?? '').toBe('');
      ctx.turnos.crear.mockRejectedValue(http(409, PROBLEM_409_CONFLICTO));
      confirmar();
      await tick();
      expect(alertaAlta()).toContain('El sillón ya tiene un turno en ese horario.');
      expect(el('hora').getAttribute('aria-invalid')).toBe('true');
    });

    it('con aviso y todo completo, "Confirmar" envía igual (el aviso no bloquea)', async () => {
      const { ctx } = await montar('ADMIN', { turnos: [T_10_S2, OCUPANTE] });
      ctx.turnos.crear.mockResolvedValue(ALTA_OK);
      bloqueDe(10).focus();
      boton('Nuevo turno').click();
      await elegirPaciente();
      escribir('prestacionId', '11');
      expect(describedPorAviso()).toBe(true);
      confirmar();
      await tick();
      expect(crearLlamadas(ctx)).toHaveLength(1);
      expect(crearLlamadas(ctx)[0]).toMatchObject({ sillonId: 2, inicio: '2026-11-24T13:30:00Z' });
    });

    it('una hora inválida (vacía) muestra el aviso "no son válidas" y no bloquea', async () => {
      await montar('ADMIN', { turnos: [T_10_S2] });
      bloqueDe(10).focus();
      boton('Nuevo turno').click();
      escribir('hora', '');
      expect(avisoEl()?.textContent).toBe('La fecha o la hora no son válidas. Podés cambiarla.');
    });

    it('cuando el rango cargado no cubre el sillón elegido (filtro en Sillón 1) no se inventa ocupación', async () => {
      const { ctx } = await montar('ADMIN', { turnos: [T_10_S2] });
      ctx.turnos.listar.mockResolvedValue([{ ...TURNO_PROGRAMADO, id: 30, sillonId: 1, inicio: '2026-11-24T12:00:00Z', fin: '2026-11-24T12:30:00Z' }]);
      const f = document.querySelector<HTMLSelectElement>('select[name="sillon"]');
      if (f !== null) {
        f.value = '1';
        f.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await tick();
      bloqueDe(30).focus();
      boton('Nuevo turno').click();
      escribir('prestacionId', '11');
      escribir('sillonId', '2');
      // El Sillón 2 no se cargó (filtro en el 1): nunca se avisa de una superposición que no se puede ver.
      expect(avisoEl()?.textContent ?? '').not.toContain('se superpone');
    });
  });
});

describe('contenido seguro en el flujo del alta', () => {
  it('turno con nombre malicioso en la grilla, notas en el alta y nombres en el buscador: sin img ni script nuevos', async () => {
    const t: Turno = { ...TURNO_PROGRAMADO, id: 40, paciente: { id: 9, nombre: XSS_IMG, apellido: PACIENTE_MINIMO.apellido } };
    await montar('ADMIN', { turnos: [t] });
    boton('Nuevo turno').click();
    escribir('notas', '<script>alert(1)</script>');
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('.grilla')?.textContent).toContain(XSS_IMG);
  });
});

describe('diálogo del alta: foco y recargas', () => {
  it('el foco queda atrapado: Tab desde "Cerrar" vuelve al buscador y Shift+Tab desde el buscador va a "Cerrar"', async () => {
    await montar();
    boton('Nuevo turno').click();
    const cerrar = [...(dialogo()?.querySelectorAll('button') ?? [])].at(-1) as HTMLElement;
    expect(cerrar.textContent).toBe('Cerrar');
    cerrar.focus();
    cerrar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(el('paciente'));
    el('paciente').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(cerrar);
  });

  it('después de crear un turno la recarga borra la referencia al turno enfocado (sin precarga obsoleta)', async () => {
    const T: Turno = { ...TURNO_PROGRAMADO, id: 10, sillonId: 2 };
    const { ctx } = await montar('ADMIN', { turnos: [T] });
    ctx.turnos.crear.mockResolvedValue(ALTA_OK);
    bloqueDe(10).focus();
    boton('Nuevo turno').click();
    await elegirPaciente();
    escribir('prestacionId', '11');
    escribir('sillonId', '2');
    confirmar();
    await tick();
    boton('Nuevo turno').click();
    expect(valores()).toMatchObject({ fecha: '2026-11-24', hora: '', sillonId: '' });
  });

  it('un diálogo ya abierto no se duplica al activar "Nuevo turno" de nuevo', async () => {
    await montar();
    boton('Nuevo turno').click();
    boton('Nuevo turno').click();
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
  });
});
