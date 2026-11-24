package ar.global.odonto.agenda.prestacion;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.config.GrillaAgenda;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec agenda-configuration: prestaciones y duracion alineada a la grilla (provisional, PA-03). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class })
class PrestacionControllerIT {

	private static final int G = GrillaAgenda.MINUTOS;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TenantFixtures fixtures;

	private String bearer;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		bearer = auth.bearer(auth.registrar("prestaciones@a.test").email());
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private MockHttpServletResponse crear(String nombre, int minutos) throws Exception {
		return api.post(bearer, "/api/prestaciones",
				"{\"nombre\":\"" + nombre + "\",\"duracionMinutos\":" + minutos + "}");
	}

	private MockHttpServletResponse editar(long id, String nombre, int minutos, boolean activo) throws Exception {
		return api.put(bearer, "/api/prestaciones/" + id, "{\"nombre\":\"" + nombre + "\",\"duracionMinutos\":"
				+ minutos + ",\"activo\":" + activo + "}");
	}

	@Test
	void createOnTheGridIs201ActiveWithDuration() throws Exception {
		MockHttpServletResponse r = crear("Consulta", 2 * G);

		assertThat(r.getStatus()).isEqualTo(201);
		JsonNode body = api.json(r);
		assertThat(body.get("duracionMinutos").asInt()).isEqualTo(2 * G);
		assertThat(body.get("activo").asBoolean()).isTrue();
		assertThat(body.has("consultorioId")).isFalse();
		assertThat(r.getHeader("Location")).endsWith("/api/prestaciones/" + body.get("id").asLong());
	}

	@Test
	void durationOffTheGridIs400NamingDuracionMinutos() throws Exception {
		MockHttpServletResponse r = crear("Consulta", G + 5);

		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(api.campos(r)).containsExactly("duracionMinutos");
	}

	@Test
	void zeroNegativeAndMissingDurationAreRejected() throws Exception {
		assertThat(crear("Consulta", 0).getStatus()).isEqualTo(400);
		assertThat(crear("Consulta", -G).getStatus()).isEqualTo(400);
		assertThat(api.post(bearer, "/api/prestaciones", "{\"nombre\":\"Consulta\"}").getStatus()).isEqualTo(400);
	}

	@Test
	void veryLongDurationOnTheGridIsAcceptedWithoutCap() throws Exception {
		assertThat(crear("Cirugía larga", 40 * G).getStatus()).isEqualTo(201);
	}

	@Test
	void blankNameIs400() throws Exception {
		MockHttpServletResponse r = crear(" ", G);

		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(api.campos(r)).containsExactly("nombre");
	}

	@Test
	void editWithZeroDurationIs400AndKeepsThePreviousOne() throws Exception {
		long id = api.json(crear("Consulta", 2 * G)).get("id").asLong();

		assertThat(editar(id, "Consulta", 0, true).getStatus()).isEqualTo(400);

		assertThat(api.json(api.get(bearer, "/api/prestaciones/" + id)).get("duracionMinutos").asInt())
				.isEqualTo(2 * G);
	}

	@Test
	void editOffTheGridIs400AndValidEditIs200() throws Exception {
		long id = api.json(crear("Consulta", 2 * G)).get("id").asLong();

		assertThat(editar(id, "Consulta", G + 5, true).getStatus()).isEqualTo(400);
		MockHttpServletResponse ok = editar(id, "Limpieza", 3 * G, true);

		assertThat(ok.getStatus()).isEqualTo(200);
		assertThat(api.json(ok).get("nombre").asText()).isEqualTo("Limpieza");
		assertThat(api.json(ok).get("duracionMinutos").asInt()).isEqualTo(3 * G);
	}

	@Test
	void deleteIsLogicalAndHidesFromDefaultList() throws Exception {
		long id = api.json(crear("Consulta", 2 * G)).get("id").asLong();

		assertThat(api.delete(bearer, "/api/prestaciones/" + id).getStatus()).isEqualTo(204);

		assertThat(api.ids(api.get(bearer, "/api/prestaciones"))).doesNotContain(id);
		assertThat(api.ids(api.get(bearer, "/api/prestaciones?incluirInactivas=true"))).contains(id);
		assertThat(api.json(api.get(bearer, "/api/prestaciones/" + id)).get("activo").asBoolean()).isFalse();
	}

	@Test
	void listIsOrderedByName() throws Exception {
		crear("Zeta", G);
		crear("Alfa", G);

		assertThat(api.json(api.get(bearer, "/api/prestaciones")).findValuesAsText("nombre"))
				.containsExactly("Alfa", "Zeta");
	}

	@Test
	void unknownIdIs404() throws Exception {
		assertThat(api.get(bearer, "/api/prestaciones/999999").getStatus()).isEqualTo(404);
		assertThat(editar(999999, "x", G, true).getStatus()).isEqualTo(404);
		assertThat(api.delete(bearer, "/api/prestaciones/999999").getStatus()).isEqualTo(404);
	}
}
