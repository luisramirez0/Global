package ar.global.odonto.testsupport;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Reloj controlable (fijo en 2026-11-23T13:00:00Z) que reemplaza al reloj del sistema en los tests. */
@TestConfiguration(proxyBeanMethods = false)
public class TestClockConfig {

	public static final Instant START = Instant.parse("2026-11-23T13:00:00Z");

	@Bean
	@Primary
	public MutableClock testClock() {
		return new MutableClock(START);
	}

	public static final class MutableClock extends Clock {

		private volatile Instant now;

		public MutableClock(Instant now) {
			this.now = now;
		}

		public void set(Instant instant) {
			this.now = instant;
		}

		public void advance(Duration duration) {
			this.now = now.plus(duration);
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return now;
		}
	}
}
