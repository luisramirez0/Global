import { describe, expect, it, vi } from 'vitest';
import { clear, h } from './dom';

const MALICIOSO = '<img src=x onerror=alert(1)>';

describe('h', () => {
  it('inserta los hijos string como texto literal', () => {
    const p = h('p', {}, MALICIOSO);
    expect(p.textContent).toBe(MALICIOSO);
    expect(p.children).toHaveLength(0);
    expect(p.querySelector('img')).toBeNull();
  });

  it('acepta nodos como hijos e ignora null, undefined y false', () => {
    const span = h('span', {}, 'hola');
    const div = h('div', {}, span, null, undefined, false, ' mundo');
    expect(div.firstChild).toBe(span);
    expect(div.textContent).toBe('hola mundo');
  });

  it('aplica id, className y atributos permitidos', () => {
    const input = h('input', {
      id: 'email',
      className: 'campo',
      attrs: {
        type: 'email',
        name: 'email',
        autocomplete: 'email',
        required: true,
        disabled: false,
        'aria-invalid': 'true',
        'data-test': 'x',
      },
    });
    expect(input.id).toBe('email');
    expect(input.className).toBe('campo');
    expect(input.getAttribute('type')).toBe('email');
    expect(input.hasAttribute('required')).toBe(true);
    expect(input.hasAttribute('disabled')).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.dataset['test']).toBe('x');
  });

  it('aplica el atributo for de un label', () => {
    const label = h('label', { attrs: { for: 'email' } }, 'Email');
    expect(label.htmlFor).toBe('email');
  });

  it('registra listeners con on', () => {
    const onClick = vi.fn();
    const button = h('button', { on: { click: onClick } }, 'ok');
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['onclick', 'onerror', 'ONLOAD'])('rechaza el atributo de evento %s como texto', (name) => {
    expect(() => h('div', { attrs: { [name]: 'alert(1)' } })).toThrowError(/no permitido/);
  });

  it('rechaza style como texto y atributos desconocidos', () => {
    expect(() => h('div', { attrs: { style: 'color:red' } })).toThrowError(/no permitido/);
    expect(() => h('div', { attrs: { srcdoc: 'x' } })).toThrowError(/no permitido/);
  });

  it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x'])(
    'rechaza href peligroso %j',
    (href) => {
      expect(() => h('a', { attrs: { href } })).toThrowError(/href/);
    },
  );

  it.each(['#/login', 'https://ejemplo.test', 'http://ejemplo.test/a', 'mailto:ana@ejemplo.test', '/relativa'])(
    'acepta href seguro %j',
    (href) => {
      expect(h('a', { attrs: { href } }).getAttribute('href')).toBe(href);
    },
  );
});

describe('clear', () => {
  it('vacía el elemento', () => {
    const div = h('div', {}, h('p', {}, 'a'), 'b');
    clear(div);
    expect(div.childNodes).toHaveLength(0);
  });
});
