/**
 * DP-1, opción A (aprobada el 2026-11-24): el MVP tiene un solo profesional y no hay selector. Si los horarios
 * cargados pertenecen a más de un profesional, la agenda avisa y no ofrece el alta. Limitación conocida: solo ve
 * profesionales con horarios; uno activo sin horarios se detecta recién al enviar (422 en `profesionalId`).
 */
import type { Horario } from '../../../api/types';

export function hayVariosProfesionales(horarios: readonly Pick<Horario, 'profesionalId'>[]): boolean {
  return new Set(horarios.map((h) => h.profesionalId)).size > 1;
}
