import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFLICTO_PROFESIONAL, CONFLICTO_SILLON } from '../../api/__fixtures__/turnos';
import type { Rechazo } from './dominio/rechazos';
import { crearZonaRechazo } from './zonaRechazo';

afterEach(() => {
  document.body.replaceChildren();
});

function crear(puede = true) {
  const alPedirSobreturno = vi.fn();
  const alRecargar = vi.fn();
  const zona = crearZonaRechazo({ puedeOfrecerSobreturno: puede, alPedirSobreturno, alRecargar });
  document.body.append(zona.alerta, zona.acciones);
  return { zona, alPedirSobreturno, alRecargar };
}
const textos = (): string[] => [...document.querySelectorAll('button')].map((b) => b.textContent ?? '');
const PROFESIONAL: Rechazo = { tipo: 'profesional', conflicto: CONFLICTO_PROFESIONAL };

describe('zonaRechazo', () => {
  it('la alerta es role="alert" y muestra el mensaje fijo del rechazo', () => {
    const { zona } = crear();
    zona.mostrar({ tipo: 'sillon', conflicto: CONFLICTO_SILLON }, false);
    expect(zona.alerta.getAttribute('role')).toBe('alert');
    expect(zona.alerta.textContent).toContain('El sillón ya tiene un turno en ese horario.');
    expect(textos()).toEqual([]);
  });

  it('un rechazo que admite sobreturno ofrece "Agendar como sobreturno" a quien puede, y el clic lo pide', () => {
    const { zona, alPedirSobreturno } = crear(true);
    zona.mostrar(PROFESIONAL, false);
    expect(textos()).toEqual(['Agendar como sobreturno']);
    document.querySelector('button')?.click();
    expect(alPedirSobreturno).toHaveBeenCalledTimes(1);
  });

  it('a quien no puede (RECEPCION) le agrega el aviso de rol y no ofrece el botón', () => {
    const { zona } = crear(false);
    zona.mostrar({ tipo: 'fueraDeAgenda' }, false);
    expect(textos()).toEqual([]);
    expect(zona.alerta.textContent).toContain('El horario no está disponible según las reglas de la agenda. Revisá el horario de atención y la grilla.');
    expect(zona.alerta.textContent).toContain('El sobreturno requiere un usuario profesional o administrador.');
  });

  it('después de un sobreturno fallido no vuelve a ofrecerlo ni avisa del rol', () => {
    const { zona } = crear(true);
    zona.mostrar(PROFESIONAL, true);
    expect(textos()).toEqual([]);
    const otra = crear(false);
    otra.zona.mostrar(PROFESIONAL, true);
    expect(otra.zona.alerta.textContent).not.toContain('El sobreturno requiere');
  });

  it.each([
    [{ tipo: 'sinIdentificar' }],
    [{ tipo: 'noExiste' }],
    [{ tipo: 'desconocido' }],
  ] as const)('%j ofrece "Recargar agenda" manual', (rechazo) => {
    const { zona, alRecargar } = crear();
    zona.mostrar(rechazo, false);
    expect(textos()).toEqual(['Recargar agenda']);
    document.querySelector('button')?.click();
    expect(alRecargar).toHaveBeenCalledTimes(1);
  });

  it.each([[{ tipo: 'prohibido' }], [{ tipo: 'conexion' }], [{ tipo: 'referencia', campos: ['sillonId'] }], [{ tipo: 'sillon', conflicto: CONFLICTO_SILLON }]] as const)(
    '%j no ofrece recarga',
    (rechazo) => {
      const { zona } = crear();
      zona.mostrar(rechazo, false);
      expect(textos()).not.toContain('Recargar agenda');
    },
  );

  it('limpiar vacía mensaje y acciones; un nuevo mostrar reemplaza el anterior', () => {
    const { zona } = crear();
    zona.mostrar({ tipo: 'noExiste' }, false);
    zona.limpiar();
    expect(zona.alerta.textContent).toBe('');
    expect(textos()).toEqual([]);
    zona.mostrar({ tipo: 'prohibido' }, false);
    zona.mostrar({ tipo: 'bloqueo', bloqueoId: 1 }, false);
    expect(zona.alerta.querySelectorAll('p')).toHaveLength(1);
  });

  it('indica si el rechazo es de horario (para asociarlo al campo hora)', () => {
    const { zona } = crear();
    zona.mostrar(PROFESIONAL, false);
    expect(zona.esDeHorario()).toBe(true);
    zona.mostrar({ tipo: 'prohibido' }, false);
    expect(zona.esDeHorario()).toBe(false);
    zona.limpiar();
    expect(zona.esDeHorario()).toBe(false);
  });
});
