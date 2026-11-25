package ar.global.odonto.recordatorio.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

/** {@link SmtpEnvioEmail} con un {@code JavaMailSender} mockeado (no es la base; no hay conexion SMTP). */
class SmtpEnvioEmailTest {

	private static final String HOST = "smtp.test";
	private static final String FROM = "turnos@consultorio.test";

	private final JavaMailSender sender = mock(JavaMailSender.class);

	private static ObjectProvider<JavaMailSender> con(JavaMailSender sender) {
		return new StaticListableBeanFactory(Map.of("javaMailSender", sender)).getBeanProvider(JavaMailSender.class);
	}

	@Test
	void buildsSimpleMailMessageWithFromToSubjectAndText() {
		SmtpEnvioEmail envio = new SmtpEnvioEmail(con(sender), HOST, FROM);

		envio.enviar("paciente@correo.test", "Recordatorio de turno", "Recordatorio: tiene un turno.");

		ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
		verify(sender).send(captor.capture());
		SimpleMailMessage m = captor.getValue();
		assertThat(m.getFrom()).isEqualTo(FROM);
		assertThat(m.getTo()).containsExactly("paciente@correo.test");
		assertThat(m.getSubject()).isEqualTo("Recordatorio de turno");
		assertThat(m.getText()).isEqualTo("Recordatorio: tiene un turno.");
	}

	@Test
	void sendFailureBecomesPortExceptionWithFixedCodeAndNoEmailNorCause() {
		doThrow(new MailSendException("Failed messages: paciente@correo.test rechazado")).when(sender)
				.send(any(SimpleMailMessage.class));
		SmtpEnvioEmail envio = new SmtpEnvioEmail(con(sender), HOST, FROM);

		assertThatThrownBy(() -> envio.enviar("paciente@correo.test", "Recordatorio de turno", "texto"))
				.isInstanceOfSatisfying(EnvioEmailFallidoException.class, e -> {
					assertThat(e.getCodigo()).isEqualTo("SMTP_FALLO:MailSendException");
					assertThat(e.getMessage()).doesNotContain("paciente@correo.test").doesNotContain("rechazado");
					assertThat(e.getCause()).isNull();
				});
	}

	@Test
	void codeCarriesTheSimpleNameOfTheOriginalMailException() {
		doThrow(new MailAuthenticationException("login rechazado para usuario@smtp.test")).when(sender)
				.send(any(SimpleMailMessage.class));
		SmtpEnvioEmail envio = new SmtpEnvioEmail(con(sender), HOST, FROM);

		assertThatThrownBy(() -> envio.enviar("paciente@correo.test", "Recordatorio de turno", "texto"))
				.isInstanceOfSatisfying(EnvioEmailFallidoException.class, e -> {
					assertThat(e.getCodigo()).isEqualTo("SMTP_FALLO:MailAuthenticationException");
					assertThat(e.getMessage()).doesNotContain("usuario@smtp.test");
				});
	}

	@Test
	void nonMailRuntimeFailureIsAlsoTranslatedWithoutItsMessage() {
		doThrow(new IllegalStateException("socket cerrado hacia paciente@correo.test")).when(sender)
				.send(any(SimpleMailMessage.class));
		SmtpEnvioEmail envio = new SmtpEnvioEmail(con(sender), HOST, FROM);

		assertThatThrownBy(() -> envio.enviar("paciente@correo.test", "Recordatorio de turno", "texto"))
				.isInstanceOfSatisfying(EnvioEmailFallidoException.class, e -> {
					assertThat(e.getCodigo()).isEqualTo("SMTP_FALLO:IllegalStateException");
					assertThat(e.getMessage()).doesNotContain("paciente@correo.test");
				});
	}

	@Test
	void blankHostIsNotConfiguredAndNeverCallsSend() {
		SmtpEnvioEmail envio = new SmtpEnvioEmail(con(sender), "  ", FROM);

		assertThatThrownBy(() -> envio.enviar("paciente@correo.test", "Recordatorio de turno", "texto"))
				.isInstanceOfSatisfying(EmailNoConfiguradoException.class,
						e -> assertThat(e.getCodigo()).isEqualTo("SMTP_NO_CONFIGURADO"));
		verifyNoInteractions(sender);
	}

	@Test
	void blankFromIsNotConfiguredAndNeverCallsSend() {
		SmtpEnvioEmail envio = new SmtpEnvioEmail(con(sender), HOST, "");

		assertThatThrownBy(() -> envio.enviar("paciente@correo.test", "Recordatorio de turno", "texto"))
				.isInstanceOfSatisfying(EmailNoConfiguradoException.class,
						e -> assertThat(e.getCodigo()).isEqualTo("SMTP_NO_CONFIGURADO"));
		verifyNoInteractions(sender);
	}

	@Test
	void noJavaMailSenderBeanIsNotConfigured() {
		SmtpEnvioEmail envio = new SmtpEnvioEmail(new StaticListableBeanFactory().getBeanProvider(JavaMailSender.class), HOST, FROM);

		assertThatThrownBy(() -> envio.enviar("paciente@correo.test", "Recordatorio de turno", "texto"))
				.isInstanceOfSatisfying(EmailNoConfiguradoException.class,
						e -> assertThat(e.getCodigo()).isEqualTo("SMTP_NO_CONFIGURADO"));
		verifyNoInteractions(sender);
	}
}
