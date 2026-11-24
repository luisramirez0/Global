package ar.global.odonto.paciente.ficha;

import ar.global.odonto.paciente.ConsentimientoDatos;
import java.time.Instant;

/** Consentimiento registrado (design D10). El usuario va por id, sin nombre. */
public record ConsentimientoResponse(Long id, String versionTexto, Instant aceptadoEn, Long registradoPorUsuarioId) {

	static ConsentimientoResponse de(ConsentimientoDatos c) {
		return new ConsentimientoResponse(c.getId(), c.getVersionTexto(), c.getAceptadoEn(),
				c.getRegistradoPor().getId());
	}
}
