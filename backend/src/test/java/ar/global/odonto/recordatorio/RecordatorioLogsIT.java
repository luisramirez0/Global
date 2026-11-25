package ar.global.odonto.recordatorio;

import static ar.global.odonto.recordatorio.RecordatorioFixture.APELLIDO;
import static ar.global.odonto.recordatorio.RecordatorioFixture.EMAIL;
import static ar.global.odonto.recordatorio.RecordatorioFixture.NOMBRE;
import static ar.global.odonto.recordatorio.RecordatorioFixture.NOTAS;
import static ar.global.odonto.recordatorio.RecordatorioFixture.TELEFONO;
import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.turno.AgendaDeTurnosFixture;
import ar.global.odonto.recordatorio.RecordatorioFixture.TurnoRecordable;
import ar.global.odonto.recordatorio.email.EnvioEmailFallidoException;
import ar.global.odonto.recordatorio.email.FakeEnvioEmail;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Spec appointment-reminders "datos personales fuera de logs" (regla 5, C-09 tarea 6.2, design D9): los logs de
 * recordatorios llevan solo ids (y el codigo fijo de falla), nunca telefono, email, nombre, enlace ni texto.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class, AgendaDeTurnosFixture.class,
		RecordatorioFixture.class, TestClockConfig.class, FakeEnvioEmail.class })
class RecordatorioLogsIT {

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private RecordatorioFixture turnosFixture;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private MutableClock clock;

	@Autowired
	private FakeEnvioEmail fake;

	private String bearer;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		clock.set(TestClockConfig.START);
		fake.reset();
		bearer = auth.bearer(auth.registrar("logs-recordatorio@a.test").email());
	}

	@AfterEach
	void clean() {
		fake.reset();
		fixtures.cleanAll();
	}

	private long unicoRecordatorioId() {
		return jdbc.queryForObject("SELECT id FROM recordatorio", Long.class);
	}

	private static void assertSinDatosPersonales(CapturedOutput output) {
		assertThat(output.getAll()).doesNotContain(TELEFONO).doesNotContain(TELEFONO.substring(1))
				.doesNotContain(EMAIL).doesNotContain(NOMBRE).doesNotContain(APELLIDO).doesNotContain(NOTAS)
				.doesNotContain("wa.me").doesNotContain("Recordatorio: tiene un turno");
	}

	@Test
	void whatsAppLinkLogsOnlyIds(CapturedOutput output) throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);

		MockHttpServletResponse r = api.get(bearer, "/api/turnos/" + t.turnoId() + "/recordatorio/whatsapp");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		assertThat(output.getAll()).contains("recordatorioId=" + unicoRecordatorioId())
				.contains("turnoId=" + t.turnoId());
		assertSinDatosPersonales(output);
	}

	@Test
	void failedEmailLogsOnlyIdsAndTheFixedCode(CapturedOutput output) throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		fake.fallaCon(new EnvioEmailFallidoException("SMTP_FALLO:MailSendException"));

		MockHttpServletResponse r = api.post(bearer, "/api/turnos/" + t.turnoId() + "/recordatorio/email", "");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(502);
		assertThat(output.getAll()).contains("recordatorioId=" + unicoRecordatorioId())
				.contains("turnoId=" + t.turnoId()).contains("codigo=SMTP_FALLO:MailSendException");
		assertSinDatosPersonales(output);
	}

	@Test
	void sentEmailLogsOnlyIds(CapturedOutput output) throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);

		MockHttpServletResponse r = api.post(bearer, "/api/turnos/" + t.turnoId() + "/recordatorio/email", "");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(201);
		assertThat(output.getAll()).contains("recordatorioId=" + unicoRecordatorioId())
				.contains("turnoId=" + t.turnoId());
		assertSinDatosPersonales(output);
	}

	@Test
	void unexpectedSenderFailureWithTheEmailInItsMessageDoesNotLeakIt(CapturedOutput output) throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		fake.fallaCon(new IllegalStateException("rechazado " + EMAIL + " " + TELEFONO));

		MockHttpServletResponse r = api.post(bearer, "/api/turnos/" + t.turnoId() + "/recordatorio/email", "");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(500);
		assertThat(output.getAll()).contains("Error no controlado");
		assertSinDatosPersonales(output);
	}

	@Test
	void turnoVanishedAfterSendingIsGeneric500AndLogsOnlyTheIdAndTheClassName(CapturedOutput output) throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		fake.alEnviar(() -> jdbc.update("DELETE FROM turno WHERE id = ?", t.turnoId()));

		MockHttpServletResponse r = api.post(bearer, "/api/turnos/" + t.turnoId() + "/recordatorio/email", "");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(500);
		assertThat(r.getContentAsString()).contains("Error interno").doesNotContain(EMAIL).doesNotContain(NOMBRE);
		assertThat(output.getAll()).contains("turnoId=" + t.turnoId()).contains("causa=IllegalStateException");
		assertSinDatosPersonales(output);
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM recordatorio", Long.class)).isZero();
	}
}
