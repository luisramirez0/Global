package ar.global.odonto.common.web;

/** Recurso inexistente o de otro consultorio (404). Sin mensaje: no debe revelar ids ni valores. */
public class RecursoNoEncontradoException extends RuntimeException {

	public RecursoNoEncontradoException() {
		super("Recurso no encontrado", null, false, false);
	}
}
