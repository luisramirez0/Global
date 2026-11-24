package ar.global.odonto.paciente.ficha;

import ar.global.odonto.common.web.ConflictoException;

/** La {@code version} enviada no coincide con la ficha guardada, o hubo una edicion simultanea (design D6) -> 409. */
public class FichaDesactualizadaException extends ConflictoException {

	public static final String CODIGO = "FICHA_DESACTUALIZADA";

	public FichaDesactualizadaException() {
		super("Ficha desactualizada", CODIGO);
	}
}
