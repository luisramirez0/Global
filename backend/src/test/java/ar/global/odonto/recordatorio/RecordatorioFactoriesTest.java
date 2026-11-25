package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.Turno;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** Factories de dominio de {@link Recordatorio} (C-09 design D11), sin Spring ni base. */
class RecordatorioFactoriesTest {

	private static final Instant GENERADO = Instant.parse("2026-11-25T14:00:00Z");
	private static final Instant ENVIADO = Instant.parse("2026-11-25T14:00:03Z");

	private final Turno turno = new Turno(null, null, null, null, Instant.parse("2026-12-02T12:00:00Z"),
			Instant.parse("2026-12-02T12:30:00Z"));

	@Test
	void enviadoIsEmailEnviadoWithBothInstantsAndNoError() {
		Recordatorio r = Recordatorio.enviado(turno, GENERADO, ENVIADO);

		assertThat(r.getTurno()).isSameAs(turno);
		assertThat(r.getCanal()).isEqualTo(CanalRecordatorio.EMAIL);
		assertThat(r.getEstado()).isEqualTo(EstadoRecordatorio.ENVIADO);
		assertThat(r.getGeneradoEn()).isEqualTo(GENERADO);
		assertThat(r.getEnviadoEn()).isEqualTo(ENVIADO);
		assertThat(r.getDetalleError()).isNull();
	}

	@Test
	void errorIsEmailErrorWithCodeAndNoEnviadoEn() {
		Recordatorio r = Recordatorio.error(turno, GENERADO, "SMTP_FALLO:MailSendException");

		assertThat(r.getTurno()).isSameAs(turno);
		assertThat(r.getCanal()).isEqualTo(CanalRecordatorio.EMAIL);
		assertThat(r.getEstado()).isEqualTo(EstadoRecordatorio.ERROR);
		assertThat(r.getGeneradoEn()).isEqualTo(GENERADO);
		assertThat(r.getEnviadoEn()).isNull();
		assertThat(r.getDetalleError()).isEqualTo("SMTP_FALLO:MailSendException");
	}

	@Test
	void errorCodeIsTruncatedTo500Characters() {
		Recordatorio r = Recordatorio.error(turno, GENERADO, "X".repeat(900));

		assertThat(r.getDetalleError()).hasSize(500).isEqualTo("X".repeat(500));
	}

	@Test
	void errorCodeOfExactly500IsKeptWhole() {
		assertThat(Recordatorio.error(turno, GENERADO, "Y".repeat(500)).getDetalleError()).hasSize(500);
	}
}
