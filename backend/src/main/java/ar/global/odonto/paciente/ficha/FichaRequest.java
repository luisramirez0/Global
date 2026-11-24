package ar.global.odonto.paciente.ficha;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Reemplazo completo de la anamnesis (design D6, D11): un campo ausente, {@code null} o en blanco queda vacio.
 * {@code version} es la que leyo el cliente ({@code null} si la ficha no existia).
 */
public record FichaRequest(
		@Size(max = FichaRequest.MAX_TEXTO) String alergias,
		@Size(max = FichaRequest.MAX_TEXTO) String medicacionActual,
		@Size(max = FichaRequest.MAX_TEXTO) String antecedentesMedicos,
		@Size(max = FichaRequest.MAX_TEXTO) String enfermedadesRelevantes,
		Boolean embarazo,
		@Size(max = FichaRequest.MAX_TEXTO) String motivoConsulta,
		@Size(max = FichaRequest.MAX_TEXTO) String observaciones,
		@PositiveOrZero Long version) {

	/** Cabe en {@code TEXT} (65535 bytes) aun con 4 bytes por caracter. */
	public static final int MAX_TEXTO = 4000;
}
