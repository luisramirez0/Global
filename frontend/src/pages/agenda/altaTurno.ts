/**
 * Diálogo de alta de turno (design D2, D3, D7, D11 y D12 de C-13): paciente buscado, prestación, sillón, fecha,
 * hora y notas; rechazos con mensajes fijos y datos conservados; sobreturno con confirmación explícita como paso
 * del mismo diálogo; precarga desde el turno enfocado con aviso no bloqueante. Nada se envía sin que la persona
 * pulse "Confirmar" y `sobreturno: true` solo viaja después de "Confirmar sobreturno".
 */
import type { PacientesApi } from '../../api/pacientes';
import type { TurnosApi } from '../../api/turnos';
import type { Bloqueo, Horario, Prestacion, Sillon, Turno, TurnoCreateRequest } from '../../api/types';
import { crearBuscadorPaciente } from '../../components/agenda/buscadorPaciente';
import type { Dialogo, OpcionesDialogo } from '../../components/agenda/dialogo';
import { applyFieldErrors, createField, createSelectField, createTextAreaField, setBusy, type FormControl } from '../../components/form';
import { h } from '../../utils/dom';
import { serverFieldErrors } from '../auth/messages';
import { avisoHoraSugerida, type EntradaAviso, type Precarga } from './dominio/precarga';
import { admiteSobreturno, clasificarRechazo, requiereRecargaManual, type Rechazo } from './dominio/rechazos';
import { validarAltaTurno, type CampoAlta } from './dominio/validacion';
import { MSG_CONFIRMAR_SOBRETURNO, MSG_SOBRETURNO_ROL, mensajeAviso, mensajeRechazo } from './mensajes';

export interface DatosAvisoAlta {
  turnos: readonly Turno[];
  horarios: readonly Horario[];
  bloqueos: readonly Bloqueo[];
  minutosGrilla: number;
  /** Rango y sillón que cubren `turnos` (para no inventar ocupación). */
  cobertura: NonNullable<EntradaAviso['cobertura']>;
}

export interface OpcionesAlta {
  crear: TurnosApi['crear'];
  buscarPacientes: PacientesApi['buscar'];
  /** Sillones activos elegibles. */
  sillones: readonly Sillon[];
  /** Prestaciones activas elegibles. */
  prestaciones: readonly Prestacion[];
  precarga: Precarga;
  /** Precargada desde un turno enfocado: muestra el aviso de la hora sugerida. */
  conAviso: boolean;
  datosAviso(): DatosAvisoAlta;
  /** `puedeOfrecerSobreturno(rol)` (DP-2). */
  puedeOfrecerSobreturno: boolean;
  opener: HTMLElement;
  /** Abre el diálogo respetando "un solo diálogo a la vez"; `null` si ya hay uno. */
  abrir(opciones: OpcionesDialogo): Dialogo | null;
  alCrear(turno: Turno): void;
  /** "Recargar agenda": la persona decide; la página cierra y vuelve a pedir el rango. */
  alRecargar(): void;
}

/** El servidor nombra `inicio` al campo que la UI separa en fecha y hora. */
function aCampoDeFormulario(errores: Readonly<Record<string, string>>): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const [campo, mensaje] of Object.entries(errores)) {
    resultado[campo === 'inicio' ? 'hora' : campo] ??= mensaje;
  }
  return resultado;
}

/** Rechazos cuyo mensaje se asocia también al campo hora (conflicto de horario). */
function esDeHorario(rechazo: Rechazo): boolean {
  return rechazo.tipo === 'sillon' || rechazo.tipo === 'profesional' || rechazo.tipo === 'fueraDeAgenda' || rechazo.tipo === 'bloqueo';
}

