/**
 * Tarea 8.1 de C-13: XSS transversal. Los mismos datos con marcado HTML (paciente, prestación, sillón, notas y
 * motivo) recorren las cuatro superficies de la agenda —grilla, lista de turnos, detalle y buscador de pacientes—
 * y en ninguna se interpretan: el texto aparece literal y el documento no gana ningún `img` ni `script`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESTACION_LIMPIEZA, SILLON_1, SILLON_2 } from '../../api/__fixtures__/agendaConfig';
import { PACIENTE_ANA } from '../../api/__fixtures__/pacientes';
import { TURNO_MALICIOSO, XSS_IMG, XSS_SCRIPT } from '../../api/__fixtures__/turnos';
import type { Paciente, Prestacion, Sillon, Turno } from '../../api/types';
import { bloqueDe, boton, dialogo, montarConTimers, tick, usarRelojFalso } from '../../test-support/agenda';

beforeEach(usarRelojFalso);
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  sessionStorage.clear();
});

const SILLON_MALICIOSO: Sillon = { ...SILLON_1, nombre: XSS_IMG };
const PRESTACION_MALICIOSA: Prestacion = { ...PRESTACION_LIMPIEZA, id: 13, nombre: XSS_SCRIPT };
const PACIENTE_MALICIOSO: Paciente = { ...PACIENTE_ANA, id: 9, nombre: XSS_IMG, apellido: XSS_SCRIPT };
const TURNO: Turno = { ...TURNO_MALICIOSO, prestacion: { id: 13, nombre: XSS_SCRIPT } };

const DATOS = {
  sillones: [SILLON_MALICIOSO, SILLON_2],
  prestaciones: [PRESTACION_MALICIOSA],
  turnos: [TURNO],
  pacientes: { contenido: [PACIENTE_MALICIOSO], pagina: 0, tamanio: 10, totalElementos: 1, totalPaginas: 1 },
};

/** El documento no ganó ningún elemento ejecutable ni un `onerror` como atributo. */
function sinElementosInyectados(): void {
  expect(document.querySelectorAll('img')).toHaveLength(0);
  expect(document.querySelectorAll('script')).toHaveLength(0);
  expect(document.querySelectorAll('[onerror]')).toHaveLength(0);
}

describe('8.1 XSS transversal en la agenda', () => {
  it('grilla: paciente, prestación y sillón (encabezado de columna) son texto literal', async () => {
    await montarConTimers('ADMIN', DATOS);
    const grilla = document.querySelector('.grilla');
    expect(grilla?.textContent).toContain(`${XSS_SCRIPT}, ${XSS_IMG}`);
    expect(grilla?.textContent).toContain(XSS_SCRIPT);
    expect([...document.querySelectorAll('.grilla-titulo')].map((t) => t.textContent)).toContain(XSS_IMG);
    expect(bloqueDe(109).getAttribute('aria-label')).toContain(XSS_IMG);
    sinElementosInyectados();
  });

  it('lista de turnos: paciente, prestación, sillón y notas son texto literal', async () => {
    await montarConTimers('ADMIN', DATOS);
    const lista = document.querySelector('.lista-turnos');
    expect(lista?.textContent).toContain(`${XSS_SCRIPT}, ${XSS_IMG}`);
    expect(lista?.querySelector('.turno-prestacion')?.textContent).toBe(XSS_SCRIPT);
    expect(lista?.querySelector('.turno-sillon')?.textContent).toBe(XSS_IMG);
    sinElementosInyectados();
  });

  it('detalle: paciente, prestación, sillón, notas y motivo de cancelación son texto literal en su campo', async () => {
    await montarConTimers('ADMIN', DATOS);
    bloqueDe(109).click();
    const valores = new Map<string, string>();
    dialogo()
      ?.querySelectorAll('dt')
      .forEach((dt) => valores.set(dt.textContent ?? '', dt.nextElementSibling?.textContent ?? ''));
    expect(valores.get('Paciente')).toBe(`${XSS_SCRIPT}, ${XSS_IMG}`);
    expect(valores.get('Prestación')).toBe(XSS_SCRIPT);
    expect(valores.get('Sillón')).toBe(XSS_IMG);
    expect(valores.get('Notas')).toBe(XSS_SCRIPT);
    expect(valores.get('Motivo de cancelación')).toBe(XSS_IMG);
    expect(dialogo()?.querySelector('h2')?.textContent).toBe(`Turno de ${XSS_SCRIPT}, ${XSS_IMG}`);
    sinElementosInyectados();
  });

  it('buscador de pacientes y alta: opciones, valor elegido, selects de sillón/prestación y notas son texto', async () => {
    await montarConTimers('ADMIN', DATOS);
    boton('Nuevo turno').click();
    const campo = (n: string) => dialogo()?.querySelector<HTMLInputElement>(`[name="${n}"]`) as HTMLInputElement;
    campo('paciente').value = 'pé';
    campo('paciente').dispatchEvent(new Event('input', { bubbles: true }));
    await tick(300);
    const opcion = dialogo()?.querySelector<HTMLButtonElement>('.resultados-paciente button');
    expect(opcion?.textContent).toBe(`${XSS_SCRIPT}, ${XSS_IMG} — DNI ${PACIENTE_ANA.dni}`);
    opcion?.click();
    expect(campo('paciente').value).toBe(`${XSS_SCRIPT}, ${XSS_IMG}`);
    campo('notas').value = XSS_SCRIPT;
    campo('notas').dispatchEvent(new Event('input', { bubbles: true }));
    const textosSillon = [...(dialogo()?.querySelectorAll('[name="sillonId"] option') ?? [])].map((o) => o.textContent);
    expect(textosSillon).toContain(XSS_IMG);
    const textosPrestacion = [...(dialogo()?.querySelectorAll('[name="prestacionId"] option') ?? [])].map((o) => o.textContent);
    expect(textosPrestacion.some((t) => t?.includes(XSS_SCRIPT))).toBe(true);
    expect(campo('notas').value).toBe(XSS_SCRIPT);
    sinElementosInyectados();
  });
});
