import { ApiError } from '../../api/errors';
import type { Consentimiento, TextoConsentimiento } from '../../api/types';
import { createFormStatus, setBusy } from '../../components/form';
import type { Page, RouteParams } from '../../router/router';
import { clear, h } from '../../utils/dom';
import { formatearFechaHora } from '../../utils/zonaHoraria';
import type { PageContext } from '../context';
import { crearAnamnesis } from './anamnesis';
import {
  CODIGO_CONSENTIMIENTO_REQUERIDO,
  MSG_CARGANDO,
  MSG_CONSENTIMIENTO_OK,
  MSG_CONSENTIMIENTO_REQUERIDO,
  MSG_PACIENTE_NO_ENCONTRADO,
  MSG_SIN_TEXTO_VIGENTE,
  MSG_TEXTO_CAMBIO,
  TITULO_FICHA,
  esNoEncontrado,
  mensajeDeError,
  tieneCodigo,
} from './mensajes';
import { NOTAS_POR_PAGINA, crearNotas } from './notas';
import { validarAceptacion } from './validacion';

/**
 * Ficha clínica del paciente (C-12b, design D4–D8). Bloqueo por consentimiento (RN-DS-03): mientras el paciente no
 * tenga un consentimiento registrado, la anamnesis y las notas **no se crean en el DOM** y tampoco se piden (cada
 * lectura queda auditada, RN-DS-02). Los datos clínicos viven solo en esta página; `dispose` los suelta.
 */
