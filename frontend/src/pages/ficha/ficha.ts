import { ApiError } from '../../api/errors';
import type { Consentimiento, Ficha, Nota, Pagina, TextoConsentimiento } from '../../api/types';
import { createFormStatus, setBusy } from '../../components/form';
import type { Page, RouteParams } from '../../router/router';
import { clear, h } from '../../utils/dom';
import { formatearFechaHora } from '../../utils/zonaHoraria';
import type { PageContext } from '../context';
import { puedeVerFicha, rolActual } from '../permisos';
import { crearAnamnesis, type Anamnesis } from './anamnesis';
import {
  CODIGO_CONSENTIMIENTO_REQUERIDO,
  CODIGO_PACIENTE_INACTIVO,
  MSG_CARGANDO,
  MSG_CONSENTIMIENTO_OK,
  MSG_CONSENTIMIENTO_REQUERIDO,
  MSG_INACTIVO,
  MSG_PACIENTE_NO_ENCONTRADO,
  MSG_SIN_CONSENTIMIENTO,
  MSG_SIN_PERMISO_FICHA,
  MSG_SIN_TEXTO_VIGENTE,
  MSG_TEXTO_CAMBIO,
  TITULO_FICHA,
  esNoEncontrado,
  mensajeDeError,
  tieneCodigo,
} from './mensajes';
import { NOTAS_POR_PAGINA, crearNotas, type Notas } from './notas';
import { validarAceptacion, type ValoresFicha } from './validacion';

/**
 * Ficha clínica del paciente (C-12b, design D4–D8). Bloqueo por consentimiento (RN-DS-03): mientras el paciente no
 * tenga un consentimiento registrado, la anamnesis y las notas **no se crean en el DOM** y tampoco se piden (cada
 * lectura queda auditada, RN-DS-02). Los datos clínicos viven solo en esta página; `dispose` los suelta.
 */
