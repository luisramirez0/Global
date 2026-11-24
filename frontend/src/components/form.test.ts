import { afterEach, describe, expect, it } from 'vitest';
import { applyFieldErrors, createField, createSelectField } from './form';

afterEach(() => {
  document.body.replaceChildren();
});

describe('createField', () => {
  it('admite inputs de hora y de fecha y hora, y inputmode', () => {
    const hora = createField({ id: 'h', name: 'hora', label: 'Hora', type: 'time', autocomplete: 'off' });
    const fh = createField({ id: 'fh', name: 'inicio', label: 'Inicio', type: 'datetime-local', autocomplete: 'off' });
    const num = createField({ id: 'n', name: 'dur', label: 'Duración', type: 'text', autocomplete: 'off', inputmode: 'numeric' });
    expect(hora.input.type).toBe('time');
    expect(fh.input.type).toBe('datetime-local');
    expect(num.input.getAttribute('inputmode')).toBe('numeric');
    expect(hora.input.hasAttribute('inputmode')).toBe(false);
  });

  it('focus() enfoca el input', () => {
    const f = createField({ id: 'x', name: 'x', label: 'X', type: 'text', autocomplete: 'off' });
    document.body.append(f.element);
    f.focus();
    expect(document.activeElement).toBe(f.input);
  });
});

describe('createSelectField', () => {
  const opciones = [
    { value: '1', label: 'Lunes' },
    { value: '2', label: 'Martes' },
  ];

  it('label asociado, opciones como texto y valor inicial la primera', () => {
    const f = createSelectField({ id: 'dia', name: 'diaSemana', label: 'Día', options: opciones });
    document.body.append(f.element);
    expect(f.select.name).toBe('diaSemana');
    expect(document.querySelector('label[for="dia"]')?.textContent).toBe('Día');
    expect([...f.select.options].map((o) => [o.value, o.textContent])).toEqual([
      ['1', 'Lunes'],
      ['2', 'Martes'],
    ]);
    expect(f.value()).toBe('1');
  });

  it('setValue y setOptions; las etiquetas maliciosas quedan como texto', () => {
    const f = createSelectField({ id: 's', name: 'alcance', label: 'Alcance', options: opciones });
    f.setValue('2');
    expect(f.value()).toBe('2');
    f.setOptions([{ value: 'a', label: '<img src=x onerror=alert(1)>' }]);
    document.body.append(f.element);
    expect(f.select.options[0]?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });

  it('setError marca aria-invalid y enlaza el mensaje; null lo limpia', () => {
    const f = createSelectField({ id: 's', name: 'alcance', label: 'Alcance', options: opciones });
    document.body.append(f.element);
    f.setError('Elegí una opción.');
    expect(f.select.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(f.select.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Elegí una opción.');
    f.setError(null);
    expect(f.select.hasAttribute('aria-invalid')).toBe(false);
    expect(f.select.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('applyFieldErrors con controles mixtos', () => {
  it('enfoca el primer control con error, aunque sea un select', () => {
    const nombre = createField({ id: 'n', name: 'nombre', label: 'Nombre', type: 'text', autocomplete: 'off' });
    const dia = createSelectField({ id: 'd', name: 'diaSemana', label: 'Día', options: [{ value: '1', label: 'Lunes' }] });
    document.body.append(dia.element, nombre.element);
    applyFieldErrors([dia, nombre], { diaSemana: 'mal', nombre: 'mal' });
    expect(document.activeElement).toBe(dia.select);
    applyFieldErrors([dia, nombre], { nombre: 'mal' });
    expect(document.activeElement).toBe(nombre.input);
    expect(dia.select.hasAttribute('aria-invalid')).toBe(false);
  });
});
