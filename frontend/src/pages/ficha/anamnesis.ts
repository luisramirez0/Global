import { ApiError } from '../../api/errors';
import type { Ficha, FichaRequest } from '../../api/types';
import {
  applyFieldErrors,
  createFormStatus,
  createSelectField,
  createTextAreaField,
  setBusy,
  type FormControl,
  type TextAreaField,
} from '../../components/form';
import { clear, h } from '../../utils/dom';
import { formatearFechaHora } from '../../utils/zonaHoraria';
import { MSG_CHECK_FIELDS, serverFieldErrors } from '../auth/messages';
import {
  CODIGO_FICHA_DESACTUALIZADA,
  MSG_CONFIRMAR_RECARGA,
  MSG_FICHA_ACTUALIZADA,
  MSG_FICHA_DESACTUALIZADA,
  MSG_FICHA_GUARDADA,
  MSG_SIN_DATO,
  mensajeDeError,
  tieneCodigo,
} from './mensajes';
import { CAMPOS_TEXTO_FICHA, EMBARAZO_OPCIONES, MAX_CAMPO_FICHA, validarFicha, type ValoresFicha } from './validacion';

/** Etiquetas de la anamnesis (D5). Los valores siempre se muestran como texto. */
export const ETIQUETAS_ANAMNESIS = {
  alergias: 'Alergias',
  medicacionActual: 'Medicación actual',
  antecedentesMedicos: 'Antecedentes médicos',
  enfermedadesRelevantes: 'Enfermedades relevantes',
  embarazo: 'Embarazo',
  motivoConsulta: 'Motivo de consulta',
  observaciones: 'Observaciones',
} as const;

export interface AnamnesisOpciones {
  ficha: Ficha;
  /** Paciente dado de baja (D6): sin formulario. */
  soloLectura: boolean;
  /** PUT de la ficha (reemplazo completo con la `version` leída). */
  guardar(request: FichaRequest): Promise<Ficha>;
  /** GET de la ficha; solo se usa con "Cargar la versión actual" (A-D5). */
  recargar(): Promise<Ficha>;
  /** Errores que decide la página (CONSENTIMIENTO_REQUERIDO, PACIENTE_INACTIVO). `true` si los manejó. */
  alError(error: unknown): boolean;
  /** Avisos de éxito (región `role="status"` de la página). */
  anunciar(mensaje: string): void;
}

export interface Anamnesis {
  readonly element: HTMLElement;
  /** Última ficha confirmada por el servidor (para re-renderizar sin volver a pedirla, D8). */
  actual(): Ficha;
  /** Deja de reaccionar a respuestas pendientes (la página se fue o se re-renderiza). */
  liberar(): void;
}

export function textoEmbarazo(valor: boolean | null): string {
  if (valor === null) return MSG_SIN_DATO;
  return valor ? 'Sí' : 'No';
}

function embarazoAValor(valor: boolean | null): string {
  if (valor === null) return '';
  return valor ? 'si' : 'no';
}

function actualizacion(ficha: Ficha): string {
  return ficha.actualizadaEn === null
    ? 'La ficha todavía no fue cargada.'
    : `Última actualización: ${formatearFechaHora(ficha.actualizadaEn)}`;
}

function vistaLectura(ficha: Ficha): HTMLElement {
  const filas: [string, string][] = [
    [ETIQUETAS_ANAMNESIS.alergias, ficha.alergias ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.medicacionActual, ficha.medicacionActual ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.antecedentesMedicos, ficha.antecedentesMedicos ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.enfermedadesRelevantes, ficha.enfermedadesRelevantes ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.embarazo, textoEmbarazo(ficha.embarazo)],
    [ETIQUETAS_ANAMNESIS.motivoConsulta, ficha.motivoConsulta ?? MSG_SIN_DATO],
    [ETIQUETAS_ANAMNESIS.observaciones, ficha.observaciones ?? MSG_SIN_DATO],
  ];
  return h(
    'dl',
    { className: 'anamnesis-lectura' },
    ...filas.flatMap(([dt, dd]) => [h('dt', {}, dt), h('dd', { className: 'texto-clinico' }, dd)]),
  );
}

/**
 * Anamnesis del paciente (C-12b, D5). Guarda con la `version` leída. Ante `409 FICHA_DESACTUALIZADA` (A-D5) lo escrito
 * se conserva y la `version` no cambia: recién "Cargar la versión actual", con confirmación, reemplaza el formulario.
 */
