package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.config.ClockConfig;
import ar.global.odonto.config.PropertiesConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

/** Spec runtime-configuration: "Secreto JWT obligatorio y robusto" (fail-fast sin filtrar el valor). */
class JwtSecretValidationTest {

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
			.withUserConfiguration(PropertiesConfig.class, ClockConfig.class, JwtConfig.class)
			.withPropertyValues("app.jwt.expiration-min=30");

	@Test
	void missingSecretPreventsStartupNamingTheVariable() {
		runner.run(ctx -> {
			assertThat(ctx).hasFailed();
			assertThat(rootMessage(ctx.getStartupFailure())).contains("JWT_SECRET");
		});
	}

	@ParameterizedTest
	@ValueSource(strings = { " ", "corto", "abcdefghijklmnopqrstuvwxyz01234" /* 31 bytes */ })
	void shortSecretPreventsStartupWithoutLeakingTheValue(String secret) {
		runner.withPropertyValues("app.jwt.secret=" + secret).run(ctx -> {
			assertThat(ctx).hasFailed();
			String message = rootMessage(ctx.getStartupFailure());
			assertThat(message).contains("JWT_SECRET");
			if (!secret.isBlank()) {
				assertThat(message).doesNotContain(secret);
			}
		});
	}

	@Test
	void secretOf32BytesStartsAndExposesEncoderAndDecoder() {
		runner.withPropertyValues("app.jwt.secret=abcdefghijklmnopqrstuvwxyz012345").run(ctx -> {
			assertThat(ctx).hasNotFailed();
			assertThat(ctx).hasSingleBean(JwtEncoder.class).hasSingleBean(JwtDecoder.class);
		});
	}

	private static String rootMessage(Throwable failure) {
		Throwable t = failure;
		while (t.getCause() != null) {
			t = t.getCause();
		}
		return String.valueOf(t.getMessage());
	}
}
