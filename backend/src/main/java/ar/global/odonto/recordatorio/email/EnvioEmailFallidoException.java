package ar.global.odonto.recordatorio.email;

/**
 * Falla al enviar o comunicarse con el servidor SMTP (→ 502). Lleva solo un codigo fijo
 * {@code SMTP_FALLO:<NombreSimpleDeLaClase>}: nunca el mensaje de la causa (puede contener direcciones, PII) ni la
 * causa misma.
 */
public class EnvioEmailFallidoException extends EnvioEmailException {

	public EnvioEmailFallidoException(String codigo) {
		super(codigo);
	}
}
