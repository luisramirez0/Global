package ar.global.odonto.agenda.turno;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.config.GrillaAgenda;
import ar.global.odonto.agenda.turno.ReglasAgenda.BloqueoVigente;
import ar.global.odonto.agenda.turno.ReglasAgenda.FranjaAtencion;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class ReglasAgendaTest {

	private static final ZoneId BA = ZoneId.of("America/Argentina/Buenos_Aires");
	/** 2026-11-30 es lunes (diaSemana ISO 1). */
	private static final String LUNES = "2026-11-30";
	private static final int LUNES_ISO = 1;

	private static Instant local(String fecha, String hora) {
		return LocalDateTime.parse(fecha + "T" + hora).atZone(BA).toInstant();
	}

	private static IntervaloTurno turnoLocal(String fecha, String hora, int minutos) {
		Instant inicio = local(fecha, hora);
		return new IntervaloTurno(inicio, inicio.plus(Duration.ofMinutes(minutos)));
	}

	private static FranjaAtencion franja(int dia, String desde, String hasta) {
		return new FranjaAtencion(dia, LocalTime.parse(desde), LocalTime.parse(hasta));
	}

	@Nested
	class HorarioDeAtencion {

		private final List<FranjaAtencion> lunes9a13 = List.of(franja(LUNES_ISO, "09:00", "13:00"));

		@Test
		void utcInstantIsEvaluatedInTheConsultorioZone() {
			IntervaloTurno t = new IntervaloTurno(Instant.parse(LUNES + "T12:00:00Z"),
					Instant.parse(LUNES + "T12:30:00Z"));
			assertThat(ReglasAgenda.cabeEnHorario(t, BA, lunes9a13)).isTrue();
			IntervaloTurno mismoInstanteEnUtc = new IntervaloTurno(Instant.parse(LUNES + "T09:00:00Z"),
					Instant.parse(LUNES + "T09:30:00Z"));
			assertThat(ReglasAgenda.cabeEnHorario(mismoInstanteEnUtc, BA, lunes9a13)).isFalse();
		}

		@Test
		void turnoInsideTheFranjaFits() {
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "10:00", 30), BA, lunes9a13)).isTrue();
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "09:00", 30), BA, lunes9a13)).isTrue();
		}

		@Test
		void turnoEndingExactlyAtClosingFits() {
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "12:30", 30), BA, lunes9a13)).isTrue();
		}

		@Test
		void turnoBeforeOpeningDoesNotFit() {
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "08:30", 30), BA, lunes9a13)).isFalse();
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "08:45", 30), BA, lunes9a13)).isFalse();
		}

		@Test
		void turnoCrossingClosingDoesNotFit() {
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "12:45", 30), BA, lunes9a13)).isFalse();
		}

		@Test
		void contiguousFranjasAreNotChained() {
			List<FranjaAtencion> partida = List.of(franja(LUNES_ISO, "09:00", "11:00"),
					franja(LUNES_ISO, "11:00", "13:00"));
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "10:30", 60), BA, partida)).isFalse();
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "11:00", 60), BA, partida)).isTrue();
		}

		@Test
		void franjaOfAnotherDayDoesNotApply() {
			List<FranjaAtencion> martes = List.of(franja(2, "09:00", "13:00"));
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "10:00", 30), BA, martes)).isFalse();
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal("2026-12-01", "10:00", 30), BA, martes)).isTrue();
		}

		@Test
		void noFranjasMeansNothingFits() {
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "10:00", 30), BA, List.of())).isFalse();
		}

		@Test
		void turnoCrossingLocalMidnightNeverFits() {
			// Comparar solo horas locales aceptaria 23:30-00:30 (00:00 <= 23:30 y 00:30 <= 23:59): la fecha importa.
			List<FranjaAtencion> todoElDia = List.of(franja(LUNES_ISO, "00:00", "23:59"),
					franja(2, "00:00", "23:59"));
			assertThat(ReglasAgenda.cabeEnHorario(turnoLocal(LUNES, "23:30", 60), BA, todoElDia)).isFalse();
		}
	}

	@Nested
	class Grilla {

		@Test
		void startAlignedToTheGridInLocalTime() {
			assertThat(ReglasAgenda.inicioAlineado(local(LUNES, "10:00"), BA)).isTrue();
			assertThat(ReglasAgenda.inicioAlineado(local(LUNES, "10:00").plus(Duration.ofMinutes(GrillaAgenda.MINUTOS)),
					BA)).isTrue();
		}

		@Test
		void startOffTheGridIsRejected() {
			assertThat(ReglasAgenda.inicioAlineado(local(LUNES, "10:10"), BA)).isFalse();
			assertThat(ReglasAgenda.inicioAlineado(local(LUNES, "10:00").plusSeconds(30), BA)).isFalse();
		}
	}

	@Nested
	class Bloqueos {

		private static final long SILLON_1 = 1L;
		private static final long SILLON_2 = 2L;
		private static final long PROF_P = 10L;
		private static final long PROF_Q = 20L;

		private final IntervaloTurno onceADoce = turnoLocal(LUNES, "11:00", 60);

		private BloqueoVigente bloqueo(Long sillonId, Long profesionalId, IntervaloTurno intervalo) {
			return new BloqueoVigente(99L, sillonId, profesionalId, intervalo);
		}

		@Test
		void sillonBlockAppliesOnlyToThatSillon() {
			BloqueoVigente b = bloqueo(SILLON_1, null, onceADoce);
			IntervaloTurno t = turnoLocal(LUNES, "11:00", 30);
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_1, PROF_P)).isTrue();
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_2, PROF_P)).isFalse();
		}

		@Test
		void profesionalBlockAppliesToThatProfesionalOnAnySillon() {
			BloqueoVigente b = bloqueo(null, PROF_P, onceADoce);
			IntervaloTurno t = turnoLocal(LUNES, "11:30", 30);
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_1, PROF_P)).isTrue();
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_2, PROF_P)).isTrue();
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_1, PROF_Q)).isFalse();
		}

		@Test
		void blockOfBothAppliesOnlyWhenBothMatch() {
			BloqueoVigente b = bloqueo(SILLON_1, PROF_P, onceADoce);
			IntervaloTurno t = turnoLocal(LUNES, "11:00", 30);
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_1, PROF_P)).isTrue();
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_1, PROF_Q)).isFalse();
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_2, PROF_P)).isFalse();
		}

		@Test
		void consultorioWideBlockAppliesToEverything() {
			BloqueoVigente b = bloqueo(null, null, onceADoce);
			IntervaloTurno t = turnoLocal(LUNES, "11:30", 30);
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_1, PROF_P)).isTrue();
			assertThat(ReglasAgenda.bloqueoAplica(b, t, SILLON_2, PROF_Q)).isTrue();
		}

		@Test
		void adjacentOrDisjointBlockDoesNotApply() {
			BloqueoVigente b = bloqueo(null, null, onceADoce);
			assertThat(ReglasAgenda.bloqueoAplica(b, turnoLocal(LUNES, "12:00", 30), SILLON_1, PROF_P)).isFalse();
			assertThat(ReglasAgenda.bloqueoAplica(b, turnoLocal(LUNES, "10:30", 30), SILLON_1, PROF_P)).isFalse();
			assertThat(ReglasAgenda.bloqueoAplica(b, turnoLocal(LUNES, "09:00", 30), SILLON_1, PROF_P)).isFalse();
		}

		@Test
		void firstApplicableBlockIsReturned() {
			BloqueoVigente otroSillon = new BloqueoVigente(1L, SILLON_2, null, onceADoce);
			BloqueoVigente aplica = new BloqueoVigente(2L, SILLON_1, null, onceADoce);
			IntervaloTurno t = turnoLocal(LUNES, "11:00", 30);
			assertThat(ReglasAgenda.primerBloqueoAplicable(List.of(otroSillon, aplica), t, SILLON_1, PROF_P))
					.contains(aplica);
			assertThat(ReglasAgenda.primerBloqueoAplicable(List.of(otroSillon), t, SILLON_1, PROF_P)).isEmpty();
		}
	}

	@Nested
	class Sobreturno {

		@Test
		void withFlagSkipsProfesionalHorarioGrillaAndBloqueos() {
			ExcepcionesSobreturno con = ExcepcionesSobreturno.para(true);
			assertThat(con.verificaProfesional()).isFalse();
			assertThat(con.verificaHorarioYGrilla()).isFalse();
			assertThat(con.verificaBloqueos()).isFalse();
		}

		@Test
		void sillonIsAlwaysVerified() {
			assertThat(ExcepcionesSobreturno.para(true).verificaSillon()).isTrue();
			assertThat(ExcepcionesSobreturno.para(false).verificaSillon()).isTrue();
		}

		@Test
		void withoutFlagEverythingIsVerified() {
			ExcepcionesSobreturno sin = ExcepcionesSobreturno.para(false);
			assertThat(sin.verificaProfesional()).isTrue();
			assertThat(sin.verificaHorarioYGrilla()).isTrue();
			assertThat(sin.verificaBloqueos()).isTrue();
		}
	}
}
