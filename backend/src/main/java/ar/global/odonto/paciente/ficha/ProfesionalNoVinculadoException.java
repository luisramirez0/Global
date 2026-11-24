package ar.global.odonto.paciente.ficha;

/** El usuario del token no tiene exactamente un profesional activo vinculado (design D7) -> 422. */
public class ProfesionalNoVinculadoException extends RuntimeException {

	public static final String CODIGO = "PROFESIONAL_NO_VINCULADO";

	public ProfesionalNoVinculadoException() {
		super("Profesional no vinculado", null, false, false);
	}

	public String getCodigo() {
		return CODIGO;
	}
}
