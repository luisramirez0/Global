import { describe, expect, it } from 'vitest';
import { formatearDetalle, validarFiltros, type ValoresFiltros } from './filtros';

const VACIOS: ValoresFiltros = { desde: '', hasta: '', accion: '', entidad: '', entidadId: '', usuarioId: '' };

describe('validarFiltros (spec frontend-audit-log, design D8/D9)', () => {
  it('sin valores no filtra nada', () => {
    expect(validarFiltros(VACIOS)).toEqual({ ok: true, value: {} });
  });

  it('un día en Buenos Aires va de las 03:00Z a las 03:00Z del día siguiente (hasta exclusivo)', () => {
    expect(validarFiltros({ ...VACIOS, desde: '2026-11-24', hasta: '2026-11-24' })).toEqual({
      ok: true,
      value: { desde: '2026-11-24T03:00:00Z', hasta: '2026-11-25T03:00:00Z' },
    });
  });

  it('el último día del mes pasa al mes siguiente', () => {
    const r = validarFiltros({ ...VACIOS, hasta: '2026-11-30' });
    expect(r).toEqual({ ok: true, value: { hasta: '2026-12-01T03:00:00Z' } });
  });

  it('acción, entidad, id de entidad y usuario se envían tipados', () => {
    expect(validarFiltros({ ...VACIOS, accion: 'EXPORT', entidad: 'Paciente', entidadId: ' 7 ', usuarioId: '3' })).toEqual({
      ok: true,
      value: { accion: 'EXPORT', entidad: 'Paciente', entidadId: 7, usuarioId: 3 },
    });
  });

  it('el id de entidad sin entidad no se envía', () => {
    expect(validarFiltros({ ...VACIOS, entidadId: '7' })).toEqual({ ok: true, value: {} });
  });

  it('rango invertido marca el error en hasta', () => {
    const r = validarFiltros({ ...VACIOS, desde: '2026-11-25', hasta: '2026-11-24' });
    expect(r.ok).toBe(false);
    expect(r.ok ? null : Object.keys(r.errors)).toEqual(['hasta']);
  });

  it.each([
    ['desde', { desde: '2026-02-30' }],
    ['hasta', { hasta: 'mañana' }],
    ['entidadId', { entidad: 'Turno', entidadId: 'abc' }],
    ['entidadId', { entidad: 'Turno', entidadId: '0' }],
    ['usuarioId', { usuarioId: '-1' }],
    ['accion', { accion: 'BORRAR' }],
  ])('un %s inválido da error en ese campo', (campo, valores) => {
    const r = validarFiltros({ ...VACIOS, ...valores });
    expect(r.ok).toBe(false);
    expect(r.ok ? null : Object.keys(r.errors)).toEqual([campo]);
  });
});

describe('formatearDetalle', () => {
  it('muestra clave: valor separados por coma', () => {
    expect(formatearDetalle({ fichaId: 3, version: 1 })).toBe('fichaId: 3, version: 1');
    expect(formatearDetalle({ ficha: false, operacion: 'CAMBIO_ESTADO' })).toBe('ficha: false, operacion: CAMBIO_ESTADO');
  });

  it('sin detalle muestra un guion', () => {
    expect(formatearDetalle(null)).toBe('—');
    expect(formatearDetalle({})).toBe('—');
  });
});
