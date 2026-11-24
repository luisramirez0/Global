package ar.global.odonto.common.web;

/** Regla de validacion entre campos (servicio) -> 400 con el mismo formato que Bean Validation. */
public class ValidacionException extends RuntimeException {

	private final String campo;
	private final String mensaje;

	public ValidacionException(String campo, String mensaje) {
		super("Datos inválidos", null, false, false);
		this.campo = campo;
		this.mensaje = mensaje;
	}

	public String getCampo() {
		return campo;
	}

	public String getMensaje() {
		return mensaje;
	}
}
