import { describe, expect, it } from 'vitest';
import { CONFLICTO_PROFESIONAL, CONFLICTO_SILLON } from '../../api/__fixtures__/turnos';
import type { AvisoHora } from './dominio/precarga';
import { MSG_CONFIRMAR_SOBRETURNO, MSG_SOBRETURNO_ROL, MSG_TURNO_CREADO, mensajeAviso, mensajeRechazo } from './mensajes';
import type { Rechazo } from './dominio/rechazos';

describe('mensajeRechazo', () => {
  it('sillón: texto fijo con la hora del turno en conflicto en hora del consultorio (13:00Z = 10:00)', () => {
    const texto = mensajeRechazo({ tipo: 'sillon', conflicto: CONFLICTO_SILLON });
    expect(texto).toContain('El sillón ya tiene un turno en ese horario.');
    expect(texto).toContain('10:00');
    expect(texto).toContain('10:30');
  });

  it('profesional: texto fijo con la hora del conflicto', () => {
    const texto = mensajeRechazo({ tipo: 'profesional', conflicto: { ...CONFLICTO_PROFESIONAL, inicio: '2026-11-25T01:30:00Z', fin: '2026-11-25T02:00:00Z' } });
    expect(texto).toContain('El profesional ya tiene un turno en ese horario.');
    expect(texto).toContain('22:30');
  });

  it.each([
    [{ tipo: 'bloqueo', bloqueoId: 4 }, 'El horario está bloqueado.'],
    [{ tipo: 'fueraDeAgenda' }, 'El horario no está disponible según las reglas de la agenda. Revisá el horario de atención y la grilla.'],
    [{ tipo: 'referencia', campos: ['pacienteId'] }, 'Alguno de los datos elegidos ya no existe; actualizá la agenda.'],
    [
      { tipo: 'profesionalNoResuelto' },
      'No se pudo asignar el profesional del consultorio. Contactá al administrador.',
    ],
    [{ tipo: 'sinIdentificar' }, 'No se pudo completar la acción. Es posible que el turno haya cambiado.'],
    [{ tipo: 'noExiste' }, 'El turno ya no existe.'],
    [{ tipo: 'prohibido' }, 'No tenés permiso para realizar esta acción.'],
    [{ tipo: 'conexion' }, 'No se pudo conectar con el servidor.'],
    [{ tipo: 'campos', campos: ['notas'] }, 'Revisá los datos ingresados.'],
  ] as const satisfies readonly (readonly [Rechazo, string])[])('%j → texto fijo', (rechazo, esperado) => {
    expect(mensajeRechazo(rechazo)).toBe(esperado);
  });

  it('validación genérica y desconocido tienen un texto fijo propio y distinto', () => {
    const generica = mensajeRechazo({ tipo: 'validacionGenerica' });
    const desconocido = mensajeRechazo({ tipo: 'desconocido' });
    expect(generica.length).toBeGreaterThan(0);
    expect(desconocido.length).toBeGreaterThan(0);
    expect(generica).not.toBe(desconocido);
  });

  it('el aviso de rol para el sobreturno', () => {
    expect(MSG_SOBRETURNO_ROL).toBe('El sobreturno requiere un usuario profesional o administrador.');
  });
});

describe('mensajeAviso (5.1.b)', () => {
  it.each([
    [{ tipo: 'ocupada', desde: '10:30', hasta: '11:00' }, 'La hora sugerida se superpone con otro turno de este sillón (10:30–11:00). Podés cambiarla.'],
    [{ tipo: 'fueraDeHorario' }, 'La hora sugerida está fuera del horario de atención. Podés cambiarla.'],
    [{ tipo: 'bloqueada' }, 'La hora sugerida cae en un bloqueo de la agenda. Podés cambiarla.'],
    [{ tipo: 'fueraDeGrilla' }, 'La hora sugerida no está alineada a la grilla de la agenda. Podés cambiarla.'],
    [{ tipo: 'invalida' }, 'La fecha o la hora no son válidas. Podés cambiarla.'],
  ] as const satisfies readonly (readonly [AvisoHora, string])[])('%j', (aviso, texto) => {
    expect(mensajeAviso(aviso)).toBe(texto);
  });
});

describe('textos del alta', () => {
  it('éxito y confirmación de sobreturno', () => {
    expect(MSG_TURNO_CREADO).toBe('Turno creado.');
    expect(MSG_CONFIRMAR_SOBRETURNO).toBe('Se registrará como sobreturno, fuera de las reglas habituales de la agenda. ¿Confirmás?');
  });
});
