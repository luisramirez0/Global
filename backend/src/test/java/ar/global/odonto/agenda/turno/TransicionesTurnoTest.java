package ar.global.odonto.agenda.turno;

import static ar.global.odonto.agenda.EstadoTurno.ASISTIO;
import static ar.global.odonto.agenda.EstadoTurno.AUSENTE;
import static ar.global.odonto.agenda.EstadoTurno.CANCELADO;
import static ar.global.odonto.agenda.EstadoTurno.CONFIRMADO;
import static ar.global.odonto.agenda.EstadoTurno.PROGRAMADO;
import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.EstadoTurno;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class TransicionesTurnoTest {

	/** RN-AG-05: las unicas 7 transiciones validas. */
	private static final Map<EstadoTurno, Set<EstadoTurno>> VALIDAS = Map.of(
			PROGRAMADO, EnumSet.of(CONFIRMADO, CANCELADO, ASISTIO, AUSENTE),
			CONFIRMADO, EnumSet.of(CANCELADO, ASISTIO, AUSENTE),
			CANCELADO, EnumSet.noneOf(EstadoTurno.class),
			ASISTIO, EnumSet.noneOf(EstadoTurno.class),
			AUSENTE, EnumSet.noneOf(EstadoTurno.class));

	@Test
	void fullMatrixMatchesRnAg05() {
		int validas = 0;
		for (EstadoTurno desde : EstadoTurno.values()) {
			for (EstadoTurno hacia : EstadoTurno.values()) {
				boolean esperado = VALIDAS.get(desde).contains(hacia);
				assertThat(TransicionesTurno.permitida(desde, hacia))
						.as("%s -> %s", desde, hacia).isEqualTo(esperado);
				if (esperado) {
					validas++;
				}
			}
		}
		assertThat(validas).isEqualTo(7);
	}

	@ParameterizedTest
	@EnumSource(EstadoTurno.class)
	void transitionToSameStateIsInvalid(EstadoTurno estado) {
		assertThat(TransicionesTurno.permitida(estado, estado)).isFalse();
	}

	@Test
	void finalStatesHaveNoExit() {
		for (EstadoTurno fin : EnumSet.of(CANCELADO, ASISTIO, AUSENTE)) {
			assertThat(TransicionesTurno.esFinal(fin)).as("%s", fin).isTrue();
		}
		assertThat(TransicionesTurno.esFinal(PROGRAMADO)).isFalse();
		assertThat(TransicionesTurno.esFinal(CONFIRMADO)).isFalse();
	}

	@Test
	void onlyOpenStatesCanBeRescheduled() {
		assertThat(TransicionesTurno.reprogramable(PROGRAMADO)).isTrue();
		assertThat(TransicionesTurno.reprogramable(CONFIRMADO)).isTrue();
		assertThat(TransicionesTurno.reprogramable(CANCELADO)).isFalse();
		assertThat(TransicionesTurno.reprogramable(ASISTIO)).isFalse();
		assertThat(TransicionesTurno.reprogramable(AUSENTE)).isFalse();
	}

	@Test
	void onlyAttendanceStatesRequireThatTheStartHasPassed() {
		assertThat(TransicionesTurno.requiereInicioPasado(ASISTIO)).isTrue();
		assertThat(TransicionesTurno.requiereInicioPasado(AUSENTE)).isTrue();
		assertThat(TransicionesTurno.requiereInicioPasado(CONFIRMADO)).isFalse();
		assertThat(TransicionesTurno.requiereInicioPasado(CANCELADO)).isFalse();
		assertThat(TransicionesTurno.requiereInicioPasado(PROGRAMADO)).isFalse();
	}
}
