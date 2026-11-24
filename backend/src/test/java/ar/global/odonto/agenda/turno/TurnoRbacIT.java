package ar.global.odonto.agenda.turno;

import static ar.global.odonto.agenda.turno.AgendaDeTurnosFixture.alta;
import static ar.global.odonto.agenda.turno.AgendaDeTurnosFixture.lunes;
import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.turno.AgendaDeTurnosFixture.Agenda;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/**
 * Spec appointment-scheduling "Permisos y aislamiento de turnos" (C-07 tarea 6.1): los tres roles operan turnos,
 * sobreturno incluido (design D3); sin token, 401 en todos los endpoints.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class, TestTokens.class, AgendaDeTurnosFixture.class })
class TurnoRbacIT {

	private static final String URL = "/api/turnos";
	private static final String DIA = URL + "?desde=2026-12-07T00:00:00Z&hasta=2026-12-08T00:00:00Z";

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private AgendaDeTurnosFixture agendas;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	private AuthFlows.Cuenta cuenta;
	private Agenda agenda;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("rbac-turnos@a.test");
		agenda = agendas.preparar(auth.bearer(cuenta.email()), "30111222");
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private String como(Rol rol) {
		return tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), rol);
	}

	@ParameterizedTest
	@EnumSource(Rol.class)
	void everyRoleCanRunTheWholeTurnoLifecycle(Rol rol) throws Exception {
		String bearer = como(rol);

		long id = agendas.creado(api.post(bearer, URL, alta(agenda, "10:00", null)));
		assertThat(api.get(bearer, URL + "/" + id).getStatus()).isEqualTo(200);
		assertThat(api.get(bearer, DIA).getStatus()).isEqualTo(200);
		assertThat(api.put(bearer, URL + "/" + id, "{\"inicio\":\"" + lunes("11:00") + "\"}").getStatus())
				.isEqualTo(200);
		assertThat(api.patch(bearer, URL + "/" + id + "/estado", "{\"estado\":\"CONFIRMADO\"}").getStatus())
				.isEqualTo(200);
		assertThat(api.patch(bearer, URL + "/" + id + "/estado", "{\"estado\":\"CANCELADO\"}").getStatus())
				.isEqualTo(200);
	}

	@ParameterizedTest
	@EnumSource(Rol.class)
	void everyRoleCanBookASobreturnoAndItIsAuditedWithTheUser(Rol rol) throws Exception {
		MockHttpServletResponse r = api.post(como(rol), URL, alta(agenda, "08:30", "\"sobreturno\":true"));

		assertThat(r.getStatus()).isEqualTo(201);
		long id = api.json(r).get("id").asLong();
		assertThat(jdbc.queryForObject(
				"SELECT usuario_id FROM audit_log WHERE entidad = 'Turno' AND accion = 'CREATE' AND entidad_id = ?",
				Long.class, id)).isEqualTo(cuenta.usuarioId());
	}

	@Test
	void withoutTokenEveryEndpointIs401AndNothingChanges() throws Exception {
		long id = agendas.creado(api.post(como(Rol.ADMIN), URL, alta(agenda, "10:00", null)));

		MockHttpServletResponse[] respuestas = {
				mockMvc.perform(MockMvcRequestBuilders.get(DIA)).andReturn().getResponse(),
				mockMvc.perform(MockMvcRequestBuilders.get(URL + "/" + id)).andReturn().getResponse(),
				mockMvc.perform(MockMvcRequestBuilders.post(URL).contentType("application/json")
						.content(alta(agenda, "11:00", null))).andReturn().getResponse(),
				mockMvc.perform(MockMvcRequestBuilders.patch(URL + "/" + id + "/estado").contentType("application/json")
						.content("{\"estado\":\"CANCELADO\"}")).andReturn().getResponse(),
				mockMvc.perform(MockMvcRequestBuilders.put(URL + "/" + id).contentType("application/json")
						.content("{\"inicio\":\"" + lunes("12:00") + "\"}")).andReturn().getResponse() };

		for (MockHttpServletResponse r : respuestas) {
			assertThat(r.getStatus()).isEqualTo(401);
		}
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM turno", Long.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject("SELECT estado FROM turno WHERE id = ?", String.class, id))
				.isEqualTo("PROGRAMADO");
	}
}
