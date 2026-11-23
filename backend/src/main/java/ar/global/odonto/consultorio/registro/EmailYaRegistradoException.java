package ar.global.odonto.consultorio.registro;

/** El email del registro ya pertenece a un usuario (409). El mensaje no incluye el email (regla 5). */
public class EmailYaRegistradoException extends RuntimeException {

	public EmailYaRegistradoException() {
		super("El email ya está registrado.");
	}
}