export function crearAnamnesis(opciones: AnamnesisOpciones): Anamnesis {
  let ficha = opciones.ficha;
  let liberada = false;
  const titulo = h('h2', { id: 'ficha-anamnesis-titulo' }, 'Anamnesis');
  const meta = h('p', { className: 'anamnesis-meta' }, actualizacion(ficha));
  const element = h('section', { className: 'anamnesis', attrs: { 'aria-labelledby': titulo.id } }, titulo, meta);

  if (opciones.soloLectura) {
    element.append(vistaLectura(ficha));
    return { element, actual: () => ficha, liberar: () => (liberada = true) };
  }

  /** Versión con la que se guarda: la leída o la última confirmada; nunca cambia por un 409. */
  let version = ficha.version;
  let ocupado = false;

  const area = (campo: (typeof CAMPOS_TEXTO_FICHA)[number]): TextAreaField =>
    createTextAreaField({ id: `anamnesis-${campo}`, name: campo, label: ETIQUETAS_ANAMNESIS[campo], maxLength: MAX_CAMPO_FICHA, rows: 3 });
  const textos: Record<(typeof CAMPOS_TEXTO_FICHA)[number], TextAreaField> = {
    alergias: area('alergias'),
    medicacionActual: area('medicacionActual'),
    antecedentesMedicos: area('antecedentesMedicos'),
    enfermedadesRelevantes: area('enfermedadesRelevantes'),
    motivoConsulta: area('motivoConsulta'),
    observaciones: area('observaciones'),
  };
  const embarazo = createSelectField({
    id: 'anamnesis-embarazo',
    name: 'embarazo',
    label: ETIQUETAS_ANAMNESIS.embarazo,
    options: EMBARAZO_OPCIONES,
  });
  const controles: FormControl[] = [...CAMPOS_TEXTO_FICHA.map((c) => textos[c]), embarazo];
  const status = createFormStatus();
  const conflicto = h('div', { className: 'conflicto' });
  const submit = h('button', { attrs: { type: 'submit' } }, 'Guardar ficha');
  const form = h(
    'form',
    {
      attrs: { novalidate: true },
      on: {
        submit: (event) => {
          event.preventDefault();
          void guardar();
        },
      },
    },
    ...CAMPOS_TEXTO_FICHA.map((c) => textos[c].element),
    embarazo.element,
    status.element,
    conflicto,
    h('div', { className: 'acciones-form' }, submit),
  );
  element.append(form);

  function cargar(f: Ficha): void {
    ficha = f;
    version = f.version;
    for (const campo of CAMPOS_TEXTO_FICHA) textos[campo].setValue(f[campo] ?? '');
    embarazo.setValue(embarazoAValor(f.embarazo));
    meta.textContent = actualizacion(f);
    applyFieldErrors(controles, {});
  }

  function leer(): ValoresFicha {
    return {
      alergias: textos.alergias.value(),
      medicacionActual: textos.medicacionActual.value(),
      antecedentesMedicos: textos.antecedentesMedicos.value(),
      enfermedadesRelevantes: textos.enfermedadesRelevantes.value(),
      embarazo: embarazo.value(),
      motivoConsulta: textos.motivoConsulta.value(),
      observaciones: textos.observaciones.value(),
    };
  }

  function sinConflicto(): void {
    clear(conflicto);
  }

  function mostrarConflicto(): void {
    clear(conflicto);
    conflicto.append(
      h('p', { className: 'aviso' }, MSG_FICHA_DESACTUALIZADA),
      h('button', { attrs: { type: 'button' }, on: { click: () => confirmarRecarga() } }, 'Cargar la versión actual'),
    );
  }

  function confirmarRecarga(): void {
    clear(conflicto);
    conflicto.append(
      h('p', { className: 'aviso' }, MSG_FICHA_DESACTUALIZADA),
      h('p', {}, MSG_CONFIRMAR_RECARGA),
      h('button', { attrs: { type: 'button' }, on: { click: () => void recargar() } }, 'Cargar y descartar mis cambios'),
      h('button', { attrs: { type: 'button' }, on: { click: () => mostrarConflicto() } }, 'Cancelar'),
    );
  }

  async function recargar(): Promise<void> {
    if (ocupado) return;
    ocupado = true;
    status.clear();
    try {
      const nueva = await opciones.recargar();
      if (liberada) return;
      cargar(nueva);
      sinConflicto();
      opciones.anunciar(MSG_FICHA_ACTUALIZADA);
    } catch (error) {
      if (liberada || opciones.alError(error)) return;
      status.show(mensajeDeError(error));
    } finally {
      ocupado = false;
    }
  }

  async function guardar(): Promise<void> {
    if (ocupado) return;
    status.clear();
    const resultado = validarFicha(leer(), version);
    applyFieldErrors(controles, resultado.ok ? {} : resultado.errors);
    if (!resultado.ok) return;
    ocupado = true;
    setBusy(form, submit, true);
    try {
      const guardada = await opciones.guardar(resultado.value);
      if (liberada) return;
      cargar(guardada);
      sinConflicto();
      opciones.anunciar(MSG_FICHA_GUARDADA);
    } catch (error) {
      if (liberada || opciones.alError(error)) return;
      if (tieneCodigo(error, CODIGO_FICHA_DESACTUALIZADA)) {
        // A-D5: no se toca lo escrito ni la versión hasta que la persona elija cargar la actual.
        mostrarConflicto();
      } else if (error instanceof ApiError && error.kind === 'validation') {
        applyFieldErrors(controles, serverFieldErrors(error));
        status.show(MSG_CHECK_FIELDS);
      } else {
        status.show(mensajeDeError(error));
      }
    } finally {
      ocupado = false;
      if (!liberada) setBusy(form, submit, false);
    }
  }

  cargar(ficha);

  return {
    element,
    actual: () => ficha,
    liberar: () => {
      liberada = true;
    },
  };
}
