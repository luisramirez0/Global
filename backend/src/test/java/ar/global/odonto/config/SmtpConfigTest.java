package ar.global.odonto.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/** Configuracion SMTP de {@code application.yml} (C-09 tarea 5.1, design D8). Sin conexion ni servidor real. */
class SmtpConfigTest {

	private final ApplicationContextRunner runner = new ApplicationContextRunner().withInitializer(ctx -> {
		try {
			new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"))
					.forEach(ps -> ctx.getEnvironment().getPropertySources().addLast(ps));
		}
		catch (IOException e) {
			throw new IllegalStateException(e);
		}
	});

	@Test
	void smtpPortDefaultsTo587WhenSmtpPortIsNotDefined() {
		runner.run(ctx -> assertThat(ctx.getEnvironment().getProperty("spring.mail.port")).isEqualTo("587"));
	}

	@Test
	void smtpPortComesFromTheEnvironmentWhenDefined() {
		runner.withPropertyValues("SMTP_PORT=2525")
				.run(ctx -> assertThat(ctx.getEnvironment().getProperty("spring.mail.port")).isEqualTo("2525"));
	}

	/** Host ficticio solo para que Boot cree el sender; no se conecta ni se envia nada. */
	@Test
	void configuredJavaMailSenderHasTenSecondConnectionReadAndWriteTimeouts() {
		runner.withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class))
				.withPropertyValues("spring.mail.host=localhost").run(ctx -> {
					Properties props = ctx.getBean(JavaMailSenderImpl.class).getJavaMailProperties();
					assertThat(props.getProperty("mail.smtp.connectiontimeout")).isEqualTo("10000");
					assertThat(props.getProperty("mail.smtp.timeout")).isEqualTo("10000");
					assertThat(props.getProperty("mail.smtp.writetimeout")).isEqualTo("10000");
				});
	}

	/** Hallazgo de review (regla 12): sin STARTTLS obligatorio la contrasena SMTP podria viajar en texto plano. */
	@Test
	void configuredJavaMailSenderRequiresAuthAndStarttlsByDefault() {
		runner.withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class))
				.withPropertyValues("spring.mail.host=localhost").run(ctx -> {
					Properties props = ctx.getBean(JavaMailSenderImpl.class).getJavaMailProperties();
					assertThat(props.getProperty("mail.smtp.auth")).isEqualTo("true");
					assertThat(props.getProperty("mail.smtp.starttls.enable")).isEqualTo("true");
					assertThat(props.getProperty("mail.smtp.starttls.required")).isEqualTo("true");
				});
	}

	@Test
	void starttlsCanBeDisabledOnlyExplicitlyThroughSmtpStarttls() {
		runner.withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class))
				.withPropertyValues("spring.mail.host=localhost", "SMTP_STARTTLS=false").run(ctx -> {
					Properties props = ctx.getBean(JavaMailSenderImpl.class).getJavaMailProperties();
					assertThat(props.getProperty("mail.smtp.starttls.enable")).isEqualTo("false");
					assertThat(props.getProperty("mail.smtp.starttls.required")).isEqualTo("false");
					assertThat(props.getProperty("mail.smtp.auth")).isEqualTo("true");
				});
	}

	@Test
	void mailFromIsBlankByDefaultAndComesFromSmtpFromWhenDefined() {
		runner.run(ctx -> assertThat(ctx.getEnvironment().getProperty("app.mail.from")).isEqualTo(""));
		runner.withPropertyValues("SMTP_FROM=turnos@consultorio.test").run(
				ctx -> assertThat(ctx.getEnvironment().getProperty("app.mail.from")).isEqualTo("turnos@consultorio.test"));
	}
}
