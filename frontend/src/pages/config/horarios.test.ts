import { afterEach, describe, expect, it } from 'vitest';
import { HORARIO_LUNES, HORARIO_MARTES } from '../../api/__fixtures__/agendaConfig';
import { ApiError } from '../../api/errors';
import { buttonLabeled, buttons, createLoggedContext, errorOf, fill, flush, input, select, submit, type TestContext } from '../../test-support/pages';
import { renderHorarios } from './horarios';
import { MSG_FRANJA_SUPERPUESTA, MSG_PROFESIONAL } from './mensajes';
import { MSG_HORA_GRILLA, MSG_HORA_ORDEN } from './validacion';

async function setup(ctx: TestContext = createLoggedContext('ADMIN')) {
  if (ctx.agenda.listarHorarios.getMockImplementation() === undefined) {
    // Desordenados a propósito: la pantalla los ordena por día y hora.
    ctx.agenda.listarHorarios.mockResolvedValue([HORARIO_MARTES, { ...HORARIO_LUNES, id: 22, horaDesde: '15:00', horaHasta: '19:00' }, HORARIO_LUNES]);
  }
  const page = renderHorarios(ctx);
  document.body.replaceChildren(page.element);
  await flush();
  return { ctx, page, root: page.element };
}

const filas = (root: ParentNode): string[][] =>
  [...root.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].slice(0, 3).map((td) => td.textContent ?? ''));

function enviar(root: ParentNode, dia: string, desde: string, hasta: string): void {
  select(root, 'diaSemana').value = dia;
  fill(root, { horaDesde: desde, horaHasta: hasta });
  submit(root);
}

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
});

describe('horarios de atención', () => {
  it('lista ordenada por día y hora, con el día en palabras', async () => {
    const { root, page } = await setup();
    expect(page.title).toBe('Horarios de atención');
    expect(filas(root)).toEqual([
      ['Lunes', '09:00', '13:00'],
      ['Lunes', '15:00', '19:00'],
      ['Martes', '14:00', '18:30'],
    ]);
  });

  it('el día se elige de lunes a domingo y las horas son inputs de hora', async () => {
    const { root } = await setup();
    expect([...select(root, 'diaSemana').options].map((o) => [o.value, o.textContent])).toEqual([
      ['1', 'Lunes'],
      ['2', 'Martes'],
      ['3', 'Miércoles'],
      ['4', 'Jueves'],
      ['5', 'Viernes'],
      ['6', 'Sábado'],
      ['7', 'Domingo'],
    ]);
    expect(input(root, 'horaDesde').type).toBe('time');
    expect(input(root, 'horaHasta').type).toBe('time');
  });

  it('franja invertida o fuera de la grilla: errores de campo y sin request', async () => {
    const { root, ctx } = await setup();
    enviar(root, '3', '12:00', '09:00');
    expect(errorOf(root, 'horaHasta')).toBe(MSG_HORA_ORDEN);
    enviar(root, '3', '09:10', '12:00');
    expect(errorOf(root, 'horaDesde')).toBe(MSG_HORA_GRILLA);
    expect(ctx.agenda.crearHorario).not.toHaveBeenCalled();
  });

  it('alta sin profesionalId (lo resuelve el backend)', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.crearHorario.mockResolvedValue({ ...HORARIO_LUNES, id: 40, diaSemana: 3 });
    enviar(root, '3', '09:00', '12:30');
    await flush();
    expect(ctx.agenda.crearHorario).toHaveBeenCalledWith({ diaSemana: 3, horaDesde: '09:00', horaHasta: '12:30' });
    expect(root.querySelector('.estado')?.textContent).toBe('Franja agregada.');
  });

  it('edición carga la franja y reenvía su profesionalId', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.editarHorario.mockResolvedValue(HORARIO_MARTES);
    buttonLabeled(root, 'Editar Martes 14:00 a 18:30').click();
    expect(select(root, 'diaSemana').value).toBe('2');
    expect(input(root, 'horaDesde').value).toBe('14:00');
    fill(root, { horaHasta: '19:00' });
    submit(root);
    await flush();
    expect(ctx.agenda.editarHorario).toHaveBeenCalledWith(21, { profesionalId: 7, diaSemana: 2, horaDesde: '14:00', horaHasta: '19:00' });
  });

  it('409: la franja se superpone', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.crearHorario.mockRejectedValue(new ApiError('conflict', { status: 409 }));
    enviar(root, '1', '10:00', '11:00');
    await flush();
    expect(root.querySelector('form [role="alert"]')?.textContent).toBe(MSG_FRANJA_SUPERPUESTA);
  });

  it('422 por profesional: mensaje explicativo', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.crearHorario.mockRejectedValue(
      new ApiError('validation', { status: 422, fieldErrors: [{ campo: 'profesionalId', mensaje: 'referencia inválida' }] }),
    );
    enviar(root, '4', '09:00', '10:00');
    await flush();
    expect(root.querySelector('form [role="alert"]')?.textContent).toBe(MSG_PROFESIONAL);
  });

  it('eliminar con confirmación (borrado físico)', async () => {
    const { root, ctx } = await setup();
    ctx.agenda.borrarHorario.mockResolvedValue(undefined);
    buttonLabeled(root, 'Eliminar Lunes 09:00 a 13:00').click();
    buttonLabeled(root, 'Confirmar: Eliminar Lunes 09:00 a 13:00').click();
    await flush();
    expect(ctx.agenda.borrarHorario).toHaveBeenCalledWith(20);
    expect(root.querySelector('.estado')?.textContent).toBe('Franja eliminada.');
  });

  it('V-D3: RECEPCION no tiene formulario, campos ni acciones', async () => {
    const { root } = await setup(createLoggedContext('RECEPCION'));
    expect(filas(root)).toHaveLength(3);
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('select')).toBeNull();
    expect(root.querySelector('input')).toBeNull();
    for (const texto of ['Editar', 'Eliminar', 'Agregar']) expect(buttons(root, texto)).toHaveLength(0);
  });
});
