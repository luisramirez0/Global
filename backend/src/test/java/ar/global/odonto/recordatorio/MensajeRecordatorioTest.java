package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** Spec appointment-reminders "Mensaje del recordatorio sin datos clínicos" (design D3). */
class MensajeRecordatorioTest {

	private static final ZoneId BUENOS_AIRES = ZoneId.of("America/Argentina/Buenos_Aires");

	@Test
	void formatsDateAndTimeInConsultorioZone() {
		String mensaje = MensajeRecordatorio.de(Instant.parse("2026-11-26T13:00:00Z"), BUENOS_AIRES, "Sonrisa",
				"Ana Pérez");

		assertThat(mensaje).isEqualTo("Recordatorio: tiene un turno el 26/11/2026 a las 10:00 en Sonrisa con Ana Pérez.");
	}

	@Test
	void zoneCanMoveTheLocalDate() {
		String mensaje = MensajeRecordatorio.de(Instant.parse("2026-11-27T02:30:00Z"), BUENOS_AIRES, "Sonrisa",
				"Ana Pérez");

		assertThat(mensaje).contains("el 26/11/2026 a las 23:30");
	}

	@Test
	void utcZoneChangesTheHour() {
		String mensaje = MensajeRecordatorio.de(Instant.parse("2026-11-26T13:00:00Z"), ZoneId.of("UTC"), "Sonrisa",
				"Ana Pérez");

		assertThat(mensaje).contains("el 26/11/2026 a las 13:00");
	}

	@Test
	void padsDayMonthHourAndMinuteWithZeros() {
		String mensaje = MensajeRecordatorio.de(Instant.parse("2027-01-05T12:05:00Z"), BUENOS_AIRES, "Sonrisa",
				"Ana Pérez");

		assertThat(mensaje).contains("el 05/01/2027 a las 09:05");
	}

	@Test
	void usesGivenConsultorioAndProfesionalNames() {
		String mensaje = MensajeRecordatorio.de(Instant.parse("2026-11-26T13:00:00Z"), BUENOS_AIRES, "Dental Sur",
				"Luis Gómez");

		assertThat(mensaje).endsWith("en Dental Sur con Luis Gómez.");
	}
}
