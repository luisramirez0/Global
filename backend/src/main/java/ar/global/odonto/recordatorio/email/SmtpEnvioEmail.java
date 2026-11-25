package ar.global.odonto.recordatorio.email;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** Adaptador SMTP del puerto {@link EnvioEmail} sobre {@link JavaMailSender} (C-09, design D5, D8). */
@Component
public class SmtpEnvioEmail implements EnvioEmail {

	private final ObjectProvider<JavaMailSender> sender;
	private final String host;
	private final String from;

	public SmtpEnvioEmail(ObjectProvider<JavaMailSender> sender, @Value("${spring.mail.host:}") String host,
			@Value("${app.mail.from:}") String from) {
		this.sender = sender;
		this.host = host;
		this.from = from;
	}

	@Override
	public void enviar(String destinatario, String asunto, String texto) {
		JavaMailSender mailSender = sender.getIfAvailable();
		if (mailSender == null || host == null || host.isBlank() || from == null || from.isBlank()) {
			throw new EmailNoConfiguradoException();
		}
		SimpleMailMessage mensaje = new SimpleMailMessage();
		mensaje.setFrom(from);
		mensaje.setTo(destinatario);
		mensaje.setSubject(asunto);
		mensaje.setText(texto);
		try {
			mailSender.send(mensaje);
		}
		catch (RuntimeException e) {
			// Solo el nombre simple de la clase: el mensaje y la causa pueden traer direcciones (PII).
			throw new EnvioEmailFallidoException("SMTP_FALLO:" + e.getClass().getSimpleName());
		}
	}
}
