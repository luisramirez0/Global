import { h } from '../../utils/dom';

/** Casilla accesible para el listado ("Mostrar inactivos"). */
export function createCasilla(options: {
  id: string;
  name: string;
  label: string;
  onChange: (checked: boolean) => void;
}): HTMLElement {
  const box = h('input', {
    id: options.id,
    attrs: { type: 'checkbox', name: options.name },
    on: { change: () => options.onChange(box.checked) },
  });
  return h('div', { className: 'casilla' }, box, h('label', { attrs: { for: options.id } }, options.label));
}
