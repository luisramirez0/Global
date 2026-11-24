package ar.global.odonto.agenda.bloqueo;

import ar.global.odonto.common.web.MaxUtf8Bytes;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

/**
 * Bloqueo con instantes UTC. {@code sillonId} y {@code profesionalId} omitidos significan "sin ese ambito"
 * (ambos nulos = todo el consultorio); {@code profesionalId} nunca se completa por defecto (design D9).
 */
public record BloqueoRequest(Long sillonId, Long profesionalId, @NotNull Instant inicio, @NotNull Instant fin,
		@MaxUtf8Bytes(255) String motivo) {
}
