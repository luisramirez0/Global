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

/** Spec appointment-reminders "Permisos" (C-09 tarea 3.4, WhatsApp): los tres roles operan; sin token, 401. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class, TestTokens.class, AgendaDeTurnosFixture.class,
		RecordatorioFixture.class, FakeEnvioEmail.class })
class RecordatorioRbacIT {

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private RecordatorioFixture turnosFixture;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private FakeEnvioEmail fake;

	@Autowired
	private JdbcTemplate jdbc;

	private AuthFlows.Cuenta cuenta;
	private TurnoRecordable turno;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		fake.reset();
		cuenta = auth.registrar("rbac-recordatorio@a.test");
		turno = turnosFixture.preparar(auth.bearer(cuenta.email()), "30111222", TELEFONO, EMAIL);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private String como(Rol rol) {
		return tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), rol);
	}

	private String url() {
		return "/api/turnos/" + turno.turnoId() + "/recordatorio/whatsapp";
	}

	private long recordatorios() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM recordatorio", Long.class);
	}

	@ParameterizedTest
	@EnumSource(Rol.class)
	void everyRoleGetsTheLinkAndItIsAuditedWithTheUser(Rol rol) throws Exception {
		MockHttpServletResponse r = api.get(como(rol), url());

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		long id = api.json(r).get("recordatorioId").asLong();
		assertThat(jdbc.queryForObject(
				"SELECT usuario_id FROM audit_log WHERE entidad = 'Recordatorio' AND accion = 'CREATE' AND entidad_id = ?",
				Long.class, id)).isEqualTo(cuenta.usuarioId());
		assertThat(recordatorios()).isEqualTo(1);
	}

	@Test
	void withoutTokenIs401AndNothingIsRegistered() throws Exception {
		MockHttpServletResponse r = mockMvc.perform(MockMvcRequestBuilders.get(url())).andReturn().getResponse();

		assertThat(r.getStatus()).isEqualTo(401);
		assertThat(recordatorios()).isZero();
	}

	@Test
	void invalidTokenIs401AndNothingIsRegistered() throws Exception {
		String manipulado = tokens.tamper(como(Rol.ADMIN).substring("Bearer ".length()), "rol", "ADMIN");

		MockHttpServletResponse r = api.get("Bearer " + manipulado + "x", url());

		assertThat(r.getStatus()).isEqualTo(401);
		assertThat(recordatorios()).isZero();
	}

	@ParameterizedTest
	@EnumSource(Rol.class)
	void everyRoleListsPendientes(Rol rol) throws Exception {
		MockHttpServletResponse r = api.get(como(rol), "/api/turnos/pendientes-recordatorio?fecha=2026-12-07");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		assertThat(api.json(r).isArray()).isTrue();
		assertThat(recordatorios()).isZero();
	}

	@Test
	void pendientesWithoutTokenIs401() throws Exception {
		MockHttpServletResponse r = mockMvc
				.perform(MockMvcRequestBuilders.get("/api/turnos/pendientes-recordatorio?fecha=2026-12-07"))
				.andReturn().getResponse();

		assertThat(r.getStatus()).isEqualTo(401);
	}

	// ---- Email (tarea 5.4) ----

	private String urlEmail() {
		return "/api/turnos/" + turno.turnoId() + "/recordatorio/email";
	}

	@ParameterizedTest
	@EnumSource(Rol.class)
	void everyRoleSendsTheEmailAndItIsAuditedWithTheUser(Rol rol) throws Exception {
		MockHttpServletResponse r = api.post(como(rol), urlEmail(), "");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(201);
		long id = api.json(r).get("recordatorioId").asLong();
		assertThat(jdbc.queryForObject(
				"SELECT usuario_id FROM audit_log WHERE entidad = 'Recordatorio' AND accion = 'CREATE' AND entidad_id = ?",
				Long.class, id)).isEqualTo(cuenta.usuarioId());
		assertThat(fake.envios()).hasSize(1);
	}

	@Test
	void emailWithoutTokenIs401NoSendNothingRegistered() throws Exception {
		MockHttpServletResponse r = mockMvc.perform(MockMvcRequestBuilders.post(urlEmail())).andReturn().getResponse();

		assertThat(r.getStatus()).isEqualTo(401);
		assertThat(fake.envios()).isEmpty();
		assertThat(recordatorios()).isZero();
	}

	@Test
	void emailWithInvalidTokenIs401NoSendNothingRegistered() throws Exception {
		String manipulado = tokens.tamper(como(Rol.ADMIN).substring("Bearer ".length()), "rol", "ADMIN");

		MockHttpServletResponse r = api.post("Bearer " + manipulado + "x", urlEmail(), "");

		assertThat(r.getStatus()).isEqualTo(401);
		assertThat(fake.envios()).isEmpty();
		assertThat(recordatorios()).isZero();
	}
}
