package ar.global.odonto.recordatorio.email;

/** Falta la configuracion SMTP ({@code SMTP_HOST} o {@code SMTP_FROM}); no se intenta conectar (→ 503). */
public class EmailNoConfiguradoException extends EnvioEmailException {

	public static final String CODIGO = "SMTP_NO_CONFIGURADO";

	public EmailNoConfiguradoException() {
		super(CODIGO);
	}
}
