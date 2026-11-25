package ar.global.odonto.recordatorio.email;

/**
 * Base de las fallas del puerto {@link EnvioEmail}: lleva solo un codigo fijo (nunca el mensaje ni la causa de la
 * excepcion original, que pueden contener direcciones u otros datos personales).
 */
public abstract class EnvioEmailException extends RuntimeException {

	private final String codigo;

	protected EnvioEmailException(String codigo) {
		super(codigo);
		this.codigo = codigo;
	}

	public String getCodigo() {
		return codigo;
	}
}
