package ar.global.odonto.agenda.turno;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class IntervaloTurnoTest {

	private static IntervaloTurno de(String desde, String hasta) {
		return new IntervaloTurno(Instant.parse("2026-11-30T" + desde + ":00Z"),
				Instant.parse("2026-11-30T" + hasta + ":00Z"));
	}

	private static final IntervaloTurno BASE = de("10:00", "10:30");

	@Test
	void exactOverlapOverlaps() {
		assertThat(BASE.solapaCon(de("10:00", "10:30"))).isTrue();
	}

	@Test
	void partialOverlapOverlapsInBothDirections() {
		assertThat(BASE.solapaCon(de("10:15", "10:45"))).isTrue();
		assertThat(de("10:15", "10:45").solapaCon(BASE)).isTrue();
		assertThat(BASE.solapaCon(de("09:45", "10:15"))).isTrue();
	}

	@Test
	void containedAndContainingIntervalsOverlap() {
		assertThat(BASE.solapaCon(de("10:05", "10:20"))).isTrue();
		assertThat(BASE.solapaCon(de("09:00", "12:00"))).isTrue();
	}

	@Test
	void adjacentIntervalsDoNotOverlap() {
		assertThat(BASE.solapaCon(de("10:30", "11:00"))).isFalse();
		assertThat(BASE.solapaCon(de("09:30", "10:00"))).isFalse();
	}

	@Test
	void disjointIntervalsDoNotOverlap() {
		assertThat(BASE.solapaCon(de("14:00", "15:00"))).isFalse();
	}

	@Test
	void endMustBeAfterStart() {
		Instant t = Instant.parse("2026-11-30T10:00:00Z");
		assertThatThrownBy(() -> new IntervaloTurno(t, t)).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> new IntervaloTurno(t, t.minusSeconds(60)))
				.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void nullBoundsAreRejected() {
		Instant t = Instant.parse("2026-11-30T10:00:00Z");
		assertThatThrownBy(() -> new IntervaloTurno(null, t)).isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new IntervaloTurno(t, null)).isInstanceOf(NullPointerException.class);
	}

	@Test
	void keepsDurationWhenMovedToANewStart() {
		IntervaloTurno movido = BASE.movidoA(Instant.parse("2026-11-30T11:30:00Z"));
		assertThat(movido).isEqualTo(de("11:30", "12:00"));
	}
}
