package ar.global.odonto.recordatorio;

import ar.global.odonto.agenda.EstadoTurno;
import java.time.Instant;

/** Item de pendientes de recordatorio (design D7, D12). Nunca lleva telefono ni email. */
public record TurnoPendienteResponse(Long turnoId, Instant inicio, Instant fin, EstadoTurno estado,
		PersonaResponse paciente, PersonaResponse profesional, boolean tieneTelefono, boolean tieneEmail,
		UltimoRecordatorioResponse ultimoRecordatorio) {

	public record UltimoRecordatorioResponse(CanalRecordatorio canal, EstadoRecordatorio estado, Instant generadoEn) {
	}

	/** El nombre es PII: {@code toString} solo expone el id. */
	public record PersonaResponse(Long id, String nombre, String apellido) {

		@Override
		public String toString() {
			return "PersonaResponse[id=" + id + "]";
		}
	}

	@Override
	public String toString() {
		return "TurnoPendienteResponse[turnoId=" + turnoId + "]";
	}
}
