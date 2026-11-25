/** Higiene de datos clínicos en el navegador (C-12b, tasks 5.8; design D8). */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { CONSENTIMIENTO_V1, FICHA_V3, NOTA_1, TEXTO_V1 } from '../../api/__fixtures__/ficha';
import { PACIENTE_ANA, PACIENTE_INACTIVO, pagina } from '../../api/__fixtures__/pacientesAbm';
import { ApiError } from '../../api/errors';
import type { Consentimiento, Ficha, Nota, Paciente, Pagina, TextoConsentimiento } from '../../api/types';
import { SESSION_KEY } from '../../state/session';
import { casilla, contextoFicha, enviar, montarFicha, seccion, textarea, type Escenario, type Montada } from '../../test-support/ficha';
import { buttons, deferred, flush } from '../../test-support/pages';
import { TITULO_FICHA } from './mensajes';

/** Datos clínicos y personales de las fixtures que nunca deben salir de la página. */
const SENSIBLES = ['Penicilina', 'Hipertensión', 'Ibuprofeno', 'Control de rutina', 'Pérez', '30111222', 'Autorizo el tratamiento'];

let actual: Montada | null = null;
let espias: MockInstance[] = [];

beforeEach(() => {
  localStorage.clear();
  espias = (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
});

afterEach(() => {
  actual?.page.dispose?.();
  actual = null;
  for (const e of espias) e.mockRestore();
  document.body.replaceChildren();
  sessionStorage.clear();
});

async function montar(...args: Parameters<typeof montarFicha>): Promise<Montada> {
  actual = await montarFicha(...args);
  return actual;
}

/** Recorrido completo: registra consentimiento, guarda la ficha (con un 409 en el medio), agrega una nota y pide más. */
async function recorridoCompleto(): Promise<Montada> {
  const ctx = contextoFicha({ consentimientos: [] });
  ctx.ficha.registrarConsentimiento.mockResolvedValue(CONSENTIMIENTO_V1);
  ctx.ficha.listarNotas
    .mockResolvedValueOnce(pagina([NOTA_1], { totalPaginas: 2 }))
    .mockResolvedValueOnce(pagina([{ ...NOTA_1, id: 70 }], { pagina: 1, totalPaginas: 2 }));
  ctx.ficha.guardarFicha
    .mockRejectedValueOnce(new ApiError('conflict', { status: 409, codigo: 'FICHA_DESACTUALIZADA', title: 'Penicilina' }))
    .mockResolvedValueOnce({ ...FICHA_V3, version: 4 });
  ctx.ficha.crearNota
    .mockRejectedValueOnce(new ApiError('validation', { status: 422, codigo: 'PROFESIONAL_NO_VINCULADO' }))
    .mockResolvedValueOnce({ ...NOTA_1, id: 71, texto: 'Nueva nota de prueba' });
  const m = await montar({ consentimientos: [] }, ctx);
  casilla(m.root).click();
  enviar(casilla(m.root).closest('form'));
  await flush();
  textarea(m.root, 'alergias').value = 'Penicilina, látex';
  enviar(seccion(m.root, 'Anamnesis')?.querySelector('form') ?? null);
  await flush();
  enviar(seccion(m.root, 'Anamnesis')?.querySelector('form') ?? null);
  await flush();
  textarea(m.root, 'texto').value = 'Nueva nota de prueba';
  enviar(seccion(m.root, 'Notas clínicas')?.querySelector('form') ?? null);
  await flush();
  enviar(seccion(m.root, 'Notas clínicas')?.querySelector('form') ?? null);
  await flush();
  buttons(m.root, 'Ver más')[0]?.click();
  await flush();
  return m;
}

describe('título fijo', () => {
  const ESCENARIOS: [string, Escenario][] = [
    ['con consentimiento', {}],
    ['sin consentimiento', { consentimientos: [] }],
    ['dado de baja', { paciente: PACIENTE_INACTIVO }],
  ];

  it.each(ESCENARIOS)('%s: el título y el h1 son "Ficha clínica", sin datos del paciente', async (_caso, escenario) => {
    const { page, root } = await montar(escenario);
    expect(page.title).toBe(TITULO_FICHA);
    expect(root.querySelector('h1')?.textContent).toBe(TITULO_FICHA);
    for (const dato of SENSIBLES) expect(page.title).not.toContain(dato);
  });

  it('el título no cambia a lo largo del recorrido completo', async () => {
    const { page } = await recorridoCompleto();
    expect(page.title).toBe(TITULO_FICHA);
  });
});

describe('nada en el almacenamiento del navegador', () => {
  it('tras el recorrido completo, localStorage está vacío y sessionStorage solo tiene la sesión de C-10', async () => {
    const { root } = await recorridoCompleto();
    expect(seccion(root, 'Notas clínicas')?.querySelectorAll('li.nota').length).toBeGreaterThan(1);
    expect(localStorage.length).toBe(0);
    const claves = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i));
    expect(claves).toEqual([SESSION_KEY]);
    const sesion = sessionStorage.getItem(SESSION_KEY) ?? '';
    for (const dato of [...SENSIBLES, 'látex', 'Nueva nota de prueba']) expect(sesion).not.toContain(dato);
  });

  it('no se usa flash ni la URL para datos clínicos', async () => {
    const antes = window.location.href;
    const { ctx } = await recorridoCompleto();
    expect(window.location.href).toBe(antes);
    expect(ctx.flash.consume()).toBeNull();
  });
});

