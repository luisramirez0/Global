import { h } from '../utils/dom';

/** Campos de formulario accesibles (design D6): label asociado, error enlazado con aria-describedby. */

export interface FieldOptions {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'password';
  autocomplete: string;
  required?: boolean;
}

export interface Field {
  readonly name: string;
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  value(): string;
  setValue(value: string): void;
  setError(message: string | null): void;
}

export function createField(options: FieldOptions): Field {
  const errorId = `${options.id}-error`;
  const input = h('input', {
    id: options.id,
    attrs: {
      name: options.name,
      type: options.type,
      autocomplete: options.autocomplete,
      required: options.required ?? false,
    },
  });
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
    setError(message) {
      error.textContent = message ?? '';
      if (message === null) {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      } else {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', errorId);
      }
    },
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
export function applyFieldErrors(fields: readonly Field[], errors: Readonly<Record<string, string | undefined>>): void {
  let focused = false;
  for (const field of fields) {
    const message = errors[field.name];
    field.setError(message ?? null);
    if (message !== undefined && !focused) {
      field.input.focus();
      focused = true;
    }
  }
}
