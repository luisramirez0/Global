package ar.global.odonto.agenda.sillon;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LimiteSillonesTest {

	@Test
	void canActivateWhileBelowTheMaximum() {
		assertThat(LimiteSillones.permiteActivar(0)).isTrue();
		assertThat(LimiteSillones.permiteActivar(1)).isTrue();
	}

	@Test
	void cannotActivateAtTheMaximum() {
		assertThat(LimiteSillones.permiteActivar(2)).isFalse();
		assertThat(LimiteSillones.permiteActivar(3)).isFalse();
	}

	@Test
	void cannotDeactivateTheLastActive() {
		assertThat(LimiteSillones.permiteDesactivar(1)).isFalse();
		assertThat(LimiteSillones.permiteDesactivar(0)).isFalse();
	}

	@Test
	void canDeactivateWhileMoreThanOneIsActive() {
		assertThat(LimiteSillones.permiteDesactivar(2)).isTrue();
	}
}
