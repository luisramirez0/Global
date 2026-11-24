package ar.global.odonto.paciente.ficha;

import ar.global.odonto.common.web.ConflictoException;

/** Ficha o notas de un paciente sin consentimiento registrado (RN-DS-03, design D4) -> 409. */
public class ConsentimientoRequeridoException extends ConflictoException {

	public static final String CODIGO = "CONSENTIMIENTO_REQUERIDO";

	public ConsentimientoRequeridoException() {
		super("Consentimiento requerido", CODIGO);
	}
}
