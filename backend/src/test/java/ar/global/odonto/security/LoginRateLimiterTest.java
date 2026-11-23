package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import java.time.Duration;
import org.junit.jupiter.api.Test;

/** Spec authentication "Límite de intentos de login" (unitario, design D7). */
class LoginRateLimiterTest {

	private static final String CLAVE = LoginRateLimiter.clave("10.0.0.1", "ana@consultorio.test");

	private final MutableClock clock = new MutableClock(TestClockConfig.START);
	private final LoginRateLimiter limiter = new LoginRateLimiter(clock);

	@Test
	void fourFailuresStillAllowAnotherAttempt() {
		fail(4);

		assertThatCode(() -> limiter.verificar(CLAVE)).doesNotThrowAnyException();
	}

	@Test
	void fiveFailuresBlockWithRetryAfterUntilTheFirstOneExpires() {
		limiter.registrarFallo(CLAVE);
		clock.advance(Duration.ofMinutes(5));
		fail(4);

		assertThatThrownBy(() -> limiter.verificar(CLAVE)).isInstanceOfSatisfying(DemasiadosIntentosException.class,
				e -> assertThat(e.getRetryAfterSeconds()).isEqualTo(Duration.ofMinutes(10).toSeconds()));
	}

	@Test
	void windowReleasesFifteenMinutesAfterTheFirstFailure() {
		fail(5);
		clock.advance(Duration.ofMinutes(15));

		assertThatCode(() -> limiter.verificar(CLAVE)).doesNotThrowAnyException();
	}

	@Test
	void otherIpOrEmailIsNotAffected() {
		fail(5);

		assertThatCode(() -> limiter.verificar(LoginRateLimiter.clave("10.0.0.2", "ana@consultorio.test")))
				.doesNotThrowAnyException();
		assertThatCode(() -> limiter.verificar(LoginRateLimiter.clave("10.0.0.1", "otro@consultorio.test")))
				.doesNotThrowAnyException();
	}

	@Test
	void keyIgnoresEmailCasing() {
		assertThat(LoginRateLimiter.clave("10.0.0.1", " ANA@Consultorio.test "))
				.isEqualTo(LoginRateLimiter.clave("10.0.0.1", "ana@consultorio.test"));
	}

	@Test
	void resetClearsTheCounter() {
		fail(4);
		limiter.reset(CLAVE);
		fail(4);

		assertThatCode(() -> limiter.verificar(CLAVE)).doesNotThrowAnyException();
	}

	@Test
	void expiredKeysArePurged() {
		fail(3);
		clock.advance(Duration.ofMinutes(16));
		limiter.registrarFallo(LoginRateLimiter.clave("10.0.0.9", "x@x.test"));

		assertThat(limiter.clavesActivas()).isEqualTo(1);
	}

	private void fail(int times) {
		for (int i = 0; i < times; i++) {
			limiter.registrarFallo(CLAVE);
		}
	}
}
