package ar.global.odonto.common.web;

/**
 * Violacion de una regla de negocio entre filas (limite, solapamiento) -> 409. El titulo es generico. El
 * {@code codigo} opcional (p. ej. {@code CONSENTIMIENTO_REQUERIDO}) sale como propiedad del {@code ProblemDetail}
 * para que el cliente distinga el caso; siempre es una constante del codigo, nunca un valor del usuario.
 */
public class ConflictoException extends RuntimeException {

	private final String titulo;

	private final String codigo;

	public ConflictoException(String titulo) {
		this(titulo, null);
	}

	public ConflictoException(String titulo, String codigo) {
		super(titulo, null, false, false);
		this.titulo = titulo;
		this.codigo = codigo;
	}

	public String getTitulo() {
		return titulo;
	}

	/** Codigo de negocio o {@code null}. */
	public String getCodigo() {
		return codigo;
	}
}
