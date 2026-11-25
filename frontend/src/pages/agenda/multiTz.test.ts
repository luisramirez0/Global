/**
 * Tarea 8.2 de C-13: multi-TZ transversal. Rango pedido, posición en la grilla y alta de turno se repiten con las
 * cinco zonas de la tarea 2.1 (V-D4). El resultado debe depender solo de la zona del consultorio (Argentina), nunca
 * de la del navegador.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PACIENTE_ANA } from '../../api/__fixtures__/pacientes';
import { TURNO_PROGRAMADO } from '../../api/__fixtures__/turnos';
import { aInstanteUtc } from '../../utils/zonaHoraria';
import { bloqueDe, boton, dialogo, montarConTimers, tick, turnoAR, usarRelojFalso } from '../../test-support/agenda';
import { rangoDia, rangoSemana } from './dominio/rango';
import { calcularPosicion, segmentarPorDia } from './dominio/posicion';

// Vitest corre en Node: `process.env.TZ` cambia la zona local del proceso en caliente (patrón de C-11).
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env['TZ'];

const ZONAS = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Europe/Madrid', 'America/Argentina/Buenos_Aires'];

beforeEach(usarRelojFalso);
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  sessionStorage.clear();
  if (ORIGINAL_TZ === undefined) delete env['TZ'];
  else env['TZ'] = ORIGINAL_TZ;
});

describe('8.2 multi-TZ transversal', () => {
  it('las 5 zonas dan 5 offsets distintos en el proceso (si no, las pruebas de abajo no probarían nada)', () => {
    const offsets = ZONAS.map((zona) => {
      env['TZ'] = zona;
      return new Date(Date.UTC(2026, 10, 24, 12, 0)).getTimezoneOffset();
    });
    expect(new Set(offsets).size).toBe(5);
  });

  describe.each(ZONAS)('con TZ=%s', (zona) => {
    it('rango: día y semana del consultorio en UTC', () => {
      env['TZ'] = zona;
      expect(rangoDia('2026-11-24')).toEqual({ desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' });
      expect(rangoSemana('2026-11-24')).toEqual({ desde: '2026-11-23T03:00:00Z', hasta: '2026-11-30T03:00:00Z' });
    });

    it('posición: un turno de 22:30 AR cae en la fila 55 y uno que cruza la medianoche se segmenta igual', () => {
      env['TZ'] = zona;
      const nocturno = segmentarPorDia({ inicio: '2026-11-25T01:30:00Z', fin: '2026-11-25T02:00:00Z' }, '2026-11-24');
      expect(nocturno).toEqual({ inicioMin: 1350, finMin: 1380, continua: false, vieneDeAntes: false });
      if (nocturno === null) throw new Error('sin segmento');
      expect(calcularPosicion(nocturno, { franjaInicioMin: 540, minutosGrilla: 15 })).toEqual({ fila: 55, filas: 2 });
    });

    it('página: pide el mismo rango y los bloques quedan en las mismas filas y horas', async () => {
      env['TZ'] = zona;
      const { ctx } = await montarConTimers('ADMIN', { turnos: [turnoAR(100, '10:00'), turnoAR(106, '22:30')] });
      expect(ctx.turnos.listar.mock.calls[0]?.[0]).toEqual({ desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' });
      expect(bloqueDe(100).style.gridRow).toBe('5 / span 2');
      expect(bloqueDe(106).style.gridRow).toBe('55 / span 2');
      expect(bloqueDe(100).textContent).toContain('10:00–10:30');
      expect(bloqueDe(106).textContent).toContain('22:30–23:00');
    });

    it('alta: 10:00 AR viaja como 13:00Z y 22:30 AR como 01:30Z del día siguiente', async () => {
      env['TZ'] = zona;
      const { ctx } = await montarConTimers('ADMIN');
      ctx.turnos.crear.mockResolvedValue({ ...TURNO_PROGRAMADO, id: 500 });
      const escribir = (name: string, valor: string): void => {
        const c = dialogo()?.querySelector<HTMLInputElement>(`[name="${name}"]`);
        if (c === null || c === undefined) throw new Error(`sin campo ${name}`);
        c.value = valor;
        c.dispatchEvent(new Event(c instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      };
      for (const hora of ['10:00', '22:30']) {
        boton('Nuevo turno').click();
        escribir('paciente', 'pé');
        await tick(300);
        dialogo()?.querySelector<HTMLButtonElement>('.resultados-paciente button')?.click();
        escribir('prestacionId', '11');
        escribir('sillonId', '1');
        escribir('fecha', '2026-11-24');
        escribir('hora', hora);
        boton('Confirmar').click();
        await tick();
      }
      expect(ctx.turnos.crear.mock.calls.map((c) => c[0])).toEqual([
        { pacienteId: PACIENTE_ANA.id, prestacionId: 11, sillonId: 1, inicio: '2026-11-24T13:00:00Z' },
        { pacienteId: PACIENTE_ANA.id, prestacionId: 11, sillonId: 1, inicio: '2026-11-25T01:30:00Z' },
      ]);
      expect(aInstanteUtc('2026-11-24', '22:30')).toBe('2026-11-25T01:30:00Z');
    });
  });
});
