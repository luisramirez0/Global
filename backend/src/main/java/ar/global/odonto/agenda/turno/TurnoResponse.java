package ar.global.odonto.agenda.turno;

import ar.global.odonto.agenda.EstadoTurno;
import java.time.Instant;

/**
 * Turno expuesto por la API (C-07 design D10). Sin {@code consultorioId} ni {@code version}. Nombre y apellido del
 * paciente viajan solo en la respuesta a usuarios autorizados; nunca en logs (regla 5).
 */
public record TurnoResponse(
		Long id,
		Instant inicio,
		Instant fin,
		EstadoTurno estado,
		boolean sobreturno,
		String motivoCancelacion,
		String notas,
		Long sillonId,
		Long profesionalId,
		PacienteResumen paciente,
		PrestacionResumen prestacion) {

	public record PacienteResumen(Long id, String nombre, String apellido) {
	}

	public record PrestacionResumen(Long id, String nombre) {
	}
}
