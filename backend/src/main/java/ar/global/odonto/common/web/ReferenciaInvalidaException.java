package ar.global.odonto.common.web;

/** Id referenciado en el cuerpo inexistente, ajeno o invalido -> 422. Solo nombra el campo, nunca el valor. */
public class ReferenciaInvalidaException extends RuntimeException {

	private final String campo;

	public ReferenciaInvalidaException(String campo) {
		super("Referencia inválida", null, false, false);
		this.campo = campo;
	}

	public String getCampo() {
		return campo;
	}
}
