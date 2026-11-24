package ar.global.odonto.paciente.abm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Spec patient-management "Pacientes aislados por consultorio" y access-control (404 indistinguible). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class })
class PacienteTenantIsolationIT {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TenantFixtures fixtures;

	private final ObjectMapper mapper = new ObjectMapper();

	private String tokenA;
	private String tokenB;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		auth.registrar("a@pacientes.test");
		auth.registrar("b@pacientes.test");
		tokenA = auth.bearer("a@pacientes.test");
		tokenB = auth.bearer("b@pacientes.test");
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private MockHttpServletResponse as(String token, MockHttpServletRequestBuilder request) throws Exception {
		return mockMvc.perform(request.header("Authorization", token)).andReturn().getResponse();
	}

	private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String nombre, String dni) {
		String body = mapper.createObjectNode().put("nombre", nombre).put("apellido", "Perez").put("dni", dni)
				.toString();
		return request.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private long crear(String token, String nombre, String dni) throws Exception {
		return mapper.readTree(as(token, json(post("/api/pacientes"), nombre, dni)).getContentAsString()).get("id")
				.asLong();
	}

	private List<String> nombres(MockHttpServletResponse r) throws Exception {
		return mapper.readTree(r.getContentAsString()).get("contenido").findValuesAsText("nombre");
	}

	@Test
	void listingNeverIncludesPatientsOfAnotherConsultorio() throws Exception {
		crear(tokenA, "DeA", "30111222");
		crear(tokenB, "DeB", "40999888");

		assertThat(nombres(as(tokenA, get("/api/pacientes").param("incluirInactivos", "true")))).containsExactly("DeA");
		assertThat(nombres(as(tokenA, get("/api/pacientes").param("q", "40999888")))).isEmpty();
		assertThat(nombres(as(tokenA, get("/api/pacientes").param("q", "perez")))).containsExactly("DeA");
		assertThat(nombres(as(tokenB, get("/api/pacientes")))).containsExactly("DeB");
	}

	@Test
	void everyOperationOnAnotherConsultorioPatientIsAnIndistinguishable404() throws Exception {
		long p3 = crear(tokenB, "DeB", "40999888");
		long inexistente = p3 + 100_000;

		for (long id : new long[] { p3, inexistente }) {
			List<MockHttpServletResponse> respuestas = List.of(as(tokenA, get("/api/pacientes/" + id)),
					as(tokenA, json(put("/api/pacientes/" + id), "Hackeado", "11222333")),
					as(tokenA, delete("/api/pacientes/" + id)),
					as(tokenA, post("/api/pacientes/" + id + "/reactivar")));
			for (MockHttpServletResponse r : respuestas) {
				assertThat(r.getStatus()).isEqualTo(404);
			}
		}
		JsonNode ajeno = mapper.readTree(as(tokenA, get("/api/pacientes/" + p3)).getContentAsString());
		JsonNode noExiste = mapper.readTree(as(tokenA, get("/api/pacientes/" + inexistente)).getContentAsString());
		assertThat(ajeno.get("title")).isEqualTo(noExiste.get("title"));
		assertThat(ajeno.get("detail")).isEqualTo(noExiste.get("detail"));
		assertThat(ajeno.toString()).doesNotContain("DeB").doesNotContain("40999888");

		JsonNode intacto = mapper.readTree(as(tokenB, get("/api/pacientes/" + p3)).getContentAsString());
		assertThat(intacto.get("nombre").asText()).isEqualTo("DeB");
		assertThat(intacto.get("dni").asText()).isEqualTo("40999888");
		assertThat(intacto.get("activo").asBoolean()).isTrue();
	}
}
