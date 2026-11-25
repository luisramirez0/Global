import { ApiError } from '../../api/errors';
import type { Paciente, PacienteRequest } from '../../api/types';
import { applyFieldErrors, createField, createFormStatus, setBusy, type Field } from '../../components/form';
import type { Page, RouteParams } from '../../router/router';
import { clear, h } from '../../utils/dom';
import { hoyEnZona } from '../../utils/zonaHoraria';
import { serverFieldErrors } from '../auth/messages';
import type { PageContext } from '../context';
import { puedeDarDeBaja, rolActual } from '../permisos';
import {
  MSG_CARGANDO,
  MSG_CREADO,
  MSG_DNI_DUPLICADO,
  MSG_GUARDADO,
  MSG_INACTIVO,
  MSG_NO_ENCONTRADO,
  MSG_REACTIVADO,
  esNoEncontrado,
  mensajeDeError,
} from './mensajes';
import { MAX, validarPaciente, type CampoPaciente, type ValoresPaciente } from './validacion';

/** Títulos fijos (design D8): nunca llevan datos del paciente. */
export const TITULO_ALTA = 'Nuevo paciente';
export const TITULO_EDICION = 'Paciente';

const AYUDA_TELEFONO = 'Ej.: +54 9 11 2345 6789';

interface FormularioPaciente {
  readonly element: HTMLFormElement;
  readonly campos: Readonly<Record<CampoPaciente, Field>>;
  readonly status: ReturnType<typeof createFormStatus>;
  /** Enlace "Ver paciente existente" del 409 (D11). */
  readonly duplicado: HTMLElement;
  readonly submit: HTMLButtonElement;
  leer(): ValoresPaciente;
  cargar(p: Paciente): void;
}

function crearFormulario(prefijo: string, textoBoton: string, onSubmit: () => void): FormularioPaciente {
  const campo = (name: CampoPaciente, label: string, extra: Partial<Parameters<typeof createField>[0]> = {}): Field =>
    createField({ id: `${prefijo}-${name}`, name, label, type: 'text', autocomplete: 'off', ...extra });
  const campos: Record<CampoPaciente, Field> = {
    nombre: campo('nombre', 'Nombre', { required: true, maxLength: MAX.nombre, autocomplete: 'given-name' }),
    apellido: campo('apellido', 'Apellido', { required: true, maxLength: MAX.apellido, autocomplete: 'family-name' }),
    dni: campo('dni', 'DNI', { required: true, maxLength: 20, inputmode: 'numeric' }),
    fechaNacimiento: campo('fechaNacimiento', 'Fecha de nacimiento', { type: 'date', autocomplete: 'bday' }),
    sexo: campo('sexo', 'Sexo', { maxLength: MAX.sexo }),
    telefono: campo('telefono', 'Teléfono', { type: 'tel', autocomplete: 'tel', maxLength: 30, hint: AYUDA_TELEFONO }),
    email: campo('email', 'Email', { type: 'email', autocomplete: 'email', maxLength: MAX.email }),
    direccion: campo('direccion', 'Dirección', { maxLength: MAX.direccion, autocomplete: 'street-address' }),
    obraSocialTexto: campo('obraSocialTexto', 'Obra social', { maxLength: MAX.obraSocialTexto }),
  };
  const status = createFormStatus();
  const duplicado = h('p', { className: 'duplicado' });
  const submit = h('button', { attrs: { type: 'submit' } }, textoBoton);
  const element = h(
    'form',
    {
      attrs: { novalidate: true },
      on: {
        submit: (event) => {
          event.preventDefault();
          onSubmit();
        },
      },
    },
    ...Object.values(campos).map((c) => c.element),
    status.element,
    duplicado,
    h('div', { className: 'acciones-form' }, submit),
  );
  return {
    element,
    campos,
    status,
    duplicado,
    submit,
    leer() {
      return {
        nombre: campos.nombre.value(),
        apellido: campos.apellido.value(),
        dni: campos.dni.value(),
        fechaNacimiento: campos.fechaNacimiento.value(),
        sexo: campos.sexo.value(),
        telefono: campos.telefono.value(),
        email: campos.email.value(),
        direccion: campos.direccion.value(),
        obraSocialTexto: campos.obraSocialTexto.value(),
      };
    },
    cargar(p) {
      campos.nombre.setValue(p.nombre);
      campos.apellido.setValue(p.apellido);
      campos.dni.setValue(p.dni);
      campos.fechaNacimiento.setValue(p.fechaNacimiento ?? '');
      campos.sexo.setValue(p.sexo ?? '');
      campos.telefono.setValue(p.telefono ?? '');
      campos.email.setValue(p.email ?? '');
      campos.direccion.setValue(p.direccion ?? '');
      campos.obraSocialTexto.setValue(p.obraSocialTexto ?? '');
    },
  };
}

/** El 409 de DNI duplicado de C-05 no trae `codigo`; uno con `codigo` es de otro contexto (A-D3). */
function esDniDuplicado(error: unknown): error is ApiError {
  return error instanceof ApiError && error.kind === 'conflict' && error.codigo === null;
}

/**
 * Envía el formulario: valida local, llama a la API y traduce los errores (D9, D11). Devuelve el paciente guardado,
 * o `null` si no se guardó. El backend es la fuente de verdad (A-D9).
 */
