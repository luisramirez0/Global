/**
 * Creación segura de nodos (regla 3, design D5): el texto se inserta siempre como nodo de texto y los eventos
 * solo como listeners. No hay forma de pasar HTML a interpretar.
 */

export type Child = Node | string | null | undefined | false;

export type Listeners = {
  [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void;
};

export interface Props {
  id?: string;
  className?: string;
  attrs?: Readonly<Record<string, string | boolean>>;
  on?: Listeners;
}

const ALLOWED_ATTRIBUTES: ReadonlySet<string> = new Set([
  'autocomplete',
  'disabled',
  'for',
  'hidden',
  'href',
  'inputmode',
  'lang',
  'maxlength',
  'name',
  'novalidate',
  'placeholder',
  'required',
  'role',
  'tabindex',
  'title',
  'type',
  'value',
]);

const SAFE_HREF_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:']);

function assertAllowedAttribute(name: string): void {
  const lower = name.toLowerCase();
  if (lower.startsWith('aria-') || lower.startsWith('data-')) {
    return;
  }
  if (!ALLOWED_ATTRIBUTES.has(lower)) {
    throw new Error(`Atributo no permitido: ${name}`);
  }
}

function assertSafeHref(href: string): void {
  // Los navegadores ignoran espacios y caracteres de control en el esquema ("java\tscript:").
  // eslint-disable-next-line no-control-regex
  const normalized = href.replace(/[\u0000- ]/g, '').toLowerCase();
  if (normalized.startsWith('#')) {
    return;
  }
  const scheme = /^([a-z][a-z0-9+.-]*:)/.exec(normalized)?.[1];
  if (scheme !== undefined && !SAFE_HREF_SCHEMES.has(scheme)) {
    throw new Error('href con esquema no permitido');
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.id !== undefined) {
    el.id = props.id;
  }
  if (props.className !== undefined) {
    el.className = props.className;
  }
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    assertAllowedAttribute(name);
    if (value === false) {
      continue;
    }
    const text = value === true ? '' : value;
    if (name.toLowerCase() === 'href') {
      assertSafeHref(text);
    }
    el.setAttribute(name, text);
  }
  for (const [type, listener] of Object.entries(props.on ?? {})) {
    if (listener !== undefined) {
      el.addEventListener(type, listener as EventListener);
    }
  }
  append(el, ...children);
  return el;
}

export function append(parent: Node, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function clear(el: Element): void {
  el.replaceChildren();
}
