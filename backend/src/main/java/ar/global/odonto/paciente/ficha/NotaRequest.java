package ar.global.odonto.paciente.ficha;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Nota clinica nueva (design D7, D11). Autor y fecha los pone el servidor; {@code turnoId} es opcional. */
public record NotaRequest(@NotBlank @Size(max = NotaRequest.MAX_TEXTO) String texto, Long turnoId) {

	/** Cabe en {@code TEXT} (65535 bytes) aun con 4 bytes por caracter. */
	public static final int MAX_TEXTO = 10_000;
}
