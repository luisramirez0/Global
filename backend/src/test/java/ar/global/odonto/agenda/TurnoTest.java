package ar.global.odonto.agenda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.turno.IntervaloTurno;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * Defensas de ultima linea de la entidad (C-07 design D11), sin Spring: el servicio rechaza antes con 409, pero la
 * entidad nunca acepta una transicion de RN-AG-05 invalida ni mover un turno en estado final.
 */
class TurnoTest {

	private static final IntervaloTurno DIEZ = new IntervaloTurno(Instant.parse("2026-12-07T13:00:00Z"),
			Instant.parse("2026-12-07T13:30:00Z"));
	private static final IntervaloTurno ONCE = new IntervaloTurno(Instant.parse("2026-12-07T14:00:00Z"),
			Instant.parse("2026-12-07T14:30:00Z"));

	private static Turno nuevo() {
		return new Turno(null, null, null, null, DIEZ, false, "nota");
	}

	@Test
	void newTurnoIsProgramadoWithItsInterval() {
		Turno t = nuevo();

		assertThat(t.getEstado()).isEqualTo(EstadoTurno.PROGRAMADO);
		assertThat(t.getIntervalo()).isEqualTo(DIEZ);
		assertThat(t.getNotas()).isEqualTo("nota");
		assertThat(t.isEsSobreturno()).isFalse();
	}

	@Test
	void invalidTransitionIsRejectedAndStateIsKept() {
		Turno t = nuevo();
		t.cambiarEstado(EstadoTurno.CANCELADO, "motivo");

		assertThatThrownBy(() -> t.cambiarEstado(EstadoTurno.CONFIRMADO, null))
				.isInstanceOf(IllegalStateException.class);
		assertThat(t.getEstado()).isEqualTo(EstadoTurno.CANCELADO);
	}

	@Test
	void reasonIsStoredOnlyWhenCancelling() {
		Turno confirmado = nuevo();
		confirmado.cambiarEstado(EstadoTurno.CONFIRMADO, "ignorado");
		assertThat(confirmado.getMotivoCancelacion()).isNull();

		confirmado.cambiarEstado(EstadoTurno.CANCELADO, "viaja");
		assertThat(confirmado.getMotivoCancelacion()).isEqualTo("viaja");
	}

	@Test
	void reschedulingMovesIntervalAndSobreturnoFlag() {
		Turno t = nuevo();

		t.reprogramar(null, null, ONCE, true);

		assertThat(t.getIntervalo()).isEqualTo(ONCE);
		assertThat(t.isEsSobreturno()).isTrue();
		assertThat(t.getEstado()).isEqualTo(EstadoTurno.PROGRAMADO);
	}

	@Test
	void finalTurnoCannotBeRescheduled() {
		Turno t = nuevo();
		t.cambiarEstado(EstadoTurno.AUSENTE, null);

		assertThatThrownBy(() -> t.reprogramar(null, null, ONCE, false)).isInstanceOf(IllegalStateException.class);
		assertThat(t.getIntervalo()).isEqualTo(DIEZ);
	}
}