export function renderFicha(ctx: PageContext, params: RouteParams): Page {
  const id = params['id'];
  let disposed = false;
  /** Generación: sube al recargar o al bloquear, para descartar respuestas de un estado anterior. */
  let gen = 0;

  const encabezado = h('p', { className: 'encabezado-paciente' });
  const estado = h('p', { className: 'estado', attrs: { role: 'status' } });
  const alerta = createFormStatus();
  const cuerpo = h('div', { className: 'cuerpo-ficha' });
  const element = h(
    'section',
    { className: 'pagina-ficha' },
    h('h1', {}, TITULO_FICHA),
    id === undefined ? null : h('p', {}, h('a', { attrs: { href: `#/pacientes/${id}` } }, 'Volver al paciente')),
    encabezado,
    estado,
    alerta.element,
    cuerpo,
  );

  function vigente(mia: number): boolean {
    return !disposed && mia === gen;
  }

  function cargando(contenedor: HTMLElement): void {
    clear(contenedor);
    contenedor.append(h('p', {}, MSG_CARGANDO));
  }

  function reintentable(contenedor: HTMLElement, error: unknown, reintentar: () => void): void {
    clear(contenedor);
    alerta.show(mensajeDeError(error));
    contenedor.append(h('button', { attrs: { type: 'button' }, on: { click: reintentar } }, 'Reintentar'));
  }

  /* Inicio: paciente (encabezado) y consentimientos. */

  function iniciar(): void {
    const mia = ++gen;
    alerta.clear();
    cargando(cuerpo);
    if (id === undefined) {
      noEncontrado();
      return;
    }
    Promise.all([ctx.pacientes.obtener(id), ctx.ficha.listarConsentimientos(id)]).then(
      ([p, consentimientos]) => {
        if (!vigente(mia)) return;
        encabezado.textContent = `${p.apellido}, ${p.nombre} · DNI ${p.dni}`;
        const [masReciente] = consentimientos;
        if (masReciente === undefined) sinConsentimiento();
        else conConsentimiento(masReciente);
      },
      (error: unknown) => {
        if (!vigente(mia)) return;
        if (esNoEncontrado(error)) noEncontrado();
        else reintentable(cuerpo, error, iniciar);
      },
    );
  }

  function noEncontrado(): void {
    gen++;
    clear(cuerpo);
    cuerpo.append(h('p', {}, MSG_PACIENTE_NO_ENCONTRADO));
  }

  /* Sin consentimiento: texto vigente, casilla obligatoria y registro (D4). */

  function sinConsentimiento(): void {
    const mia = ++gen;
    cargando(cuerpo);
    ctx.ficha.textoVigente().then(
      (texto) => {
        if (vigente(mia)) pintarConsentimiento(texto);
      },
      (error: unknown) => {
        if (!vigente(mia)) return;
        if (esNoEncontrado(error)) {
          clear(cuerpo);
          cuerpo.append(h('p', { className: 'aviso' }, MSG_SIN_TEXTO_VIGENTE));
        } else {
          reintentable(cuerpo, error, sinConsentimiento);
        }
      },
    );
  }

  function pintarConsentimiento(texto: TextoConsentimiento): void {
    const pacienteId = id;
    if (pacienteId === undefined) return;
    let ocupado = false;
    const titulo = h('h2', { id: 'ficha-consentimiento-titulo' }, 'Consentimiento de datos de salud');
    const error = h('p', { id: 'ficha-aceptado-error', className: 'error-campo' });
    const aceptado = h('input', { id: 'ficha-aceptado', attrs: { type: 'checkbox', name: 'aceptado', required: true } });
    const boton = h('button', { attrs: { type: 'submit', disabled: true } }, 'Registrar consentimiento');
    aceptado.addEventListener('change', () => {
      boton.disabled = !aceptado.checked;
      if (aceptado.checked) marcarError(null);
    });

    function marcarError(mensaje: string | null): void {
      error.textContent = mensaje ?? '';
      if (mensaje === null) {
        aceptado.removeAttribute('aria-invalid');
        aceptado.removeAttribute('aria-describedby');
      } else {
        aceptado.setAttribute('aria-invalid', 'true');
        aceptado.setAttribute('aria-describedby', error.id);
      }
    }

    const form = h(
      'form',
      {
        attrs: { novalidate: true },
        on: {
          submit: (event) => {
            event.preventDefault();
            void registrar();
          },
        },
      },
      h(
        'div',
        { className: 'campo campo-casilla' },
        aceptado,
        h('label', { attrs: { for: aceptado.id } }, `El paciente leyó y aceptó el texto de consentimiento (versión ${texto.version})`),
        error,
      ),
      h('div', { className: 'acciones-form' }, boton),
    );

    async function registrar(): Promise<void> {
      if (ocupado || pacienteId === undefined) return;
      const falta = validarAceptacion(aceptado.checked);
      marcarError(falta);
      if (falta !== null) {
        aceptado.focus();
        return;
      }
      ocupado = true;
      const mia = gen;
      alerta.clear();
      setBusy(form, boton, true);
      try {
        // La versión es la que mandó el servidor, nunca un valor tipeado (D4).
        const consentimiento = await ctx.ficha.registrarConsentimiento(pacienteId, texto.version);
        if (!vigente(mia)) return;
        estado.textContent = MSG_CONSENTIMIENTO_OK;
        conConsentimiento(consentimiento);
      } catch (e) {
        if (!vigente(mia)) return;
        if (e instanceof ApiError && e.status === 400) {
          // El texto ya no está vigente: se vuelve a pedir y la persona lo revisa de nuevo.
          sinConsentimiento();
          alerta.show(MSG_TEXTO_CAMBIO);
        } else if (esNoEncontrado(e)) {
          noEncontrado();
        } else {
          alerta.show(mensajeDeError(e));
          setBusy(form, boton, false);
          boton.disabled = !aceptado.checked;
        }
      } finally {
        ocupado = false;
      }
    }

    clear(cuerpo);
    cuerpo.append(
      h(
        'section',
        { className: 'consentimiento', attrs: { 'aria-labelledby': titulo.id } },
        titulo,
        h('p', {}, `Versión ${texto.version}`),
        h('div', { className: 'texto-consentimiento' }, texto.contenido),
        form,
      ),
    );
  }

  /* Con consentimiento: recién ahora se piden la ficha y las notas. */

  function conConsentimiento(consentimiento: Consentimiento): void {
    const mia = ++gen;
    const clinico = h('div', { className: 'clinico' });
    clear(cuerpo);
    cuerpo.append(
      h(
        'p',
        { className: 'consentimiento-ok' },
        `Consentimiento registrado el ${formatearFechaHora(consentimiento.aceptadoEn)} (versión ${consentimiento.versionTexto}).`,
      ),
      clinico,
    );
    cargarClinico(clinico, mia);
  }

  function cargarClinico(clinico: HTMLElement, mia: number): void {
    const pacienteId = id;
    if (pacienteId === undefined) return;
    cargando(clinico);
    Promise.all([ctx.ficha.obtenerFicha(pacienteId), ctx.ficha.listarNotas(pacienteId, 0, NOTAS_POR_PAGINA)]).then(
      ([ficha, notas]) => {
        if (!vigente(mia)) return;
        clear(clinico);
        clinico.append(crearAnamnesis({ ficha }).element, crearNotas({ inicial: notas }).element);
      },
      (error: unknown) => {
        if (!vigente(mia)) return;
        if (tieneCodigo(error, CODIGO_CONSENTIMIENTO_REQUERIDO)) bloquear();
        else reintentable(clinico, error, () => cargarClinico(clinico, mia));
      },
    );
  }

  /** 409 CONSENTIMIENTO_REQUERIDO (p. ej. una carrera): se descartan los datos clínicos y se vuelve al bloqueo. */
  function bloquear(): void {
    clear(cuerpo);
    sinConsentimiento();
    alerta.show(MSG_CONSENTIMIENTO_REQUERIDO);
  }

  iniciar();

  return {
    title: TITULO_FICHA,
    element,
    dispose() {
      disposed = true;
      clear(cuerpo);
      encabezado.textContent = '';
    },
  };
}
