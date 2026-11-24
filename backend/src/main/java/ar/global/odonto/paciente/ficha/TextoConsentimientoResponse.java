package ar.global.odonto.paciente.ficha;

import ar.global.odonto.paciente.ConsentimientoTexto;
import java.time.Instant;

/** Texto de consentimiento del catalogo global (design D10). */
public record TextoConsentimientoResponse(String version, String contenido, Instant vigenteDesde) {

	static TextoConsentimientoResponse de(ConsentimientoTexto t) {
		return new TextoConsentimientoResponse(t.getVersion(), t.getContenido(), t.getVigenteDesde());
	}
}
