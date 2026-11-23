import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountApp } from './app';

describe('mountApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('monta un unico h1 con el nombre del producto', () => {
    mountApp(document);
    const headings = document.querySelectorAll('#app h1');
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe('Global');
  });

  it('muestra un titulo malicioso como texto literal, sin crear nodos', () => {
    mountApp(document, '<img src=x onerror=alert(1)>');
    expect(document.querySelector('h1')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });

  it('lanza un Error descriptivo si falta el contenedor #app', () => {
    document.body.innerHTML = '';
    expect(() => mountApp(document)).toThrowError(/#app/);
  });
});
