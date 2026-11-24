package ar.global.odonto.agenda.turno;

import static ar.global.odonto.agenda.turno.AgendaDeTurnosFixture.alta;
import static ar.global.odonto.agenda.turno.AgendaDeTurnosFixture.lunes;
import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.turno.AgendaDeTurnosFixture.Agenda;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Spec appointment-scheduling "Permisos y aislamiento de turnos" (C-07 tarea 6.2, regla 2): A y B registrados por la
 * API, cada uno con su agenda (mismo DNI de paciente: es unico por consultorio). Con el token de A, todo lo de B es
 * invisible (404) o una referencia invalida (422), y los turnos de B no ocupan lugar en A.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class, AgendaDeTurnosFixture.class })
class TurnoTenantIsolationIT {

	private static final String URL = "/api/turnos";
	private static final String DIA = URL + "?desde=2026-12-07T00:00:00Z&hasta=2026-12-08T00:00:00Z";
	private static final String DNI = "30111222";

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private AgendaDeTurnosFixture agendas;

	@Autowired
	private JdbcTemplate jdbc;

	private String bearerA;
	private String bearerB;
	private AuthFlows.Cuenta cuentaA;
	private AuthFlows.Cuenta cuentaB;
	private Agenda a;
	private Agenda b;
	private long turnoB;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuentaA = auth.registrar("turnos-a@a.test");
		cuentaB = auth.registrar("turnos-b@b.test");
		bearerA = auth.bearer(cuentaA.email());
		bearerB = auth.bearer(cuentaB.email());
		a = agendas.preparar(bearerA, DNI);
		b = agendas.preparar(bearerB, DNI);
		turnoB = agendas.creado(api.post(bearerB, URL, alta(b, "10:00", null)));
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private List<Long> idsTurnos(MockHttpServletResponse r) throws Exception {
		List<Long> ids = new ArrayList<>();
		api.json(r).forEach(t -> ids.add(t.get("id").asLong()));
		return ids;
	}

	private String estadoDeB() {
		return jdbc.queryForObject("SELECT estado FROM turno WHERE id = ?", String.class, turnoB);
	}

	@Test
	void turnoOfBIsNotFoundFromAAndStaysUnchanged() throws Exception {
		assertThat(api.get(bearerA, URL + "/" + turnoB).getStatus()).isEqualTo(404);
		assertThat(api.patch(bearerA, URL + "/" + turnoB + "/estado", "{\"estado\":\"CANCELADO\"}").getStatus())
				.isEqualTo(404);
		assertThat(api.put(bearerA, URL + "/" + turnoB, "{\"inicio\":\"" + lunes("11:00") + "\"}").getStatus())
				.isEqualTo(404);

		assertThat(estadoDeB()).isEqualTo("PROGRAMADO");
		// Valor UTC tal como esta guardado (un Timestamp JDBC lo reinterpretaria en la zona de la JVM).
		assertThat(jdbc.queryForObject("SELECT FORMATDATETIME(inicio, 'yyyy-MM-dd HH:mm:ss') FROM turno WHERE id = ?",
				String.class, turnoB)).isEqualTo("2026-12-07 13:00:00");
	}

	@Test
	void referencesOfBInABodyAre422NamingTheField() throws Exception {
		String[][] casos = {
				{ "pacienteId", "{\"pacienteId\":" + b.pacienteId() + ",\"prestacionId\":" + a.prestacionId()
						+ ",\"sillonId\":" + a.sillonId() + ",\"inicio\":\"" + lunes("10:00") + "\"}" },
				{ "prestacionId", "{\"pacienteId\":" + a.pacienteId() + ",\"prestacionId\":" + b.prestacionId()
						+ ",\"sillonId\":" + a.sillonId() + ",\"inicio\":\"" + lunes("10:00") + "\"}" },
				{ "sillonId", "{\"pacienteId\":" + a.pacienteId() + ",\"prestacionId\":" + a.prestacionId()
						+ ",\"sillonId\":" + b.sillonId() + ",\"inicio\":\"" + lunes("10:00") + "\"}" },
				{ "profesionalId", alta(a, "10:00", "\"profesionalId\":" + b.profesionalId()) } };

		for (String[] caso : casos) {
			MockHttpServletResponse r = api.post(bearerA, URL, caso[1]);
			assertThat(r.getStatus()).as(caso[0]).isEqualTo(422);
			assertThat(api.campos(r)).as(caso[0]).containsExactly(caso[0]);
		}
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM turno WHERE consultorio_id = ?", Long.class,
				cuentaA.consultorioId())).isZero();
	}

	@Test
	void reschedulingOntoSillonOrProfesionalOfBIs422() throws Exception {
		long turnoA = agendas.creado(api.post(bearerA, URL, alta(a, "10:00", null)));

		MockHttpServletResponse sillon = api.put(bearerA, URL + "/" + turnoA,
				"{\"inicio\":\"" + lunes("11:00") + "\",\"sillonId\":" + b.sillonId() + "}");
		MockHttpServletResponse profesional = api.put(bearerA, URL + "/" + turnoA,
				"{\"inicio\":\"" + lunes("11:00") + "\",\"profesionalId\":" + b.profesionalId() + "}");

		assertThat(sillon.getStatus()).isEqualTo(422);
		assertThat(api.campos(sillon)).containsExactly("sillonId");
		assertThat(profesional.getStatus()).isEqualTo(422);
		assertThat(api.campos(profesional)).containsExactly("profesionalId");
	}

	@Test
	void turnoOfBInTheSameSlotDoesNotCollideInA() throws Exception {
		MockHttpServletResponse r = api.post(bearerA, URL, alta(a, "10:00", null));

		assertThat(r.getStatus()).isEqualTo(201);
	}

	@Test
	void agendaOfAShowsOnlyTurnosOfA() throws Exception {
		long turnoA = agendas.creado(api.post(bearerA, URL, alta(a, "11:00", null)));

		assertThat(idsTurnos(api.get(bearerA, DIA + "&incluirCancelados=true"))).containsExactly(turnoA);
		assertThat(idsTurnos(api.get(bearerA, DIA + "&sillonId=" + b.sillonId()))).isEmpty();
		assertThat(idsTurnos(api.get(bearerA, DIA + "&profesionalId=" + b.profesionalId()))).isEmpty();
		assertThat(idsTurnos(api.get(bearerB, DIA))).containsExactly(turnoB);
	}

	@Test
	void auditRowsStayInTheirOwnConsultorio() throws Exception {
		long turnoA = agendas.creado(api.post(bearerA, URL, alta(a, "11:00", null)));

		assertThat(jdbc.queryForObject("SELECT consultorio_id FROM audit_log WHERE entidad = 'Turno' AND entidad_id = ?",
				Long.class, turnoA)).isEqualTo(cuentaA.consultorioId());
		assertThat(jdbc.queryForObject("SELECT consultorio_id FROM audit_log WHERE entidad = 'Turno' AND entidad_id = ?",
				Long.class, turnoB)).isEqualTo(cuentaB.consultorioId());
	}
}
