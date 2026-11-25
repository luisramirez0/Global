/** Utilidades de test para la página de ficha clínica (C-12b; solo se importan desde *.test.ts). */
import { CONSENTIMIENTO_V1, FICHA_V3, NOTA_1, NOTA_2, TEXTO_V1 } from '../api/__fixtures__/ficha';
import { PACIENTE_ANA, pagina } from '../api/__fixtures__/pacientes';
import type { Consentimiento, Ficha, Nota, Paciente, Pagina, Rol, TextoConsentimiento } from '../api/types';
import { renderFicha } from '../pages/ficha/ficha';
import type { Page } from '../router/router';
import { createLoggedContext, flush, type TestContext } from './pages';

export interface Escenario {
  rol?: Rol;
  paciente?: Paciente;
  consentimientos?: Consentimiento[];
  texto?: TextoConsentimiento;
  ficha?: Ficha;
  notas?: Pagina<Nota>;
}

export interface Montada {
  ctx: TestContext;
  page: Page;
  root: HTMLElement;
}

/** Contexto con la API de ficha y pacientes ya respondiendo según el escenario (por defecto: Ana con consentimiento). */
export function contextoFicha(e: Escenario = {}): TestContext {
  const ctx = createLoggedContext(e.rol ?? 'PROFESIONAL');
  ctx.pacientes.obtener.mockResolvedValue(e.paciente ?? PACIENTE_ANA);
  ctx.ficha.listarConsentimientos.mockResolvedValue(e.consentimientos ?? [CONSENTIMIENTO_V1]);
  ctx.ficha.textoVigente.mockResolvedValue(e.texto ?? TEXTO_V1);
  ctx.ficha.obtenerFicha.mockResolvedValue(e.ficha ?? FICHA_V3);
  ctx.ficha.listarNotas.mockResolvedValue(e.notas ?? pagina([NOTA_1, NOTA_2]));
  return ctx;
}

export async function montarFicha(e: Escenario = {}, ctx: TestContext = contextoFicha(e)): Promise<Montada> {
  const page = renderFicha(ctx, { id: (e.paciente ?? PACIENTE_ANA).id });
  document.body.append(page.element);
  await flush();
  return { ctx, page, root: page.element };
}

/** Sección por su título `h2` (p. ej. "Anamnesis", "Notas clínicas"); `null` si no existe en el DOM. */
export function seccion(root: ParentNode, titulo: string): HTMLElement | null {
  const h2 = [...root.querySelectorAll('h2')].find((e) => e.textContent === titulo);
  return h2?.closest('section') ?? null;
}

export function casilla(root: ParentNode): HTMLInputElement {
  const el = root.querySelector('input[type="checkbox"][name="aceptado"]');
  if (!(el instanceof HTMLInputElement)) throw new Error('sin casilla de aceptación');
  return el;
}

export function textarea(root: ParentNode, name: string): HTMLTextAreaElement {
  const el = root.querySelector(`textarea[name="${name}"]`);
  if (!(el instanceof HTMLTextAreaElement)) throw new Error(`sin textarea ${name}`);
  return el;
}

export function enviar(form: HTMLFormElement | null): void {
  if (form === null) throw new Error('sin formulario');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/** Llamadas a la API de historia clínica (para afirmar que no hubo ninguna). */
export function llamadasClinicas(ctx: TestContext): number {
  return Object.values(ctx.ficha).reduce((n, fn) => n + fn.mock.calls.length, 0);
}
