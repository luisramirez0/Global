/**
 * Paso "Reprogramar" del diálogo de un turno (design D3, D8 y D11 de C-13): formulario con fecha, hora y sillón
 * precargados, rechazos con mensajes fijos y datos conservados, sobreturno con confirmación (DP-2) y "Recargar
 * agenda" manual. Envía `inicio` siempre y `sillonId` solo si cambió; nunca `profesionalId`, y `sobreturno: true`
 * solo después de "Confirmar sobreturno".
 */
import type { TurnosApi } from '../../api/turnos';
import type { Sillon, Turno, TurnoReprogramarRequest } from '../../api/types';
import type { Dialogo } from '../../components/agenda/dialogo';
import { applyFieldErrors, createField, createSelectField, setBusy, type FormControl } from '../../components/form';
import { h } from '../../utils/dom';
import { aFechaHoraLocal } from '../../utils/zonaHoraria';
import { serverFieldErrors } from '../auth/messages';
import { clasificarRechazo } from './dominio/rechazos';
import { validarReprogramacion } from './dominio/validacion';
import { MSG_CONFIRMAR_SOBRETURNO } from './mensajes';
import { crearZonaRechazo } from './zonaRechazo';

export interface OpcionesReprogramar {
  turno: Turno;
  /** Sillones activos elegibles; el actual se agrega aunque esté inactivo. */
  sillones: readonly Sillon[];
  nombreSillon(id: number): string;
  reprogramar: TurnosApi['reprogramar'];
  puedeOfrecerSobreturno: boolean;
  dialogo(): Dialogo;
  /** El diálogo ya se cerró (Escape o página cerrada): no se toca más su contenido. */
  cerrado(): boolean;
  alVolver(): void;
  /** Éxito: el diálogo ya se cerró; `sillonCambio` indica si se movió de sillón. */
  alExito(turno: Turno, sillonCambio: boolean): void;
  alRecargar(): void;
}

export interface PasoReprogramar {
  readonly titulo: string;
  readonly contenido: readonly Node[];
  foco(): HTMLElement;
}

export function crearPasoReprogramar(opciones: OpcionesReprogramar): PasoReprogramar {
  const { turno } = opciones;
  const inicio = aFechaHoraLocal(turno.inicio);
  let ocupado = false;
  let ultimoCuerpo: TurnoReprogramarRequest | null = null;

  const fecha = createField({ id: 'reprogramar-fecha', name: 'fecha', label: 'Fecha', type: 'date', autocomplete: 'off', required: true });
  const hora = createField({ id: 'reprogramar-hora', name: 'hora', label: 'Hora', type: 'time', autocomplete: 'off', required: true });
  const ids = opciones.sillones.map((s) => s.id);
  if (!ids.includes(turno.sillonId)) ids.push(turno.sillonId);
  const sillon = createSelectField({
    id: 'reprogramar-sillon',
    name: 'sillonId',
    label: 'Sillón',
    options: ids.map((id) => ({ value: String(id), label: opciones.nombreSillon(id) })),
  });
  fecha.setValue(inicio?.fecha ?? '');
  hora.setValue(inicio?.hora ?? '');
  sillon.setValue(String(turno.sillonId));

  const controles: readonly FormControl[] = [fecha, hora, sillon];
  const zona = crearZonaRechazo({
    puedeOfrecerSobreturno: opciones.puedeOfrecerSobreturno,
    alPedirSobreturno: () => pedirConfirmacion(),
    alRecargar: () => opciones.alRecargar(),
  });
  zona.alerta.id = 'reprogramar-alerta';
  const enviarBtn = h('button', { attrs: { type: 'submit' } }, 'Confirmar reprogramación');
  const volver = h('button', { attrs: { type: 'button' }, on: { click: () => opciones.alVolver() } }, 'Volver');
  const formulario = h(
    'form',
    { attrs: { novalidate: true }, on: { submit: (event) => void alEnviar(event) } },
    fecha.element,
    hora.element,
    sillon.element,
    zona.alerta,
    zona.acciones,
    h('div', { className: 'acciones-form' }, enviarBtn, volver),
  );

  /** El mensaje de un conflicto de horario se asocia también al campo hora. */
  function describirHora(): void {
    const propio = hora.element.querySelector('.error-campo');
    const ids2: string[] = [];
    if (propio !== null && propio.textContent !== '') ids2.push(propio.id);
    if (zona.esDeHorario()) ids2.push(zona.alerta.id);
    if (ids2.length > 0) {
      hora.input.setAttribute('aria-describedby', ids2.join(' '));
      hora.input.setAttribute('aria-invalid', 'true');
    } else {
      hora.input.removeAttribute('aria-describedby');
      hora.input.removeAttribute('aria-invalid');
    }
  }

  function volverAlFormulario(): void {
    opciones.dialogo().reemplazar('Reprogramar turno', [formulario], () => hora.input);
  }

  async function enviar(cuerpo: TurnoReprogramarRequest, fueSobreturno: boolean): Promise<void> {
    if (ocupado) return;
    ocupado = true;
    setBusy(formulario, enviarBtn, true);
    try {
      const respuesta = await opciones.reprogramar(turno.id, cuerpo);
      if (!opciones.cerrado()) opciones.dialogo().cerrar({ devolverFoco: false });
      opciones.alExito(respuesta, cuerpo.sillonId !== undefined);
    } catch (error) {
      if (opciones.cerrado()) return;
      if (fueSobreturno) volverAlFormulario();
      const rechazo = clasificarRechazo(error, { accion: 'reprogramar' });
      zona.mostrar(rechazo, fueSobreturno);
      if (rechazo.tipo === 'campos') {
        const errores: Record<string, string> = {};
        for (const [campo, mensaje] of Object.entries(serverFieldErrors(error))) errores[campo === 'inicio' ? 'hora' : campo] ??= mensaje;
        applyFieldErrors(controles, errores);
      }
      describirHora();
      if (fueSobreturno) hora.focus();
    } finally {
      ocupado = false;
      if (!opciones.cerrado()) setBusy(formulario, enviarBtn, false);
    }
  }

  async function alEnviar(event: Event): Promise<void> {
    event.preventDefault();
    if (ocupado) return;
    zona.limpiar();
    applyFieldErrors(controles, {});
    describirHora();
    const resultado = validarReprogramacion({
      fecha: fecha.value(),
      hora: hora.value(),
      sillonId: sillon.value(),
      sillonActualId: turno.sillonId,
    });
    if (!resultado.ok) {
      applyFieldErrors(controles, resultado.errors);
      return;
    }
    ultimoCuerpo = resultado.value;
    await enviar(resultado.value, false);
  }

  function pedirConfirmacion(): void {
    if (ultimoCuerpo === null) return;
    const cuerpo = ultimoCuerpo;
    const confirmarBtn = h('button', { attrs: { type: 'button' } }, 'Confirmar sobreturno');
    confirmarBtn.addEventListener('click', () => {
      if (ocupado) return;
      confirmarBtn.disabled = true;
      void enviar({ ...cuerpo, sobreturno: true }, true).finally(() => {
        confirmarBtn.disabled = false;
      });
    });
    const atras = h('button', { attrs: { type: 'button' }, on: { click: () => volverAlFormulario() } }, 'Volver');
    opciones
      .dialogo()
      .reemplazar('Confirmar sobreturno', [h('p', {}, MSG_CONFIRMAR_SOBRETURNO), h('div', { className: 'acciones-form' }, confirmarBtn, atras)], () => confirmarBtn);
  }

  return { titulo: 'Reprogramar turno', contenido: [formulario], foco: () => fecha.input };
}
