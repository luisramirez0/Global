package ar.global.odonto.agenda.sillon;

import static org.assertj.core.api.Assertions.assertThat;

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

/** Spec agenda-configuration: gestion de sillones y limite de activos. El registro crea un sillon activo. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class })
class SillonControllerIT {

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
		AuthFlows.Cuenta cuenta = auth.registrar("sillones@a.test");
		bearer = auth.bearer(cuenta.email());
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private MockHttpServletResponse crear(String nombre) throws Exception {
		return api.post(bearer, "/api/sillones", "{\"nombre\":\"" + nombre + "\"}");
	}

	private long id(MockHttpServletResponse r) throws Exception {
		return api.json(r).get("id").asLong();
	}

	private long primerSillon() throws Exception {
		return api.ids(api.get(bearer, "/api/sillones")).get(0);
	}

	private long activos() throws Exception {
		return api.json(api.get(bearer, "/api/sillones")).findValues("activo").stream().filter(JsonNode::asBoolean)
				.count();
	}

	@Test
	void createReturns201WithLocationActiveAndNoConsultorioId() throws Exception {
		MockHttpServletResponse r = crear("Sillón 2");

		assertThat(r.getStatus()).isEqualTo(201);
		JsonNode body = api.json(r);
		assertThat(r.getHeader("Location")).endsWith("/api/sillones/" + body.get("id").asLong());
		assertThat(body.get("activo").asBoolean()).isTrue();
		assertThat(body.get("nombre").asText()).isEqualTo("Sillón 2");
		assertThat(body.has("consultorioId")).isFalse();
	}

	@Test
	void blankNameIs400NamingTheField() throws Exception {
		MockHttpServletResponse r = crear("   ");

		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(api.campos(r)).containsExactly("nombre");
	}

	@Test
	void nameLongerThan100IsRejected() throws Exception {
		assertThat(crear("x".repeat(101)).getStatus()).isEqualTo(400);
	}

	@Test
	void thirdActiveByCreateIs409AndStillTwoActive() throws Exception {
		assertThat(crear("Sillón 2").getStatus()).isEqualTo(201);

		MockHttpServletResponse r = crear("Sillón 3");

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(activos()).isEqualTo(2);
	}

	@Test
	void inactiveDoNotCountTowardsTheLimit() throws Exception {
		long segundo = id(crear("Sillón 2"));
		assertThat(api.delete(bearer, "/api/sillones/" + segundo).getStatus()).isEqualTo(204);

		assertThat(crear("Sillón 3").getStatus()).isEqualTo(201);
	}

	@Test
	void logicalDeleteKeepsTheRowAndHidesItFromDefaultList() throws Exception {
		long segundo = id(crear("Sillón 2"));

		assertThat(api.delete(bearer, "/api/sillones/" + segundo).getStatus()).isEqualTo(204);

		assertThat(api.ids(api.get(bearer, "/api/sillones"))).doesNotContain(segundo);
		assertThat(api.ids(api.get(bearer, "/api/sillones?incluirInactivos=true"))).contains(segundo);
		assertThat(api.json(api.get(bearer, "/api/sillones/" + segundo)).get("activo").asBoolean()).isFalse();
	}

	@Test
	void deletingTheLastActiveIs409AndItStaysActive() throws Exception {
		long unico = primerSillon();

		assertThat(api.delete(bearer, "/api/sillones/" + unico).getStatus()).isEqualTo(409);

		assertThat(api.json(api.get(bearer, "/api/sillones/" + unico)).get("activo").asBoolean()).isTrue();
	}

	@Test
	void deactivatingTheLastActiveByPutIs409AndItStaysActive() throws Exception {
		long unico = primerSillon();

		MockHttpServletResponse r = api.put(bearer, "/api/sillones/" + unico,
				"{\"nombre\":\"Principal\",\"activo\":false}");

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(api.json(api.get(bearer, "/api/sillones/" + unico)).get("activo").asBoolean()).isTrue();
	}

	@Test
	void reactivatingBeyondTheLimitIs409AndItStaysInactive() throws Exception {
		long segundo = id(crear("Sillón 2"));
		api.delete(bearer, "/api/sillones/" + segundo);
		assertThat(crear("Sillón 3").getStatus()).isEqualTo(201);

		MockHttpServletResponse r = api.put(bearer, "/api/sillones/" + segundo,
				"{\"nombre\":\"Sillón 2\",\"activo\":true}");

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(api.json(api.get(bearer, "/api/sillones/" + segundo)).get("activo").asBoolean()).isFalse();
	}

	@Test
	void renamingIs200AndKeepsActiveState() throws Exception {
		long segundo = id(crear("Sillón 2"));

		MockHttpServletResponse r = api.put(bearer, "/api/sillones/" + segundo,
				"{\"nombre\":\"Sala\",\"activo\":true}");

		assertThat(r.getStatus()).isEqualTo(200);
		assertThat(api.json(r).get("nombre").asText()).isEqualTo("Sala");
		assertThat(api.json(r).get("activo").asBoolean()).isTrue();
	}

	@Test
	void unknownIdIs404ForGetPutAndDelete() throws Exception {
		assertThat(api.get(bearer, "/api/sillones/999999").getStatus()).isEqualTo(404);
		assertThat(api.put(bearer, "/api/sillones/999999", "{\"nombre\":\"x\",\"activo\":true}").getStatus())
				.isEqualTo(404);
		assertThat(api.delete(bearer, "/api/sillones/999999").getStatus()).isEqualTo(404);
	}
}
