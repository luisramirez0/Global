package ar.global.odonto.agenda.bloqueo;

import java.time.Instant;

public record BloqueoResponse(Long id, Long sillonId, Long profesionalId, Instant inicio, Instant fin,
		String motivo) {
}
