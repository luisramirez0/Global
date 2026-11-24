package ar.global.odonto.agenda.turno;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/**
 * Intervalo semiabierto {@code [inicio, fin)} de un turno, en UTC (C-07 design D2). Dos intervalos
 * adyacentes no se solapan.
 */
public record IntervaloTurno(Instant inicio, Instant fin) {

	public IntervaloTurno {
		Objects.requireNonNull(inicio, "inicio");
		Objects.requireNonNull(fin, "fin");
		if (!fin.isAfter(inicio)) {
			throw new IllegalArgumentException("fin debe ser posterior a inicio");
		}
	}

	public boolean solapaCon(IntervaloTurno otro) {
		return inicio.isBefore(otro.fin) && otro.inicio.isBefore(fin);
	}

	public Duration duracion() {
		return Duration.between(inicio, fin);
	}

	/** Mismo largo, nuevo inicio (reprogramacion conserva la duracion, design D6). */
	public IntervaloTurno movidoA(Instant nuevoInicio) {
		return new IntervaloTurno(nuevoInicio, nuevoInicio.plus(duracion()));
	}
}
