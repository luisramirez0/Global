package ar.global.odonto.common.web;

/**
 * El recurso no existe en el consultorio en curso: {@code 404} generico. Un id de otro consultorio es
 * indistinguible de uno inexistente (el filtro de tenant no lo encuentra), por eso el mensaje no nombra la
 * entidad ni el id (design C-05 D7).
 */
public class RecursoNoEncontradoException extends RuntimeException {

	public RecursoNoEncontradoException() {
		super("El recurso no existe.");
	}
}
