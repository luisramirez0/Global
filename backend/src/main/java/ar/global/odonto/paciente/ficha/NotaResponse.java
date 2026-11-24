package ar.global.odonto.paciente.ficha;

import ar.global.odonto.paciente.NotaClinica;
import java.time.Instant;

/** Nota clinica (design D15). El autor va por id de profesional, sin nombre. */
public record NotaResponse(Long id, Instant fecha, Long profesionalId, Long turnoId, String texto) {

	static NotaResponse de(NotaClinica n) {
		return new NotaResponse(n.getId(), n.getFecha(), n.getProfesional().getId(),
				n.getTurno() == null ? null : n.getTurno().getId(), n.getTexto());
	}
}
