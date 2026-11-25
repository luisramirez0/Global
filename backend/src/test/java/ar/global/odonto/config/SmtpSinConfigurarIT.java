package ar.global.odonto.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.TestPropertySource;

/** C-09 tarea 5.1: sin {@code SMTP_HOST}/{@code SMTP_FROM} la aplicacion arranca igual (perfil test, sin SMTP). */
@SpringBootTest
// Aislado del entorno local: un SMTP_HOST/SMTP_FROM exportado en la maquina no debe cambiar el resultado.
@TestPropertySource(properties = { "spring.mail.host=", "app.mail.from=" })
class SmtpSinConfigurarIT {

	@Autowired
	private Environment env;

	@Test
	void contextStartsWithoutSmtpHostNorFrom() {
		assertThat(env.getProperty("spring.mail.host")).isBlank();
		assertThat(env.getProperty("app.mail.from")).isBlank();
		assertThat(env.getProperty("spring.mail.port")).isEqualTo("587");
	}
}