describe('sin console', () => {
  it('el recorrido completo, con 409 y 422 en el medio, no escribe en la consola', async () => {
    await recorridoCompleto();
    for (const e of espias) expect(e).not.toHaveBeenCalled();
  });

  it('los errores de carga (red, 500, 404) tampoco escriben en la consola', async () => {
    for (const error of [new ApiError('network'), new ApiError('server', { status: 500 }), new ApiError('unexpected', { status: 404 })]) {
      const ctx = contextoFicha();
      ctx.ficha.obtenerFicha.mockRejectedValue(error);
      const m = await montarFicha({}, ctx);
      m.page.dispose?.();
    }
    for (const e of espias) expect(e).not.toHaveBeenCalled();
  });
});

describe('respuestas tardías descartadas después de salir', () => {
  async function salirAntesDe<T>(configurar: (ctx: ReturnType<typeof contextoFicha>, d: ReturnType<typeof deferred<T>>) => void, valor: T, e = {}) {
    const ctx = contextoFicha(e);
    const d = deferred<T>();
    configurar(ctx, d);
    const page = (await import('./ficha')).renderFicha(ctx, { id: 7 });
    document.body.append(page.element);
    await flush();
    return { ctx, page, d, valor };
  }

  it('el paciente y los consentimientos llegan después de salir: no se pinta nada ni se pide más', async () => {
    const { ctx, page, d } = await salirAntesDe<Paciente>((c, def) => c.pacientes.obtener.mockReturnValue(def.promise), PACIENTE_ANA);
    page.dispose?.();
    d.resolve(PACIENTE_ANA);
    await flush();
    expect(page.element.textContent).not.toContain('Pérez');
    expect(ctx.ficha.obtenerFicha).not.toHaveBeenCalled();
    expect(ctx.ficha.textoVigente).not.toHaveBeenCalled();
  });

  it('el texto vigente llega después de salir: no se pinta', async () => {
    const { page, d } = await salirAntesDe<TextoConsentimiento>(
      (c, def) => c.ficha.textoVigente.mockReturnValue(def.promise),
      TEXTO_V1,
      { consentimientos: [] },
    );
    page.dispose?.();
    d.resolve(TEXTO_V1);
    await flush();
    expect(page.element.textContent).not.toContain('Autorizo');
  });

  it('el registro del consentimiento termina después de salir: no se pide la ficha', async () => {
    const ctx = contextoFicha({ consentimientos: [] });
    const d = deferred<Consentimiento>();
    ctx.ficha.registrarConsentimiento.mockReturnValue(d.promise);
    const m = await montarFicha({ consentimientos: [] }, ctx);
    casilla(m.root).click();
    enviar(casilla(m.root).closest('form'));
    m.page.dispose?.();
    d.resolve(CONSENTIMIENTO_V1);
    await flush();
    expect(ctx.ficha.obtenerFicha).not.toHaveBeenCalled();
    expect(m.root.textContent).not.toContain('Consentimiento registrado el');
  });

  it('la ficha y las notas llegan después de salir: no se pintan', async () => {
    const { page, d } = await salirAntesDe<Ficha>((c, def) => c.ficha.obtenerFicha.mockReturnValue(def.promise), FICHA_V3);
    page.dispose?.();
    d.resolve(FICHA_V3);
    await flush();
    expect(seccion(page.element, 'Anamnesis')).toBeNull();
    expect(page.element.textContent).not.toContain('Penicilina');
  });

  it('una nota creada que se confirma después de salir no se pinta', async () => {
    const ctx = contextoFicha();
    const d = deferred<Nota>();
    ctx.ficha.crearNota.mockReturnValue(d.promise);
    const m = await montarFicha({}, ctx);
    textarea(m.root, 'texto').value = 'Tardía';
    enviar(seccion(m.root, 'Notas clínicas')?.querySelector('form') ?? null);
    m.page.dispose?.();
    d.resolve({ ...NOTA_1, id: 99, texto: 'Tardía' });
    await flush();
    expect(m.root.textContent).not.toContain('Tardía');
  });

  it('"Ver más" que llega después de salir no se pinta', async () => {
    const ctx = contextoFicha();
    const d = deferred<Pagina<Nota>>();
    ctx.ficha.listarNotas.mockResolvedValueOnce(pagina([NOTA_1], { totalPaginas: 2 })).mockReturnValueOnce(d.promise);
    const m = await montarFicha({}, ctx);
    buttons(m.root, 'Ver más')[0]?.click();
    m.page.dispose?.();
    d.resolve(pagina([{ ...NOTA_1, id: 98, texto: 'Página tardía' }], { pagina: 1, totalPaginas: 2 }));
    await flush();
    expect(m.root.textContent).not.toContain('Página tardía');
  });
});
