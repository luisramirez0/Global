package ar.global.odonto.paciente.ficha;

import java.time.Instant;

/**
 * Anamnesis del paciente (design D15). Si la ficha no fue cargada, todos los campos clinicos, {@code version} y
 * {@code actualizadaEn} son {@code null} (design D5).
 */
public record FichaResponse(Long pacienteId, String alergias, String medicacionActual, String antecedentesMedicos,
		String enfermedadesRelevantes, Boolean embarazo, String motivoConsulta, String observaciones, Long version,
		Instant actualizadaEn) {

	static FichaResponse vacia(Long pacienteId) {
		return new FichaResponse(pacienteId, null, null, null, null, null, null, null, null, null);
	}
}