export function renderFicha(ctx: PageContext, params: RouteParams): Page {
  // D2 / PA-07: sin permiso (RECEPCION o sin perfil) no se pide NADA, ni siquiera el paciente.
  if (!puedeVerFicha(rolActual(ctx))) {
    return {
      title: TITULO_FICHA,
      element: h('section', { className: 'pagina-ficha' }, h('h1', {}, TITULO_FICHA), h('p', { className: 'aviso' }, MSG_SIN_PERMISO_FICHA)),
    };
  }
  const id = params['id'];
  let disposed = false;
  /** Generación: sube al recargar o al bloquear, para descartar respuestas de un estado anterior. */
  let gen = 0;
  let anamnesis: Anamnesis | null = null;
  let notasClinicas: Notas | null = null;
  /** Paciente dado de baja (D6): la historia clínica se lee pero no se escribe. */
  let activo = true;
  let consentimientoActual: Consentimiento | null = null;

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
        activo = p.activo;
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

  function avisoInactivo(): HTMLElement {
    return h('p', { className: 'aviso solo-lectura' }, MSG_INACTIVO);
  }

  function sinConsentimiento(): void {
    const mia = ++gen;
    if (!activo) {
      // D6: dado de baja no se registra consentimiento; sin él no hay nada clínico que mostrar.
      clear(cuerpo);
      cuerpo.append(avisoInactivo(), h('p', {}, MSG_SIN_CONSENTIMIENTO));
      return;
    }
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
        } else if (tieneCodigo(e, CODIGO_PACIENTE_INACTIVO)) {
          activo = false;
          sinConsentimiento();
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

  /** Aviso de baja (si corresponde), línea del consentimiento y contenedor de lo clínico. */
  function cabeceraClinica(consentimiento: Consentimiento): HTMLElement {
    consentimientoActual = consentimiento;
    const clinico = h('div', { className: 'clinico' });
    clear(cuerpo);
    cuerpo.append(
      activo ? '' : avisoInactivo(),
      h(
        'p',
        { className: 'consentimiento-ok' },
        `Consentimiento registrado el ${formatearFechaHora(consentimiento.aceptadoEn)} (versión ${consentimiento.versionTexto}).`,
      ),
      clinico,
    );
    return clinico;
  }

  function conConsentimiento(consentimiento: Consentimiento): void {
    const mia = ++gen;
    cargarClinico(cabeceraClinica(consentimiento), mia);
  }

  function cargarClinico(clinico: HTMLElement, mia: number): void {
    const pacienteId = id;
    if (pacienteId === undefined) return;
    cargando(clinico);
    Promise.all([ctx.ficha.obtenerFicha(pacienteId), ctx.ficha.listarNotas(pacienteId, 0, NOTAS_POR_PAGINA)]).then(
      ([ficha, notas]) => {
        if (vigente(mia)) pintarClinico(clinico, pacienteId, ficha, notas);
      },
      (error: unknown) => {
        if (!vigente(mia)) return;
        if (tieneCodigo(error, CODIGO_CONSENTIMIENTO_REQUERIDO)) bloquear();
        else reintentable(clinico, error, () => cargarClinico(clinico, mia));
      },
    );
  }

  /** Crea anamnesis y notas; en solo lectura si el paciente está dado de baja (D6). */
  function pintarClinico(
    clinico: HTMLElement,
    pacienteId: number,
    ficha: Ficha,
    notas: Pagina<Nota>,
    sinGuardar: { ficha: ValoresFicha | null; nota: string } = { ficha: null, nota: '' },
  ): void {
    clear(clinico);
    liberarClinico();
    const anunciar = (mensaje: string): void => {
      alerta.clear();
      estado.textContent = mensaje;
    };
    anamnesis = crearAnamnesis({
      ficha,
      soloLectura: !activo,
      sinGuardar: sinGuardar.ficha,
      guardar: (request) => ctx.ficha.guardarFicha(pacienteId, request),
      recargar: () => ctx.ficha.obtenerFicha(pacienteId),
      alError: errorClinico,
      anunciar,
    });
    notasClinicas = crearNotas({
      inicial: notas,
      soloLectura: !activo,
      sinGuardar: sinGuardar.nota,
      listar: (page) => ctx.ficha.listarNotas(pacienteId, page, NOTAS_POR_PAGINA),
      crear: (texto) => ctx.ficha.crearNota(pacienteId, texto),
      alError: errorClinico,
      anunciar,
    });
    clinico.append(anamnesis.element, notasClinicas.element);
  }

  function liberarClinico(): void {
    anamnesis?.liberar();
    notasClinicas?.liberar();
    anamnesis = null;
    notasClinicas = null;
  }

  /** Errores de escritura o lectura clínica que cambian el estado de toda la página. `true` si los manejó. */
  function errorClinico(error: unknown): boolean {
    if (tieneCodigo(error, CODIGO_CONSENTIMIENTO_REQUERIDO)) {
      bloquear();
      return true;
    }
    if (tieneCodigo(error, CODIGO_PACIENTE_INACTIVO)) {
      pasarASoloLectura();
      return true;
    }
    return false;
  }

  /**
   * 409 PACIENTE_INACTIVO en una escritura (baja concurrente, D6): se re-pinta en solo lectura con lo que ya está en
   * memoria (última ficha confirmada y notas cargadas), sin volver a pedirlo (D8). Lo escrito sin guardar NO se
   * descarta: queda visible como texto con "No se pudo guardar: el paciente fue dado de baja." (D6, 2026-11-25).
   */
  function pasarASoloLectura(): void {
    activo = false;
    const ficha = anamnesis?.actual();
    const notas = notasClinicas?.estado();
    const sinGuardar = { ficha: anamnesis?.escrito() ?? null, nota: notasClinicas?.escrito() ?? '' };
    const consentimiento = consentimientoActual;
    if (id === undefined || ficha === undefined || notas === undefined || consentimiento === null) {
      iniciar();
      return;
    }
    gen++;
    estado.textContent = '';
    alerta.clear();
    pintarClinico(cabeceraClinica(consentimiento), id, ficha, notas, sinGuardar);
  }

  /** 409 CONSENTIMIENTO_REQUERIDO (p. ej. una carrera): se descartan los datos clínicos y se vuelve al bloqueo. */
  function bloquear(): void {
    liberarClinico();
    estado.textContent = '';
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
      liberarClinico();
      clear(cuerpo);
      encabezado.textContent = '';
    },
  };
}
