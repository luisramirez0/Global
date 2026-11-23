package ar.global.odonto.usuario.auth;

/**
 * Login rechazado (401). Un unico tipo para email inexistente, contrasena incorrecta y usuario inactivo: el
 * cliente no debe poder distinguirlos (design D6).
 */
public class CredencialesInvalidasException extends RuntimeException {

	public CredencialesInvalidasException() {
		super("Credenciales inválidas.");
	}
}
