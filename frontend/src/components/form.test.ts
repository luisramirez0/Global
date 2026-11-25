import { afterEach, describe, expect, it } from 'vitest';
import { applyFieldErrors, createField, createSelectField, createTextAreaField, mensajeExceso } from './form';

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

/* C-12 (design D9): maxLength, ayuda accesible y textarea. Aditivo: los casos de arriba no cambian. */
describe('createField: maxLength y ayuda (C-12)', () => {
  it('maxLength se refleja en el input; sin la opción no hay atributo', () => {
    const con = createField({ id: 'n', name: 'nombre', label: 'Nombre', type: 'text', autocomplete: 'off', maxLength: 100 });
    const sin = createField({ id: 's', name: 's', label: 'S', type: 'text', autocomplete: 'off' });
    expect(con.input.maxLength).toBe(100);
    expect(con.input.getAttribute('maxlength')).toBe('100');
    expect(sin.input.hasAttribute('maxlength')).toBe(false);
  });

  it('la ayuda se muestra como texto y queda enlazada con aria-describedby', () => {
    const f = createField({
      id: 'tel',
      name: 'telefono',
      label: 'Teléfono',
      type: 'tel',
      autocomplete: 'tel',
      hint: 'Ej.: +54 9 11 2345 6789',
    });
    document.body.append(f.element);
    expect(f.input.type).toBe('tel');
    expect(document.getElementById('tel-hint')?.textContent).toBe('Ej.: +54 9 11 2345 6789');
    expect(f.input.getAttribute('aria-describedby')).toBe('tel-hint');
  });

  it('con ayuda, el error se suma a aria-describedby y al limpiarlo queda solo la ayuda', () => {
    const f = createField({ id: 'tel', name: 'telefono', label: 'Teléfono', type: 'tel', autocomplete: 'tel', hint: 'Ej.' });
    f.setError('Formato inválido');
    expect(f.input.getAttribute('aria-describedby')).toBe('tel-hint tel-error');
    expect(f.input.getAttribute('aria-invalid')).toBe('true');
    f.setError(null);
    expect(f.input.getAttribute('aria-describedby')).toBe('tel-hint');
    expect(f.input.hasAttribute('aria-invalid')).toBe(false);
  });

  it("type 'tel' se refleja en el input, con su autocomplete, y no fuerza inputmode", () => {
    const f = createField({ id: 'tel', name: 'telefono', label: 'Teléfono', type: 'tel', autocomplete: 'tel' });
    const g = createField({ id: 't2', name: 'otro', label: 'Otro', type: 'tel', autocomplete: 'off', inputmode: 'numeric' });
    expect(f.input.type).toBe('tel');
    expect(f.input.getAttribute('autocomplete')).toBe('tel');
    expect(f.input.hasAttribute('inputmode')).toBe(false);
    expect(g.input.type).toBe('tel');
    expect(g.input.getAttribute('inputmode')).toBe('numeric');
  });

  it('sin hint no hay párrafo de ayuda ni aria-describedby (comportamiento de C-10)', () => {
    const f = createField({ id: 'n', name: 'nombre', label: 'Nombre', type: 'text', autocomplete: 'off' });
    expect(f.element.querySelector('.ayuda-campo')).toBeNull();
    expect(f.input.hasAttribute('aria-describedby')).toBe(false);
    f.setError('Mal');
    expect(f.input.getAttribute('aria-describedby')).toBe('n-error');
    f.setError(null);
    expect(f.input.hasAttribute('aria-describedby')).toBe(false);
  });

  it('una ayuda maliciosa queda como texto literal', () => {
    const f = createField({ id: 'x', name: 'x', label: 'X', type: 'text', autocomplete: 'off', hint: '<img src=x onerror=alert(1)>' });
    document.body.append(f.element);
    expect(f.element.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('createTextAreaField (C-12)', () => {
  it('label asociado, name, maxLength y valor', () => {
    const f = createTextAreaField({ id: 'alergias', name: 'alergias', label: 'Alergias', maxLength: 4000 });
    document.body.append(f.element);
    expect(f.textarea.tagName).toBe('TEXTAREA');
    expect(f.textarea.name).toBe('alergias');
    expect(f.textarea.maxLength).toBe(4000);
    expect(document.querySelector('label[for="alergias"]')?.textContent).toBe('Alergias');
    f.setValue('Penicilina');
    expect(f.value()).toBe('Penicilina');
    expect(f.textarea.value).toBe('Penicilina');
  });

  it('required y rows opcionales', () => {
    const f = createTextAreaField({ id: 'nota', name: 'texto', label: 'Nota', maxLength: 10000, required: true, rows: 6 });
    const g = createTextAreaField({ id: 'obs', name: 'observaciones', label: 'Observaciones', maxLength: 4000 });
    expect(f.textarea.required).toBe(true);
    expect(f.textarea.rows).toBe(6);
    expect(g.textarea.required).toBe(false);
  });

  it('setValue con contenido malicioso lo guarda como texto, sin crear nodos', () => {
    const f = createTextAreaField({ id: 't', name: 't', label: 'T', maxLength: 4000 });
    document.body.append(f.element);
    f.setValue('<script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(f.value()).toBe('<script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('setError marca aria-invalid y enlaza el mensaje; null lo limpia', () => {
    const f = createTextAreaField({ id: 't', name: 't', label: 'T', maxLength: 10 });
    document.body.append(f.element);
    f.setError('Demasiado largo');
    expect(f.textarea.getAttribute('aria-invalid')).toBe('true');
    expect(f.textarea.getAttribute('aria-describedby')).toBe('t-error');
    expect(document.getElementById('t-error')?.textContent).toBe('Demasiado largo');
    f.setError(null);
    expect(f.textarea.hasAttribute('aria-invalid')).toBe(false);
    expect(document.getElementById('t-error')?.textContent).toBe('');
  });

  it('applyFieldErrors enfoca la textarea con error aunque haya inputs antes sin error', () => {
    const input = createField({ id: 'a', name: 'a', label: 'A', type: 'text', autocomplete: 'off' });
    const area = createTextAreaField({ id: 'b', name: 'b', label: 'B', maxLength: 10 });
    document.body.append(input.element, area.element);
    applyFieldErrors([input, area], { b: 'Mal' });
    expect(document.activeElement).toBe(area.textarea);
    expect(input.input.hasAttribute('aria-invalid')).toBe(false);
  });
});

/* C-12b (A-D5b): un texto pegado de más del máximo no se corta en silencio; se avisa con un error. */
describe('createTextAreaField con avisarExceso (C-12b)', () => {
  function teclear(t: HTMLTextAreaElement, valor: string): void {
    t.value = valor;
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('no pone el atributo maxlength, porque el navegador cortaría en silencio un texto pegado', () => {
    const f = createTextAreaField({ id: 'a', name: 'a', label: 'A', maxLength: 10, avisarExceso: true });
    expect(f.textarea.hasAttribute('maxlength')).toBe(false);
  });

  it('al pasarse del máximo avisa con la cuenta y conserva el texto completo', () => {
    const f = createTextAreaField({ id: 'a', name: 'a', label: 'A', maxLength: 10, avisarExceso: true });
    document.body.append(f.element);
    teclear(f.textarea, 'x'.repeat(15));
    expect(f.value()).toHaveLength(15);
    expect(document.getElementById('a-error')?.textContent).toBe('Máximo 10 caracteres (hay 15).');
    expect(f.textarea.getAttribute('aria-invalid')).toBe('true');
  });

  it('al volver al máximo se limpia el aviso', () => {
    const f = createTextAreaField({ id: 'a', name: 'a', label: 'A', maxLength: 10, avisarExceso: true });
    document.body.append(f.element);
    teclear(f.textarea, 'x'.repeat(11));
    teclear(f.textarea, 'x'.repeat(10));
    expect(document.getElementById('a-error')?.textContent).toBe('');
    expect(f.textarea.hasAttribute('aria-invalid')).toBe(false);
  });

  it('sin avisarExceso se comporta como antes (maxlength)', () => {
    const f = createTextAreaField({ id: 'a', name: 'a', label: 'A', maxLength: 10 });
    expect(f.textarea.maxLength).toBe(10);
  });

  it('mensajeExceso arma el texto con el máximo y la cantidad', () => {
    expect(mensajeExceso(4000, 4500)).toBe('Máximo 4000 caracteres (hay 4500).');
  });
});

describe('createTextAreaField', () => {
  it('label asociado, valor editable y error enlazado con aria-describedby', () => {
    const f = createTextAreaField({ id: 'notas', name: 'notas', label: 'Notas' });
    document.body.append(f.element);
    expect(document.querySelector('label[for="notas"]')?.textContent).toBe('Notas');
    expect(f.textarea.tagName).toBe('TEXTAREA');
    f.setValue('Control <b>anual</b>');
    expect(f.value()).toBe('Control <b>anual</b>');
    expect(document.querySelector('b')).toBeNull();
    f.setError('Máximo 1000 caracteres.');
    expect(f.textarea.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(f.textarea.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Máximo 1000 caracteres.');
    f.setError(null);
    expect(f.textarea.hasAttribute('aria-invalid')).toBe(false);
    expect(f.textarea.hasAttribute('aria-describedby')).toBe(false);
  });

  it('focus() enfoca el textarea y participa de applyFieldErrors', () => {
    const f = createTextAreaField({ id: 'n2', name: 'notas', label: 'Notas' });
    document.body.append(f.element);
    applyFieldErrors([f], { notas: 'Demasiado larga' });
    expect(document.activeElement).toBe(f.textarea);
  });
});
