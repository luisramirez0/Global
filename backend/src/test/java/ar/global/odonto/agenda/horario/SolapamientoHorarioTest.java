package ar.global.odonto.agenda.horario;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class SolapamientoHorarioTest {

	private static LocalTime h(int hour) {
		return LocalTime.of(hour, 0);
	}

	@Test
	void partialOverlapOverlaps() {
		assertThat(SolapamientoHorario.seSolapan(h(9), h(13), h(12), h(15))).isTrue();
		assertThat(SolapamientoHorario.seSolapan(h(12), h(15), h(9), h(13))).isTrue();
	}

	@Test
	void containedRangeOverlaps() {
		assertThat(SolapamientoHorario.seSolapan(h(9), h(13), h(10), h(11))).isTrue();
	}

	@Test
	void adjacentRangesDoNotOverlap() {
		assertThat(SolapamientoHorario.seSolapan(h(9), h(13), h(13), h(17))).isFalse();
		assertThat(SolapamientoHorario.seSolapan(h(9), h(13), h(8), h(9))).isFalse();
	}

	@Test
	void disjointRangesDoNotOverlap() {
		assertThat(SolapamientoHorario.seSolapan(h(9), h(10), h(14), h(15))).isFalse();
	}
}
