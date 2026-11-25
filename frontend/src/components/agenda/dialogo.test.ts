import { afterEach, describe, expect, it, vi } from 'vitest';
import { h } from '../../utils/dom';
import { abrirDialogo } from './dialogo';

afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

function opener(): HTMLButtonElement {
  const b = h('button', { attrs: { type: 'button' } }, 'Nuevo turno');
  document.body.append(b);
  b.focus();
  return b;
}

function tecla(target: Element, key: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

const campo = (): HTMLInputElement => h('input', { attrs: { type: 'text', name: 'q', 'aria-label': 'Buscar' } });
const boton = (texto: string, extra: Record<string, string | boolean> = {}): HTMLButtonElement =>
  h('button', { attrs: { type: 'button', ...extra } }, texto);

describe('abrirDialogo: nombre accesible y estructura', () => {
  it('queda etiquetado por su título (aria-labelledby) y es modal', () => {
    opener();
    const d = abrirDialogo({ titulo: 'Nuevo turno', contenido: [campo()] });
    const el = document.querySelector('dialog');
    expect(el).toBe(d.element);
    const id = el?.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(id)?.textContent).toBe('Nuevo turno');
    expect(el?.getAttribute('role')).toBe('dialog');
    expect(el?.getAttribute('aria-modal')).toBe('true');
    expect(el?.hasAttribute('open')).toBe(true);
  });

  it('dos diálogos seguidos no comparten id de título', () => {
    opener();
    const a = abrirDialogo({ titulo: 'A', contenido: [campo()] });
    a.cerrar();
    const b = abrirDialogo({ titulo: 'B', contenido: [campo()] });
    expect(document.getElementById(b.element.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('B');
  });

  it('tiene un botón "Cerrar" al final, después del contenido', () => {
    opener();
    abrirDialogo({ titulo: 'T', contenido: [boton('Aceptar')] });
    const botones = [...document.querySelectorAll('dialog button')].map((b) => b.textContent);
    expect(botones).toEqual(['Aceptar', 'Cerrar']);
  });

  it('el título se muestra como texto, sin interpretar HTML', () => {
    opener();
    abrirDialogo({ titulo: '<img src=x onerror=alert(1)>', contenido: [campo()] });
    expect(document.querySelector('dialog img')).toBeNull();
    expect(document.querySelector('dialog h2')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('abrirDialogo: foco', () => {
  it('foco inicial en el primer campo', () => {
    opener();
    const primero = campo();
    abrirDialogo({ titulo: 'T', contenido: [boton('Antes'), primero] });
    expect(document.activeElement).toBe(primero);
  });

  it('sin campos, foco inicial en el primer botón del contenido (no en "Cerrar")', () => {
    opener();
    const primero = boton('Confirmar');
    abrirDialogo({ titulo: 'T', contenido: [primero, boton('Volver')] });
    expect(document.activeElement).toBe(primero);
  });

  it('el elemento indicado por `foco` gana', () => {
    opener();
    const objetivo = boton('Confirmar sobreturno');
    abrirDialogo({ titulo: 'T', contenido: [campo(), objetivo], foco: () => objetivo });
    expect(document.activeElement).toBe(objetivo);
  });

  it('Tab desde el último botón ("Cerrar") pasa al primer enfocable', () => {
    opener();
    const primero = campo();
    const d = abrirDialogo({ titulo: 'T', contenido: [primero, boton('Aceptar')] });
    const cerrar = [...d.element.querySelectorAll('button')].at(-1);
    cerrar?.focus();
    const event = tecla(cerrar as Element, 'Tab');
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(primero);
  });

  it('Shift+Tab desde el primero pasa al último', () => {
    opener();
    const primero = campo();
    const d = abrirDialogo({ titulo: 'T', contenido: [primero, boton('Aceptar')] });
    tecla(primero, 'Tab', true);
    expect(document.activeElement).toBe([...d.element.querySelectorAll('button')].at(-1));
  });

  it('un botón aria-disabled cuenta como enfocable (primero de la trampa); uno disabled no', () => {
    opener();
    const inactivo = boton('Inactivo', { disabled: true });
    const deshabilitado = boton('Asistió', { 'aria-disabled': 'true' });
    const d = abrirDialogo({ titulo: 'T', contenido: [inactivo, deshabilitado] });
    const cerrar = [...d.element.querySelectorAll('button')].at(-1) as HTMLElement;
    // El primero enfocable es el aria-disabled: Shift+Tab desde él envuelve a "Cerrar" y Tab desde "Cerrar" vuelve a él.
    deshabilitado.focus();
    tecla(deshabilitado, 'Tab', true);
    expect(document.activeElement).toBe(cerrar);
    tecla(cerrar, 'Tab');
    expect(document.activeElement).toBe(deshabilitado);
  });

  it('Tab en medio del diálogo no se intercepta (lo resuelve el navegador)', () => {
    opener();
    const primero = campo();
    abrirDialogo({ titulo: 'T', contenido: [primero, boton('Aceptar')] });
    expect(tecla(primero, 'Tab').defaultPrevented).toBe(false);
  });
});

describe('abrirDialogo: cierre', () => {
  it('Escape cierra, quita el diálogo y devuelve el foco a quien lo abrió', () => {
    const abre = opener();
    const alCerrar = vi.fn();
    const d = abrirDialogo({ titulo: 'T', contenido: [campo()], alCerrar });
    expect(document.activeElement).not.toBe(abre);
    const event = tecla(d.element, 'Escape');
    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(abre);
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('el botón "Cerrar" cierra y devuelve el foco', () => {
    const abre = opener();
    const d = abrirDialogo({ titulo: 'T', contenido: [campo()] });
    [...d.element.querySelectorAll('button')].at(-1)?.click();
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(abre);
  });

  it('cerrar dos veces avisa una sola vez', () => {
    opener();
    const alCerrar = vi.fn();
    const d = abrirDialogo({ titulo: 'T', contenido: [campo()], alCerrar });
    d.cerrar();
    d.cerrar();
    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(d.abierto()).toBe(false);
  });

  it('con devolverFoco en falso no toca el foco', () => {
    const abre = opener();
    const d = abrirDialogo({ titulo: 'T', contenido: [campo()] });
    d.cerrar({ devolverFoco: false });
    expect(document.activeElement).not.toBe(abre);
  });

  it('si quien abrió ya no está en el documento, no falla', () => {
    const abre = opener();
    const d = abrirDialogo({ titulo: 'T', contenido: [campo()] });
    abre.remove();
    expect(() => d.cerrar()).not.toThrow();
  });

  it('se puede indicar quién abrió (p. ej. clic en un hueco, que no es enfocable)', () => {
    opener();
    const otro = h('button', { attrs: { type: 'button' } }, 'Otro');
    document.body.append(otro);
    const d = abrirDialogo({ titulo: 'T', contenido: [campo()], opener: otro });
    d.cerrar();
    expect(document.activeElement).toBe(otro);
  });
});

describe('abrirDialogo: reemplazar contenido (un solo diálogo, pasos internos)', () => {
  it('cambia título y contenido, y enfoca el destino', () => {
    opener();
    const confirmar = boton('Confirmar sobreturno');
    const d = abrirDialogo({ titulo: 'Nuevo turno', contenido: [campo()] });
    d.reemplazar('Confirmar sobreturno', [confirmar, boton('Volver')], () => confirmar);
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    expect(d.element.querySelector('h2')?.textContent).toBe('Confirmar sobreturno');
    expect(d.element.querySelector('input')).toBeNull();
    expect(document.activeElement).toBe(confirmar);
  });
});

describe('abrirDialogo: camino nativo (showModal)', () => {
  function stubNativo(): { showModal: ReturnType<typeof vi.fn> } {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value: showModal, configurable: true, writable: true });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { value: close, configurable: true, writable: true });
    return { showModal };
  }

  it('usa showModal y no agrega role ni aria-modal propios', () => {
    const { showModal } = stubNativo();
    opener();
    const d = abrirDialogo({ titulo: 'T', contenido: [campo()] });
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(d.element.hasAttribute('aria-modal')).toBe(false);
    expect(d.element.getAttribute('aria-labelledby')).not.toBeNull();
  });

  it('Escape llega como evento cancel: se cancela el cierre nativo y se cierra con foco devuelto', () => {
    stubNativo();
    const abre = opener();
    const d = abrirDialogo({ titulo: 'T', contenido: [campo()] });
    const cancel = new Event('cancel', { cancelable: true });
    d.element.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(abre);
  });

  it('la trampa de Tab sigue activa en el camino nativo', () => {
    stubNativo();
    opener();
    const primero = campo();
    const d = abrirDialogo({ titulo: 'T', contenido: [primero] });
    tecla([...d.element.querySelectorAll('button')].at(-1) as Element, 'Tab');
    expect(document.activeElement).toBe(primero);
  });
});
