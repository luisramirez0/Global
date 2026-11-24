package ar.global.odonto.paciente.ficha;

import ar.global.odonto.common.web.ConflictoException;

/** Escritura clinica sobre un paciente dado de baja (design D9) -> 409. */
public class PacienteInactivoException extends ConflictoException {

	public static final String CODIGO = "PACIENTE_INACTIVO";

	public PacienteInactivoException() {
		super("Paciente dado de baja", CODIGO);
	}
}
