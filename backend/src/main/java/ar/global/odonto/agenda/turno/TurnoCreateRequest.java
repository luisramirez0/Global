package ar.global.odonto.agenda.turno;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * Alta de turno (C-07). Sin {@code fin}: sale de la duracion de la prestacion (design D6). {@code profesionalId}
 * omitido = el unico profesional activo (design D8). {@code sobreturno} omitido = falso.
 */
public record TurnoCreateRequest(
		@NotNull Long pacienteId,
		@NotNull Long prestacionId,
		@NotNull Long sillonId,
		Long profesionalId,
		@NotNull Instant inicio,
		Boolean sobreturno,
		@Size(max = 1000) String notas) {

	public boolean esSobreturno() {
		return Boolean.TRUE.equals(sobreturno);
	}
}
