package ar.global.odonto.agenda.turno;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;

/**
 * Reprogramacion (RN-AG-06, design D6/D8): nuevo inicio obligatorio; sillon y profesional omitidos se conservan;
 * la duracion se conserva. {@code sobreturno} omitido = falso (se revalida todo).
 */
public record TurnoReprogramarRequest(
		@NotNull Instant inicio,
		Long sillonId,
		Long profesionalId,
		Boolean sobreturno) {

	public boolean esSobreturno() {
		return Boolean.TRUE.equals(sobreturno);
	}
}
