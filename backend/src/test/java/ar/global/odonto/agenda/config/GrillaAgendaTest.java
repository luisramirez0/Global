package ar.global.odonto.agenda.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/** Grilla provisional (SU-03, PA-03 pendiente): los casos se expresan en funcion de {@code MINUTOS}. */
class GrillaAgendaTest {

	private static final int G = GrillaAgenda.MINUTOS;

	@Test
	void durationsAreValidWhenPositiveMultiplesOfTheGridWithoutUpperCap() {
		assertThat(GrillaAgenda.esDuracionValida(G)).isTrue();
		assertThat(GrillaAgenda.esDuracionValida(2 * G)).isTrue();
		assertThat(GrillaAgenda.esDuracionValida(40 * G)).isTrue();
	}

	@Test
	void durationsAreInvalidWhenZeroNegativeOrNotAMultiple() {
		assertThat(GrillaAgenda.esDuracionValida(0)).isFalse();
		assertThat(GrillaAgenda.esDuracionValida(-G)).isFalse();
		assertThat(GrillaAgenda.esDuracionValida(G + 5)).isFalse();
	}

	@Test
	void timesAlignToTheGrid() {
		assertThat(GrillaAgenda.alineada(LocalTime.of(9, 0))).isTrue();
		assertThat(GrillaAgenda.alineada(LocalTime.of(9, 45))).isTrue();
	}

	@Test
	void timesOffTheGridOrWithSecondsAreNotAligned() {
		assertThat(GrillaAgenda.alineada(LocalTime.of(9, 10))).isFalse();
		assertThat(GrillaAgenda.alineada(LocalTime.of(9, 0, 30))).isFalse();
		assertThat(GrillaAgenda.alineada(LocalTime.of(9, 0, 0, 1))).isFalse();
	}
}