export function abrirAltaTurno(opciones: OpcionesAlta): Dialogo | null {
  let cerrado = false;
  let ocupado = false;
  /** Cuerpo validado del último envío: el sobreturno reenvía exactamente este. */
  let ultimoCuerpo: TurnoCreateRequest | null = null;
  let asociarAlertaAHora = false;

  const buscador = crearBuscadorPaciente({ buscar: opciones.buscarPacientes });
  const prestacion = createSelectField({
    id: 'alta-prestacion',
    name: 'prestacionId',
    label: 'Prestación',
    options: [{ value: '', label: 'Elegí una prestación' }, ...opciones.prestaciones.map((p) => ({ value: String(p.id), label: `${p.nombre} (${p.duracionMinutos} min)` }))],
  });
  const sillon = createSelectField({
    id: 'alta-sillon',
    name: 'sillonId',
    label: 'Sillón',
    options: [{ value: '', label: 'Elegí un sillón' }, ...opciones.sillones.map((s) => ({ value: String(s.id), label: s.nombre }))],
  });
  const fecha = createField({ id: 'alta-fecha', name: 'fecha', label: 'Fecha', type: 'date', autocomplete: 'off', required: true });
  const hora = createField({ id: 'alta-hora', name: 'hora', label: 'Hora', type: 'time', autocomplete: 'off', required: true });
  const notas = createTextAreaField({ id: 'alta-notas', name: 'notas', label: 'Notas (opcional)' });
  const aviso = h('p', { id: 'alta-aviso-hora', className: 'aviso-hora' });
  hora.element.append(aviso);
  const alerta = h('div', { id: 'alta-alerta', className: 'alerta alerta-alta', attrs: { role: 'alert' } });
  const accionesRechazo = h('div', { className: 'acciones-rechazo' });
  const enviarBtn = h('button', { attrs: { type: 'submit' } }, 'Confirmar');

  const controles: readonly FormControl[] = [buscador, prestacion, sillon, fecha, hora, notas];

  fecha.setValue(opciones.precarga.fecha);
  hora.setValue(opciones.precarga.hora);
  if (opciones.precarga.sillonId !== null && opciones.sillones.some((s) => s.id === opciones.precarga.sillonId)) {
    sillon.setValue(String(opciones.precarga.sillonId));
  }

  const formulario = h(
    'form',
    { attrs: { novalidate: true }, on: { submit: (event) => void alEnviar(event) } },
    buscador.element,
    prestacion.element,
    sillon.element,
    fecha.element,
    hora.element,
    notas.element,
    alerta,
    accionesRechazo,
    h('div', { className: 'acciones-form' }, enviarBtn),
  );

  let dialogo: Dialogo | null = null;

  /* -------------------- hora: error, alerta de conflicto y aviso -------------------- */

  function describirHora(): void {
    const errorPropio = hora.element.querySelector('.error-campo');
    const ids: string[] = [];
    if (errorPropio !== null && errorPropio.textContent !== '') ids.push(errorPropio.id);
    if (asociarAlertaAHora) ids.push(alerta.id);
    if (aviso.textContent !== '') ids.push(aviso.id);
    if (ids.length > 0) hora.input.setAttribute('aria-describedby', ids.join(' '));
    else hora.input.removeAttribute('aria-describedby');
    if ((errorPropio !== null && errorPropio.textContent !== '') || asociarAlertaAHora) hora.input.setAttribute('aria-invalid', 'true');
    else hora.input.removeAttribute('aria-invalid');
  }

  function refrescarAviso(): void {
    if (!opciones.conAviso) return;
    const datos = opciones.datosAviso();
    const id = Number(prestacion.value());
    const elegida = opciones.prestaciones.find((p) => p.id === id) ?? null;
    const sillonId = sillon.value() === '' ? null : Number(sillon.value());
    const resultado = avisoHoraSugerida({
      fecha: fecha.value(),
      hora: hora.value(),
      sillonId,
      prestacion: elegida,
      turnos: datos.turnos,
      horarios: datos.horarios,
      bloqueos: datos.bloqueos,
      minutosGrilla: datos.minutosGrilla,
      cobertura: datos.cobertura,
    });
    aviso.textContent = resultado === null ? '' : mensajeAviso(resultado);
    describirHora();
  }
  for (const campo of [fecha.input, hora.input]) campo.addEventListener('input', refrescarAviso);
  for (const campo of [prestacion.select, sillon.select]) campo.addEventListener('change', refrescarAviso);

  /* ------------------------------- mensajes ------------------------------- */

  function limpiarRechazo(): void {
    alerta.replaceChildren();
    accionesRechazo.replaceChildren();
    asociarAlertaAHora = false;
    applyFieldErrors(controles, {});
    describirHora();
  }

  function mostrarRechazo(rechazo: Rechazo, error: unknown, fueSobreturno: boolean): void {
    const mensajes = [h('p', {}, mensajeRechazo(rechazo))];
    const acciones: HTMLElement[] = [];
    if (admiteSobreturno(rechazo) && !fueSobreturno) {
      if (opciones.puedeOfrecerSobreturno) {
        acciones.push(h('button', { attrs: { type: 'button' }, on: { click: () => pedirConfirmacion() } }, 'Agendar como sobreturno'));
      } else {
        mensajes.push(h('p', {}, MSG_SOBRETURNO_ROL));
      }
    }
    if (requiereRecargaManual(rechazo)) {
      acciones.push(h('button', { attrs: { type: 'button' }, on: { click: () => recargar() } }, 'Recargar agenda'));
    }
    alerta.replaceChildren(...mensajes);
    accionesRechazo.replaceChildren(...acciones);
    asociarAlertaAHora = esDeHorario(rechazo);
    if (rechazo.tipo === 'campos') applyFieldErrors(controles, aCampoDeFormulario(serverFieldErrors(error)));
    describirHora();
    if (asociarAlertaAHora && fueSobreturno) hora.focus();
  }

  /* -------------------------------- envío -------------------------------- */

  function recargar(): void {
    if (!cerrado) dialogo?.cerrar({ devolverFoco: false });
    opciones.alRecargar();
  }

  async function enviar(cuerpo: TurnoCreateRequest, fueSobreturno: boolean): Promise<void> {
    if (ocupado) return;
    ocupado = true;
    setBusy(formulario, enviarBtn, true);
    try {
      const turno = await opciones.crear(cuerpo);
      // La creación ocurrió en el servidor aunque el diálogo ya no esté: la página decide si todavía importa.
      if (!cerrado) dialogo?.cerrar();
      opciones.alCrear(turno);
    } catch (error) {
      if (cerrado) return;
      if (fueSobreturno) volverAlFormulario();
      mostrarRechazo(clasificarRechazo(error, { accion: 'alta' }), error, fueSobreturno);
    } finally {
      ocupado = false;
      if (!cerrado) setBusy(formulario, enviarBtn, false);
    }
  }

  async function alEnviar(event: Event): Promise<void> {
    event.preventDefault();
    if (ocupado) return;
    limpiarRechazo();
    const resultado = validarAltaTurno({
      pacienteId: buscador.valor(),
      prestacionId: prestacion.value(),
      sillonId: sillon.value(),
      fecha: fecha.value(),
      hora: hora.value(),
      notas: notas.value(),
    });
    if (!resultado.ok) {
      const errores: Partial<Record<CampoAlta | 'pacienteId', string>> = resultado.errors;
      applyFieldErrors(controles, errores);
      describirHora();
      return;
    }
    ultimoCuerpo = resultado.value;
    await enviar(resultado.value, false);
  }

  /* ------------------------------- sobreturno ------------------------------- */

  function volverAlFormulario(): void {
    dialogo?.reemplazar('Nuevo turno', [formulario], () => hora.input);
  }

  function pedirConfirmacion(): void {
    if (ultimoCuerpo === null || dialogo === null) return;
    const cuerpo = ultimoCuerpo;
    const confirmarBtn = h('button', { attrs: { type: 'button' } }, 'Confirmar sobreturno');
    confirmarBtn.addEventListener('click', () => {
      if (ocupado) return;
      confirmarBtn.disabled = true;
      void enviar({ ...cuerpo, sobreturno: true }, true).finally(() => {
        confirmarBtn.disabled = false;
      });
    });
    const volver = h('button', { attrs: { type: 'button' }, on: { click: () => volverAlFormulario() } }, 'Volver');
    dialogo.reemplazar('Confirmar sobreturno', [h('p', {}, MSG_CONFIRMAR_SOBRETURNO), h('div', { className: 'acciones-form' }, confirmarBtn, volver)], () => confirmarBtn);
  }

  /* --------------------------------- apertura -------------------------------- */

  dialogo = opciones.abrir({
    titulo: 'Nuevo turno',
    contenido: [formulario],
    opener: opciones.opener,
    alCerrar: () => {
      cerrado = true;
    },
  });
  if (dialogo === null) return null;
  refrescarAviso();
  return dialogo;
}

