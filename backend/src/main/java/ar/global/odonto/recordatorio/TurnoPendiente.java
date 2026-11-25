package ar.global.odonto.recordatorio;

import ar.global.odonto.agenda.EstadoTurno;
import java.time.Instant;

/** Turno pendiente de recordatorio (resultado de servicio, sin entidades JPA). */
public record TurnoPendiente(Long turnoId, Instant inicio, Instant fin, EstadoTurno estado, Persona paciente,
		Persona profesional, boolean tieneTelefono, boolean tieneEmail,
		UltimoRecordatorio ultimoRecordatorio) {

	/** Ultimo recordatorio del turno (cualquier estado); nunca lleva el detalle del error. */
	public record UltimoRecordatorio(CanalRecordatorio canal, EstadoRecordatorio estado, Instant generadoEn) {
	}

	/** Identificacion minima de una persona (id y nombre: el nombre es PII, por eso no sale en {@code toString}). */
	public record Persona(Long id, String nombre, String apellido) {

		@Override
		public String toString() {
			return "Persona[id=" + id + "]";
		}
	}
}
