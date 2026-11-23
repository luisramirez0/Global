package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordConfigTest {

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
			.withUserConfiguration(PasswordConfig.class);

	@Test
	void passwordEncoderIsBcryptWithCostTwelve() {
		runner.run(ctx -> {
			PasswordEncoder encoder = ctx.getBean(PasswordEncoder.class);

			assertThat(encoder).isInstanceOf(BCryptPasswordEncoder.class);
			assertThat(encoder.encode("secret")).startsWith("$2a$12$");
		});
	}

	@Test
	void matchesVerifiesAnEncodedPasswordAndRejectsAWrongOne() {
		runner.run(ctx -> {
			PasswordEncoder encoder = ctx.getBean(PasswordEncoder.class);
			String hash = encoder.encode("correct horse");

			assertThat(encoder.matches("correct horse", hash)).isTrue();
			assertThat(encoder.matches("wrong horse", hash)).isFalse();
		});
	}

	@Test
	void sameRawPasswordProducesDifferentHashesBecauseOfTheSalt() {
		runner.run(ctx -> {
			PasswordEncoder encoder = ctx.getBean(PasswordEncoder.class);

			assertThat(encoder.encode("same")).isNotEqualTo(encoder.encode("same"));
		});
	}
}
