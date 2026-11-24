package ar.global.odonto.agenda.horario;

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

/** Spec agenda-configuration: horarios de atencion. El registro crea un unico profesional activo. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class })
class HorarioControllerIT {

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
		bearer = auth.bearer(auth.registrar("horarios@a.test").email());
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private static String body(int dia, String desde, String hasta) {
		return "{\"diaSemana\":" + dia + ",\"horaDesde\":\"" + desde + "\",\"horaHasta\":\"" + hasta + "\"}";
	}

	private MockHttpServletResponse crear(int dia, String desde, String hasta) throws Exception {
		return api.post(bearer, "/api/horarios-atencion", body(dia, desde, hasta));
	}

	@Test
	void createMondayMorningIs201WithProfessionalAndHhMmHours() throws Exception {
		MockHttpServletResponse r = crear(1, "09:00", "13:00");

		assertThat(r.getStatus()).isEqualTo(201);
		JsonNode b = api.json(r);
		assertThat(b.get("profesionalId").asLong()).isPositive();
		assertThat(b.get("diaSemana").asInt()).isEqualTo(1);
		assertThat(b.get("horaDesde").asText()).isEqualTo("09:00");
		assertThat(b.get("horaHasta").asText()).isEqualTo("13:00");
		assertThat(b.has("consultorioId")).isFalse();
		assertThat(r.getHeader("Location")).endsWith("/api/horarios-atencion/" + b.get("id").asLong());
	}

	@Test
	void horaHastaBeforeHoraDesdeIs400NamingHoraHasta() throws Exception {
		MockHttpServletResponse r = crear(1, "13:00", "09:00");

		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(api.campos(r)).containsExactly("horaHasta");
	}

	@Test
	void horaOffTheGridIs400NamingHoraDesde() throws Exception {
		MockHttpServletResponse r = crear(1, "09:10", "12:00");

		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(api.campos(r)).containsExactly("horaDesde");
	}

	@Test
	void invalidDayIs400NamingDiaSemana() throws Exception {
		for (int dia : new int[] { 8, 0 }) {
			MockHttpServletResponse r = crear(dia, "09:00", "12:00");

			assertThat(r.getStatus()).isEqualTo(400);
			assertThat(api.campos(r)).containsExactly("diaSemana");
		}
	}

	@Test
	void overlappingCreateIs409ButAdjacentIs201() throws Exception {
		crear(1, "09:00", "13:00");

		assertThat(crear(1, "12:00", "15:00").getStatus()).isEqualTo(409);
		assertThat(crear(1, "13:00", "17:00").getStatus()).isEqualTo(201);
	}

	@Test
	void putTowardsAnOverlapIs409AndPutOverItselfIs200() throws Exception {
		long lunes = api.json(crear(1, "09:00", "13:00")).get("id").asLong();
		long martes = api.json(crear(2, "09:00", "13:00")).get("id").asLong();

		assertThat(api.put(bearer, "/api/horarios-atencion/" + martes, body(1, "11:00", "14:00")).getStatus())
				.isEqualTo(409);
		assertThat(api.json(api.get(bearer, "/api/horarios-atencion/" + martes)).get("diaSemana").asInt())
				.isEqualTo(2);
		MockHttpServletResponse ok = api.put(bearer, "/api/horarios-atencion/" + lunes, body(1, "09:00", "14:00"));
		assertThat(ok.getStatus()).isEqualTo(200);
		assertThat(api.json(ok).get("horaHasta").asText()).isEqualTo("14:00");
	}

	@Test
	void listFiltersByProfessionalAndIsOrderedByDayAndStart() throws Exception {
		long martes = api.json(crear(2, "09:00", "13:00")).get("id").asLong();
		long lunesTarde = api.json(crear(1, "14:00", "18:00")).get("id").asLong();
		long lunes = api.json(crear(1, "09:00", "13:00")).get("id").asLong();
		long profesional = api.json(api.get(bearer, "/api/horarios-atencion/" + lunes)).get("profesionalId").asLong();

		assertThat(api.ids(api.get(bearer, "/api/horarios-atencion"))).containsExactly(lunes, lunesTarde, martes);
		assertThat(api.ids(api.get(bearer, "/api/horarios-atencion?profesionalId=" + profesional))).hasSize(3);
		assertThat(api.ids(api.get(bearer, "/api/horarios-atencion?profesionalId=" + (profesional + 1000))))
				.isEmpty();
	}

	@Test
	void deleteIs204AndTheFranjaDisappears() throws Exception {
		long id = api.json(crear(1, "09:00", "13:00")).get("id").asLong();

		assertThat(api.delete(bearer, "/api/horarios-atencion/" + id).getStatus()).isEqualTo(204);

		assertThat(api.ids(api.get(bearer, "/api/horarios-atencion"))).doesNotContain(id);
		assertThat(api.get(bearer, "/api/horarios-atencion/" + id).getStatus()).isEqualTo(404);
	}

	@Test
	void unknownProfessionalIs422AndUnknownIdIs404() throws Exception {
		MockHttpServletResponse r = api.post(bearer, "/api/horarios-atencion",
				"{\"profesionalId\":999999,\"diaSemana\":1,\"horaDesde\":\"09:00\",\"horaHasta\":\"12:00\"}");

		assertThat(r.getStatus()).isEqualTo(422);
		assertThat(api.campos(r)).containsExactly("profesionalId");
		assertThat(api.get(bearer, "/api/horarios-atencion/999999").getStatus()).isEqualTo(404);
		assertThat(api.put(bearer, "/api/horarios-atencion/999999", body(1, "09:00", "12:00")).getStatus())
				.isEqualTo(404);
		assertThat(api.delete(bearer, "/api/horarios-atencion/999999").getStatus()).isEqualTo(404);
	}
}
