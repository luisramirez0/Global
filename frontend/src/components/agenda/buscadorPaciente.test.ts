import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PACIENTE_ANA, PACIENTE_MINIMO } from '../../api/__fixtures__/pacientes';
import { ApiError } from '../../api/errors';
import type { PacientesApi } from '../../api/pacientes';
import type { Paciente, Pagina } from '../../api/types';
import { deferred } from '../../test-support/pages';
import { crearBuscadorPaciente } from './buscadorPaciente';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const pagina = (contenido: Paciente[]): Pagina<Paciente> => ({ contenido, pagina: 0, tamanio: 10, totalElementos: contenido.length, totalPaginas: 1 });

function montar(buscar: PacientesApi['buscar'] = () => Promise.resolve(pagina([PACIENTE_ANA, PACIENTE_MINIMO]))) {
  const fn = vi.fn<PacientesApi['buscar']>(buscar);
  const alElegir = vi.fn<(p: Paciente) => void>();
  const buscador = crearBuscadorPaciente({ buscar: fn, alElegir });
  document.body.replaceChildren(buscador.element);
  return { buscador, fn, alElegir };
}

async function escribir(texto: string, esperarMs = 300): Promise<void> {
  const input = document.querySelector('input');
  if (input === null) throw new Error('sin input');
  input.value = texto;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await vi.advanceTimersByTimeAsync(esperarMs);
}

const opciones = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>('ul button')];

describe('buscadorPaciente', () => {
  it('tiene label asociado "Paciente" y nombre de campo pacienteId', () => {
    const { buscador } = montar();
    const label = document.querySelector('label');
    expect(label?.textContent).toBe('Paciente');
    expect(label?.getAttribute('for')).toBe(buscador.input.id);
    expect(buscador.name).toBe('pacienteId');
  });

  it('con menos de 2 caracteres no busca', async () => {
    const { fn } = montar();
    await escribir('p');
    expect(fn).not.toHaveBeenCalled();
    await escribir('  p  ');
    expect(fn).not.toHaveBeenCalled();
  });

  it('con 2 o más busca con q recortado y tamaño acotado, después del debounce', async () => {
    const { fn } = montar();
    await escribir('pér', 299);
    expect(fn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ q: 'pér', size: 10 });
  });

  it('el debounce junta pulsaciones: solo se pide el último texto', async () => {
    const { fn } = montar();
    await escribir('pé', 100);
    await escribir('pér', 100);
    await escribir('pére', 300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ q: 'pére', size: 10 });
  });

  it('lista las opciones como "Apellido, Nombre — DNI" y anuncia la cantidad', async () => {
    montar();
    await escribir('pé');
    expect(opciones().map((o) => o.textContent)).toEqual(['Pérez, Ana — DNI 30111222', 'Gómez, Luis — DNI 28999111']);
    expect(document.querySelector('[role="status"]')?.textContent).toBe('2 resultados.');
  });

  it('sin resultados lo dice', async () => {
    montar(() => Promise.resolve(pagina([])));
    await escribir('zz');
    expect(opciones()).toHaveLength(0);
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Sin resultados.');
  });

  it('elegir con clic fija el paciente, completa el campo y cierra las opciones', async () => {
    const { buscador, alElegir } = montar();
    await escribir('pé');
    opciones()[0]?.click();
    expect(buscador.valor()).toBe(5);
    expect(buscador.input.value).toBe('Pérez, Ana');
    expect(opciones()).toHaveLength(0);
    expect(alElegir).toHaveBeenCalledWith(PACIENTE_ANA);
  });

  it('con teclado: Abajo desde el campo va a la primera opción, Abajo/Arriba recorren y Enter elige', async () => {
    const { buscador } = montar();
    await escribir('pé');
    buscador.input.focus();
    const tecla = (el: Element, key: string): void => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    };
    tecla(buscador.input, 'ArrowDown');
    expect(document.activeElement).toBe(opciones()[0]);
    tecla(opciones()[0] as Element, 'ArrowDown');
    expect(document.activeElement).toBe(opciones()[1]);
    tecla(opciones()[1] as Element, 'ArrowDown');
    expect(document.activeElement).toBe(opciones()[1]);
    tecla(opciones()[1] as Element, 'ArrowUp');
    expect(document.activeElement).toBe(opciones()[0]);
    tecla(opciones()[0] as Element, 'ArrowUp');
    expect(document.activeElement).toBe(buscador.input);
    // Enter sobre un botón es un clic nativo.
    opciones()[1]?.click();
    expect(buscador.valor()).toBe(6);
  });

  it('escribir de nuevo después de elegir descarta la elección', async () => {
    const { buscador } = montar();
    await escribir('pé');
    opciones()[0]?.click();
    expect(buscador.valor()).toBe(5);
    await escribir('Pérez, Anx');
    expect(buscador.valor()).toBeNull();
  });

  it('una respuesta tardía de una búsqueda anterior se descarta', async () => {
    const primera = deferred<Pagina<Paciente>>();
    const segunda = deferred<Pagina<Paciente>>();
    const respuestas = [primera, segunda];
    const { fn } = montar(() => (respuestas.shift() ?? segunda).promise);
    await escribir('pé');
    await escribir('pér');
    expect(fn).toHaveBeenCalledTimes(2);
    segunda.resolve(pagina([PACIENTE_MINIMO]));
    await vi.advanceTimersByTimeAsync(0);
    primera.resolve(pagina([PACIENTE_ANA]));
    await vi.advanceTimersByTimeAsync(0);
    expect(opciones().map((o) => o.textContent)).toEqual(['Gómez, Luis — DNI 28999111']);
  });

  it('borrar el texto descarta resultados pendientes', async () => {
    const pendiente = deferred<Pagina<Paciente>>();
    montar(() => pendiente.promise);
    await escribir('pé');
    await escribir('');
    pendiente.resolve(pagina([PACIENTE_ANA]));
    await vi.advanceTimersByTimeAsync(0);
    expect(opciones()).toHaveLength(0);
  });

  it('error de red: mensaje fijo, sin datos del servidor', async () => {
    montar(() => Promise.reject(new ApiError('network')));
    await escribir('pé');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('No se pudo conectar con el servidor.');
    expect(opciones()).toHaveLength(0);
  });

  it('XSS: nombre y DNI con marcado HTML se ven como texto, sin img', async () => {
    const malicioso: Paciente = { ...PACIENTE_ANA, nombre: '<img src=x onerror=alert(1)>', dni: '<script>1</script>' };
    montar(() => Promise.resolve(pagina([malicioso])));
    await escribir('pé');
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(opciones()[0]?.textContent).toBe('Pérez, <img src=x onerror=alert(1)> — DNI <script>1</script>');
  });

  it('setError marca el campo con aria-invalid y aria-describedby', () => {
    const { buscador } = montar();
    buscador.setError('Elegí un paciente.');
    expect(buscador.input.getAttribute('aria-invalid')).toBe('true');
    const ids = (buscador.input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids.map((i) => document.getElementById(i)?.textContent)).toContain('Elegí un paciente.');
    buscador.setError(null);
    expect(buscador.input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('elegir(paciente) fija la elección sin buscar (para restaurar datos)', () => {
    const { buscador, fn } = montar();
    buscador.elegir(PACIENTE_ANA);
    expect(buscador.valor()).toBe(5);
    expect(buscador.input.value).toBe('Pérez, Ana');
    expect(fn).not.toHaveBeenCalled();
  });
});
