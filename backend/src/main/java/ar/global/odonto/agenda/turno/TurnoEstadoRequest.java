package ar.global.odonto.agenda.turno;

import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.common.web.MaxUtf8Bytes;
import jakarta.validation.constraints.NotNull;

/** Cambio de estado (RN-AG-05, design D7). {@code motivoCancelacion} solo se acepta con {@code CANCELADO}. */
public record TurnoEstadoRequest(
		@NotNull EstadoTurno estado,
		@MaxUtf8Bytes(255) String motivoCancelacion) {
}
