package ar.global.odonto.recordatorio.email;

/**
 * Puerto de salida del email de recordatorio (C-09, design D5). Los tests de integracion lo reemplazan por un fake;
 * el adaptador real es {@link SmtpEnvioEmail}.
 */
public interface EnvioEmail {

	/**
	 * Envia el email. Debe invocarse fuera de toda transaccion.
	 *
	 * @throws EnvioEmailFallidoException si el envio o la comunicacion con el servidor SMTP falla
	 * @throws EmailNoConfiguradoException si falta la configuracion SMTP (sin intentar conectar)
	 */
	void enviar(String destinatario, String asunto, String texto);
}