async function enviar(
  form: FormularioPaciente,
  guardar: (request: PacienteRequest) => Promise<Paciente>,
  isDisposed: () => boolean,
  onNoEncontrado: () => void,
): Promise<Paciente | null> {
  const controles = Object.values(form.campos);
  form.status.clear();
  clear(form.duplicado);
  const resultado = validarPaciente(form.leer(), hoyEnZona(Date.now()));
  applyFieldErrors(controles, resultado.ok ? {} : resultado.errors);
  if (!resultado.ok) return null;

  setBusy(form.element, form.submit, true);
  try {
    return await guardar(resultado.value);
  } catch (error) {
    if (isDisposed()) return null;
    if (esNoEncontrado(error)) {
      onNoEncontrado();
    } else if (esDniDuplicado(error)) {
      applyFieldErrors(controles, { dni: MSG_DNI_DUPLICADO });
      if (error.pacienteId !== null) {
        form.duplicado.append(h('a', { attrs: { href: `#/pacientes/${error.pacienteId}` } }, 'Ver paciente existente'));
      }
    } else {
      applyFieldErrors(controles, serverFieldErrors(error));
      form.status.show(mensajeDeError(error));
    }
    return null;
  } finally {
    if (!isDisposed()) setBusy(form.element, form.submit, false);
  }
}

/** Alta de paciente (C-12, D9/D11). Al crear, deja un aviso fijo y va al paciente. */
export function renderNuevoPaciente(ctx: PageContext): Page {
  let disposed = false;
  let ocupado = false;
  const form = crearFormulario('alta', 'Crear paciente', () => void onSubmit());
  const element = h(
    'section',
    { className: 'pagina-paciente' },
    h('h1', {}, TITULO_ALTA),
    h('p', {}, h('a', { attrs: { href: '#/pacientes' } }, 'Volver a la lista')),
    form.element,
  );

  async function onSubmit(): Promise<void> {
    if (ocupado) return;
    ocupado = true;
    try {
      const creado = await enviar(form, (r) => ctx.pacientes.crear(r), () => disposed, () => undefined);
      if (creado === null || disposed) return;
      ctx.flash.set(MSG_CREADO);
      ctx.navigate(`/pacientes/${creado.id}`);
    } finally {
      ocupado = false;
    }
  }

  return {
    title: TITULO_ALTA,
    element,
    dispose() {
      disposed = true;
    },
  };
}

/** Detalle y edición (C-12, D9/D11). `params.id` ya viene validado por el router. */
export function renderPaciente(ctx: PageContext, params: RouteParams): Page {
  const id = params['id'];
  const gestion = puedeDarDeBaja(rolActual(ctx));
  let disposed = false;
  let ocupado = false;
  let seq = 0;

  const estado = h('p', { className: 'estado', attrs: { role: 'status' } }, ctx.flash.consume() ?? '');
  const alerta = createFormStatus();
  const contenido = h('div', { className: 'contenido-paciente' });
  const element = h(
    'section',
    { className: 'pagina-paciente' },
    h('h1', {}, TITULO_EDICION),
    h('p', {}, h('a', { attrs: { href: '#/pacientes' } }, 'Volver a la lista')),
    estado,
    contenido,
  );

  function noEncontrado(): void {
    clear(contenido);
    contenido.append(h('p', {}, MSG_NO_ENCONTRADO));
  }

  function mostrar(paciente: Paciente): void {
    clear(contenido);
    if (!paciente.activo) {
      contenido.append(
        h(
          'div',
          { className: 'aviso' },
          h('p', {}, MSG_INACTIVO),
          gestion ? h('button', { attrs: { type: 'button' }, on: { click: () => void reactivar(paciente.id) } }, 'Reactivar') : null,
          alerta.element,
        ),
      );
    }
    const form = crearFormulario('edicion', 'Guardar cambios', () => void onSubmit(paciente.id, form));
    form.cargar(paciente);
    contenido.append(form.element);
  }

  async function onSubmit(pacienteId: number, form: FormularioPaciente): Promise<void> {
    if (ocupado) return;
    ocupado = true;
    estado.textContent = '';
    try {
      const guardado = await enviar(form, (r) => ctx.pacientes.editar(pacienteId, r), () => disposed, noEncontrado);
      if (guardado === null || disposed) return;
      form.cargar(guardado);
      estado.textContent = MSG_GUARDADO;
    } finally {
      ocupado = false;
    }
  }

  async function reactivar(pacienteId: number): Promise<void> {
    if (ocupado) return;
    ocupado = true;
    estado.textContent = '';
    alerta.clear();
    try {
      await ctx.pacientes.reactivar(pacienteId);
      if (disposed) return;
      estado.textContent = MSG_REACTIVADO;
      cargar();
    } catch (error) {
      if (disposed) return;
      if (esNoEncontrado(error)) noEncontrado();
      else alerta.show(mensajeDeError(error));
    } finally {
      ocupado = false;
    }
  }

  function cargar(): void {
    const mio = ++seq;
    clear(contenido);
    contenido.append(h('p', {}, MSG_CARGANDO));
    if (id === undefined) {
      noEncontrado();
      return;
    }
    ctx.pacientes.obtener(id).then(
      (paciente) => {
        if (disposed || mio !== seq) return;
        mostrar(paciente);
      },
      (error: unknown) => {
        if (disposed || mio !== seq) return;
        if (esNoEncontrado(error)) {
          noEncontrado();
          return;
        }
        clear(contenido);
        alerta.show(mensajeDeError(error));
        contenido.append(alerta.element, h('button', { attrs: { type: 'button' }, on: { click: () => cargar() } }, 'Reintentar'));
      },
    );
  }

  cargar();

  return {
    title: TITULO_EDICION,
    element,
    dispose() {
      disposed = true;
      clear(contenido);
    },
  };
}
