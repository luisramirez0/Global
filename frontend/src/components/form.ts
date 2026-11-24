import { h } from '../utils/dom';

/** Campos de formulario accesibles (design D6): label asociado, error enlazado con aria-describedby. */

export interface FieldOptions {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'time' | 'date' | 'datetime-local';
  autocomplete: string;
  required?: boolean;
  /** Teclado sugerido en móviles (p. ej. `numeric`). */
  inputmode?: 'numeric' | 'text';
}

/** Lo mínimo que necesita `applyFieldErrors`: un campo con nombre, error accesible y foco (C-11). */
export interface FormControl {
  readonly name: string;
  setError(message: string | null): void;
  focus(): void;
}

export interface Field extends FormControl {
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  value(): string;
  setValue(value: string): void;
}

function markError(control: HTMLElement, error: HTMLElement, message: string | null): void {
  error.textContent = message ?? '';
  if (message === null) {
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-describedby');
  } else {
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', error.id);
  }
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldOptions {
  id: string;
  name: string;
  label: string;
  options: readonly SelectOption[];
}

export interface SelectField extends FormControl {
  readonly element: HTMLElement;
  readonly select: HTMLSelectElement;
  value(): string;
  setValue(value: string): void;
  /** Reemplaza las opciones (etiquetas como texto); conserva el valor si sigue existiendo. */
  setOptions(options: readonly SelectOption[]): void;
}

export function createSelectField(options: SelectFieldOptions): SelectField {
  const error = h('p', { id: `${options.id}-error`, className: 'error-campo' });
  const select = h('select', { id: options.id, attrs: { name: options.name } });
  const element = h('div', { className: 'campo' }, h('label', { attrs: { for: options.id } }, options.label), select, error);

  function setOptions(list: readonly SelectOption[]): void {
    const previous = select.value;
    select.replaceChildren(...list.map((o) => h('option', { attrs: { value: o.value } }, o.label)));
    if (list.some((o) => o.value === previous)) select.value = previous;
  }
  setOptions(options.options);

  return {
    name: options.name,
    element,
    select,
    value: () => select.value,
    setValue(value) {
      select.value = value;
    },
    setOptions,
    setError: (message) => markError(select, error, message),
    focus: () => select.focus(),
  };
}

export function createField(options: FieldOptions): Field {
  const errorId = `${options.id}-error`;
  const attrs: Record<string, string | boolean> = {
    name: options.name,
    type: options.type,
    autocomplete: options.autocomplete,
    required: options.required ?? false,
  };
  if (options.inputmode !== undefined) attrs['inputmode'] = options.inputmode;
  const input = h('input', { id: options.id, attrs });
  const error = h('p', { id: errorId, className: 'error-campo' });
  const element = h('div', { className: 'campo' }, h('label', { attrs: { for: options.id } }, options.label), input, error);

  return {
    name: options.name,
    element,
    input,
    value: () => input.value,
    setValue(value) {
      input.value = value;
    },
    setError: (message) => markError(input, error, message),
    focus: () => input.focus(),
  };
}

export interface FormStatus {
  readonly element: HTMLElement;
  show(message: string): void;
  clear(): void;
}

/** Resumen de errores generales, anunciado por lectores de pantalla. */
export function createFormStatus(): FormStatus {
  const element = h('div', { className: 'alerta', attrs: { role: 'alert' } });
  return {
    element,
    show(message) {
      element.textContent = message;
    },
    clear() {
      element.textContent = '';
    },
  };
}

export function setBusy(form: HTMLFormElement, button: HTMLButtonElement, busy: boolean): void {
  button.disabled = busy;
  if (busy) form.setAttribute('aria-busy', 'true');
  else form.removeAttribute('aria-busy');
}

/** Aplica (o limpia) los errores de cada campo y enfoca el primero con error. Ignora nombres sin campo. */
export function applyFieldErrors(fields: readonly FormControl[], errors: Readonly<Record<string, string | undefined>>): void {
  let focused = false;
  for (const field of fields) {
    const message = errors[field.name];
    field.setError(message ?? null);
    if (message !== undefined && !focused) {
      field.focus();
      focused = true;
    }
  }
}
