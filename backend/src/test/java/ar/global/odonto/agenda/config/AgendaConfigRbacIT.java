package ar.global.odonto.agenda.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

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
import org.springframework.test.web.servlet.MockMvc;

/** Spec agenda-configuration "Permisos sobre la configuracion de agenda" (matriz design D6). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class, TestTokens.class })
class AgendaConfigRbacIT {

	private static final String BLOQUEO = "{\"inicio\":\"2026-12-24T12:00:00Z\",\"fin\":\"2026-12-24T13:00:00Z\"}";
	private static final String PRESTACION = "{\"nombre\":\"Consulta\",\"duracionMinutos\":30}";
	private static final String SILLON = "{\"nombre\":\"Sillón 2\"}";
	private static final String HORARIO = "{\"diaSemana\":1,\"horaDesde\":\"09:00\",\"horaHasta\":\"13:00\"}";

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private MockMvc mockMvc;

	private AuthFlows.Cuenta cuenta;
	private String admin;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("rbac@a.test");
		admin = auth.bearer(cuenta.email());
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private String como(Rol rol) {
		return tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), rol);
	}

	private int count(String url) throws Exception {
		return api.json(api.get(admin, url)).size();
	}

	@ParameterizedTest
	@EnumSource(Rol.class)
	void everyRoleCanReadTheFourResources(Rol rol) throws Exception {
		for (String url : new String[] { "/api/sillones", "/api/prestaciones", "/api/horarios-atencion",
				"/api/bloqueos" }) {
			assertThat(api.get(como(rol), url).getStatus()).as(url).isEqualTo(200);
		}
	}

	@Test
	void recepcionCannotWriteSillonesPrestacionesNorHorariosAndNothingChanges() throws Exception {
		String recepcion = como(Rol.RECEPCION);
		long sillon = api.ids(api.get(admin, "/api/sillones")).get(0);
		long prestacion = api.json(api.post(admin, "/api/prestaciones", PRESTACION)).get("id").asLong();
		long horario = api.json(api.post(admin, "/api/horarios-atencion", HORARIO)).get("id").asLong();

		assertThat(api.post(recepcion, "/api/sillones", SILLON).getStatus()).isEqualTo(403);
		assertThat(api.put(recepcion, "/api/sillones/" + sillon, SILLON).getStatus()).isEqualTo(403);
		assertThat(api.delete(recepcion, "/api/sillones/" + sillon).getStatus()).isEqualTo(403);
		assertThat(api.post(recepcion, "/api/prestaciones", PRESTACION).getStatus()).isEqualTo(403);
		assertThat(api.put(recepcion, "/api/prestaciones/" + prestacion, PRESTACION).getStatus()).isEqualTo(403);
		assertThat(api.delete(recepcion, "/api/prestaciones/" + prestacion).getStatus()).isEqualTo(403);
		assertThat(api.post(recepcion, "/api/horarios-atencion", HORARIO).getStatus()).isEqualTo(403);
		assertThat(api.put(recepcion, "/api/horarios-atencion/" + horario, HORARIO).getStatus()).isEqualTo(403);
		assertThat(api.delete(recepcion, "/api/horarios-atencion/" + horario).getStatus()).isEqualTo(403);

		assertThat(count("/api/sillones")).isEqualTo(1);
		assertThat(count("/api/prestaciones")).isEqualTo(1);
		assertThat(count("/api/horarios-atencion")).isEqualTo(1);
		assertThat(api.json(api.get(admin, "/api/sillones/" + sillon)).get("activo").asBoolean()).isTrue();
	}

	@Test
	void recepcionCreatesAndEditsBloqueosButCannotDeleteThem() throws Exception {
		String recepcion = como(Rol.RECEPCION);

		var creado = api.post(recepcion, "/api/bloqueos", BLOQUEO);
		assertThat(creado.getStatus()).isEqualTo(201);
		long id = api.json(creado).get("id").asLong();
		assertThat(api.put(recepcion, "/api/bloqueos/" + id,
				"{\"motivo\":\"Curso\",\"inicio\":\"2026-12-24T12:00:00Z\",\"fin\":\"2026-12-24T14:00:00Z\"}")
				.getStatus()).isEqualTo(200);

		assertThat(api.delete(recepcion, "/api/bloqueos/" + id).getStatus()).isEqualTo(403);
		assertThat(api.get(admin, "/api/bloqueos/" + id).getStatus()).isEqualTo(200);
	}

	@ParameterizedTest
	@EnumSource(value = Rol.class, names = { "ADMIN", "PROFESIONAL" })
	void adminAndProfesionalCanWriteEverything(Rol rol) throws Exception {
		String token = como(rol);

		assertThat(api.post(token, "/api/prestaciones", PRESTACION).getStatus()).isEqualTo(201);
		long horario = api.json(api.post(token, "/api/horarios-atencion", HORARIO)).get("id").asLong();
		assertThat(api.put(token, "/api/horarios-atencion/" + horario, HORARIO).getStatus()).isEqualTo(200);
		assertThat(api.delete(token, "/api/horarios-atencion/" + horario).getStatus()).isEqualTo(204);
		long sillon = api.json(api.post(token, "/api/sillones", SILLON)).get("id").asLong();
		assertThat(api.delete(token, "/api/sillones/" + sillon).getStatus()).isEqualTo(204);
		long bloqueo = api.json(api.post(token, "/api/bloqueos", BLOQUEO)).get("id").asLong();
		assertThat(api.delete(token, "/api/bloqueos/" + bloqueo).getStatus()).isEqualTo(204);
	}

	@Test
	void withoutTokenEveryResourceIs401() throws Exception {
		for (String url : new String[] { "/api/sillones", "/api/prestaciones", "/api/horarios-atencion",
				"/api/bloqueos" }) {
			assertThat(mockMvc.perform(get(url)).andReturn().getResponse().getStatus()).as(url).isEqualTo(401);
		}
	}
}
