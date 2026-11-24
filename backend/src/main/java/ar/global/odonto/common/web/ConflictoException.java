package ar.global.odonto.common.web;

/** Violacion de una regla de negocio entre filas (limite, solapamiento) -> 409. El titulo es generico. */
public class ConflictoException extends RuntimeException {

	private final String titulo;

	public ConflictoException(String titulo) {
		super(titulo, null, false, false);
		this.titulo = titulo;
	}

	public String getTitulo() {
		return titulo;
	}
}
