package ar.global.odonto.recordatorio;

import static ar.global.odonto.recordatorio.RecordatorioFixture.EMAIL;
import static ar.global.odonto.recordatorio.RecordatorioFixture.TELEFONO;
import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.turno.AgendaDeTurnosFixture;
import ar.global.odonto.recordatorio.RecordatorioFixture.TurnoRecordable;
import ar.global.odonto.recordatorio.email.FakeEnvioEmail;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec appointment-reminders "Aislamiento por consultorio" (C-09 tarea 3.4, regla 2), patron de TurnoTenantIsolationIT. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class, AgendaDeTurnosFixture.class,
		RecordatorioFixture.class, FakeEnvioEmail.class })
class RecordatorioTenantIsolationIT {

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
	private FakeEnvioEmail fake;

	private String bearerA;
	private String bearerB;
	private TurnoRecordable turnoA;
	private TurnoRecordable turnoB;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		fake.reset();
		bearerA = auth.bearer(auth.registrar("recordatorio-a@a.test").email());
		bearerB = auth.bearer(auth.registrar("recordatorio-b@b.test").email());
		turnoA = turnosFixture.preparar(bearerA, "30111222", TELEFONO, EMAIL);
		turnoB = turnosFixture.preparar(bearerB, "30111222", TELEFONO, EMAIL);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private static String url(long turnoId) {
		return "/api/turnos/" + turnoId + "/recordatorio/whatsapp";
	}

	private long recordatorios() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM recordatorio", Long.class);
	}

	private long auditoria() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE entidad = 'Recordatorio'", Long.class);
	}

	@Test
	void turnoOfBIsNotFoundFromAAndNothingIsRegisteredInEither() throws Exception {
		MockHttpServletResponse r = api.get(bearerA, url(turnoB.turnoId()));

		assertThat(r.getStatus()).isEqualTo(404);
		assertThat(recordatorios()).isZero();
		assertThat(auditoria()).isZero();
	}

	@Test
	void turnoOfBIsNotFoundFromAEvenWhenAHasItsOwnReminder() throws Exception {
		assertThat(api.get(bearerA, url(turnoA.turnoId())).getStatus()).isEqualTo(200);

		assertThat(api.get(bearerA, url(turnoB.turnoId())).getStatus()).isEqualTo(404);

		assertThat(recordatorios()).isEqualTo(1);
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM recordatorio WHERE turno_id = ?", Long.class,
				turnoB.turnoId())).isZero();
	}

	@Test
	void eachTenantReachesItsOwnTurno() throws Exception {
		assertThat(api.get(bearerB, url(turnoB.turnoId())).getStatus()).isEqualTo(200);
		assertThat(api.get(bearerB, url(turnoA.turnoId())).getStatus()).isEqualTo(404);
	}

	@Test
	void pendientesOfAExcludeTurnosOfBOnTheSameDateAndViceVersa() throws Exception {
		// Ambos turnos caen el 2026-12-07 local; cada consultorio solo ve el suyo, tambien con ultimoRecordatorio.
		assertThat(api.get(bearerA, url(turnoA.turnoId())).getStatus()).isEqualTo(200); // A genera uno: sale de pendientes

		MockHttpServletResponse deA = api.get(bearerA, "/api/turnos/pendientes-recordatorio?fecha=2026-12-07");
		MockHttpServletResponse deB = api.get(bearerB, "/api/turnos/pendientes-recordatorio?fecha=2026-12-07");

		assertThat(deA.getStatus()).as(deA.getContentAsString()).isEqualTo(200);
		assertThat(api.json(deA)).isEmpty();
		assertThat(deB.getStatus()).as(deB.getContentAsString()).isEqualTo(200);
		assertThat(api.json(deB)).hasSize(1);
		assertThat(api.json(deB).get(0).get("turnoId").asLong()).isEqualTo(turnoB.turnoId());
	}

	@Test
	void eachTenantListsOnlyItsOwnPendingTurnoOfTheSameDate() throws Exception {
		MockHttpServletResponse deA = api.get(bearerA, "/api/turnos/pendientes-recordatorio?fecha=2026-12-07");
		MockHttpServletResponse deB = api.get(bearerB, "/api/turnos/pendientes-recordatorio?fecha=2026-12-07");

		assertThat(api.json(deA)).hasSize(1);
		assertThat(api.json(deA).get(0).get("turnoId").asLong()).isEqualTo(turnoA.turnoId());
		assertThat(api.json(deB)).hasSize(1);
		assertThat(api.json(deB).get(0).get("turnoId").asLong()).isEqualTo(turnoB.turnoId());
	}

	// ---- Email (tarea 5.4) ----

	private static String urlEmail(long turnoId) {
		return "/api/turnos/" + turnoId + "/recordatorio/email";
	}

	@Test
	void emailOfTurnoOfBIsNotFoundFromAFakeReceivesNothingAndNothingIsRegistered() throws Exception {
		MockHttpServletResponse r = api.post(bearerA, urlEmail(turnoB.turnoId()), "");

		assertThat(r.getStatus()).isEqualTo(404);
		assertThat(fake.envios()).isEmpty();
		assertThat(recordatorios()).isZero();
		assertThat(auditoria()).isZero();
	}

	@Test
	void eachTenantSendsOnlyForItsOwnTurno() throws Exception {
		assertThat(api.post(bearerB, urlEmail(turnoB.turnoId()), "").getStatus()).isEqualTo(201);
		assertThat(api.post(bearerB, urlEmail(turnoA.turnoId()), "").getStatus()).isEqualTo(404);

		assertThat(fake.envios()).hasSize(1);
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM recordatorio WHERE turno_id = ?", Long.class,
				turnoA.turnoId())).isZero();
	}
}
