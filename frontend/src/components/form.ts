import { h } from '../utils/dom';

/** Campos de formulario accesibles (design D6): label asociado, error enlazado con aria-describedby. */

export interface FieldOptions {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'time' | 'date' | 'datetime-local' | 'tel';
  autocomplete: string;
  required?: boolean;
  /** Teclado sugerido en móviles (p. ej. `numeric`). */
  inputmode?: 'numeric' | 'text';
  /** Largo máximo en caracteres (C-12). */
  maxLength?: number;
  /** Ayuda visible bajo el campo, como texto, enlazada con `aria-describedby` (C-12). */
  hint?: string;
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

/** `hintId`: ayuda que queda siempre en `aria-describedby`; sin ella, el comportamiento es el de C-10. */
function markError(control: HTMLElement, error: HTMLElement, message: string | null, hintId: string | null = null): void {
  error.textContent = message ?? '';
  const describedBy = [hintId, message === null ? null : error.id].filter((v): v is string => v !== null);
  if (message === null) control.removeAttribute('aria-invalid');
  else control.setAttribute('aria-invalid', 'true');
  if (describedBy.length === 0) control.removeAttribute('aria-describedby');
  else control.setAttribute('aria-describedby', describedBy.join(' '));
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
  if (options.maxLength !== undefined) attrs['maxlength'] = String(options.maxLength);
  const input = h('input', { id: options.id, attrs });
  const error = h('p', { id: errorId, className: 'error-campo' });
  const hintId = options.hint === undefined ? null : `${options.id}-hint`;
  const hint = hintId === null ? null : h('p', { id: hintId, className: 'ayuda-campo' }, options.hint);
  const element = h(
    'div',
    { className: 'campo' },
    h('label', { attrs: { for: options.id } }, options.label),
    input,
    hint,
    error,
  );
  markError(input, error, null, hintId);

  return {
    name: options.name,
    element,
    input,
    value: () => input.value,
    setValue(value) {
      input.value = value;
    },
    setError: (message) => markError(input, error, message, hintId),
    focus: () => input.focus(),
  };
}

export interface TextAreaFieldOptions {
  id: string;
  name: string;
  label: string;
  /** Obligatorio: los textos clínicos tienen límite en el backend (C-08, D11). */
  maxLength: number;
  required?: boolean;
  rows?: number;
}

export interface TextAreaField extends FormControl {
  readonly element: HTMLElement;
  readonly textarea: HTMLTextAreaElement;
  value(): string;
  setValue(value: string): void;
}

/** Área de texto accesible (C-12, D9): mismo esquema de label y error que `createField`. */
export function createTextAreaField(options: TextAreaFieldOptions): TextAreaField {
  const textarea = h('textarea', {
    id: options.id,
    attrs: { name: options.name, maxlength: String(options.maxLength), required: options.required ?? false },
  });
  if (options.rows !== undefined) textarea.rows = options.rows;
  const error = h('p', { id: `${options.id}-error`, className: 'error-campo' });
  const element = h('div', { className: 'campo' }, h('label', { attrs: { for: options.id } }, options.label), textarea, error);
  return {
    name: options.name,
    element,
    textarea,
    value: () => textarea.value,
    setValue(value) {
      textarea.value = value;
    },
    setError: (message) => markError(textarea, error, message),
    focus: () => textarea.focus(),
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
