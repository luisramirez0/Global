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
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Spec patient-management por HTTP (design D1, D7, D9). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class })
@ExtendWith(OutputCaptureExtension.class)
class PacienteControllerIT {

	private static final String EMAIL = "pacientes@consultorio.test";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TenantFixtures fixtures;

	private final ObjectMapper mapper = new ObjectMapper();

	private String bearer;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		auth.registrar(EMAIL);
		bearer = auth.bearer(EMAIL);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private ObjectNode body(String nombre, String apellido, String dni, String telefono) {
		ObjectNode n = mapper.createObjectNode().put("nombre", nombre).put("apellido", apellido).put("dni", dni);
		if (telefono != null) {
			n.put("telefono", telefono);
		}
		return n;
	}

	private MockHttpServletResponse call(MockHttpServletRequestBuilder request) throws Exception {
		return mockMvc.perform(request.header("Authorization", bearer)).andReturn().getResponse();
	}

	private MockHttpServletResponse send(MockHttpServletRequestBuilder request, ObjectNode json) throws Exception {
		return call(request.contentType(MediaType.APPLICATION_JSON).content(json.toString()));
	}

	private long crear(String nombre, String apellido, String dni) throws Exception {
		MockHttpServletResponse r = send(post("/api/pacientes"), body(nombre, apellido, dni, null));
		assertThat(r.getStatus()).isEqualTo(201);
		return json(r).get("id").asLong();
	}

	private JsonNode json(MockHttpServletResponse r) throws Exception {
		return mapper.readTree(r.getContentAsString());
	}

	@Test
	void createReturns201WithLocationAndNormalizedData() throws Exception {
		ObjectNode req = body("Ana", "Pérez", "30.111.222", "+54 9 11 2345-6789").put("fechaNacimiento",
				"1990-05-01");

		MockHttpServletResponse r = send(post("/api/pacientes"), req);

		assertThat(r.getStatus()).isEqualTo(201);
		JsonNode p = json(r);
		assertThat(r.getHeader("Location")).endsWith("/api/pacientes/" + p.get("id").asLong());
		assertThat(p.get("dni").asText()).isEqualTo("30111222");
		assertThat(p.get("telefono").asText()).isEqualTo("+5491123456789");
		assertThat(p.get("fechaNacimiento").asText()).isEqualTo("1990-05-01");
		assertThat(p.get("activo").asBoolean()).isTrue();
		assertThat(p.has("consultorioId")).isFalse();
	}

	@Test
	void invalidFieldsAre400NamingFieldsWithoutValues(CapturedOutput output) throws Exception {
		MockHttpServletResponse sinApellido = send(post("/api/pacientes"),
				mapper.createObjectNode().put("nombre", "Ana").put("dni", "30111222"));
		MockHttpServletResponse emailMalo = send(post("/api/pacientes"),
				body("Ana", "Perez", "30111222", null).put("email", "ana@"));
		MockHttpServletResponse formatos = send(post("/api/pacientes"),
				body("Ana", "Perez", "12AB99", "011 15 2345 6789"));

		assertThat(sinApellido.getStatus()).isEqualTo(400);
		assertThat(json(sinApellido).get("errores").findValuesAsText("campo")).containsExactly("apellido");
		assertThat(emailMalo.getStatus()).isEqualTo(400);
		assertThat(json(emailMalo).get("errores").findValuesAsText("campo")).containsExactly("email");
		assertThat(emailMalo.getContentAsString()).doesNotContain("ana@");
		assertThat(formatos.getStatus()).isEqualTo(400);
		assertThat(json(formatos).get("errores").findValuesAsText("campo")).containsExactly("dni", "telefono");
		assertThat(formatos.getContentAsString()).doesNotContain("12AB99").doesNotContain("2345");
		assertThat(output.getAll()).doesNotContain("12AB99").doesNotContain("011 15 2345 6789");
	}

	@Test
	void duplicateDniIs409WithExistingIdAndNoPersonalData(CapturedOutput output) throws Exception {
		long existente = crear("Ana", "Perez", "30111222");

		MockHttpServletResponse r = send(post("/api/pacientes"),
				body("Zoe", "Quiroga", "30.111.222", "+5491199998888"));

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(json(r).get("pacienteId").asLong()).isEqualTo(existente);
		assertThat(r.getContentAsString()).doesNotContain("30111222").doesNotContain("30.111.222")
				.doesNotContain("Quiroga");
		assertThat(output.getAll()).doesNotContain("30111222").doesNotContain("Quiroga")
				.doesNotContain("5491199998888");
	}

	@Test
	void listSearchesByNameAndDniAndClampsPageSize() throws Exception {
		crear("Ana", "Pérez", "30111222");
		crear("Luis", "Gómez", "27000111");

		JsonNode porApellido = json(call(get("/api/pacientes").param("q", "pér")));
		JsonNode porNombreApellido = json(call(get("/api/pacientes").param("q", "ana pér")));
		JsonNode porDni = json(call(get("/api/pacientes").param("q", "30.111")));
		JsonNode todos = json(call(get("/api/pacientes").param("size", "500")));

		assertThat(porApellido.get("contenido").findValuesAsText("nombre")).containsExactly("Ana");
		assertThat(porNombreApellido.get("contenido").findValuesAsText("nombre")).containsExactly("Ana");
		assertThat(porDni.get("contenido").findValuesAsText("nombre")).containsExactly("Ana");
		assertThat(todos.get("tamanio").asInt()).isEqualTo(50);
		assertThat(todos.get("totalElementos").asLong()).isEqualTo(2);
		assertThat(todos.get("totalPaginas").asInt()).isEqualTo(1);
		assertThat(todos.get("contenido").findValuesAsText("apellido")).containsExactly("Gómez", "Pérez");
	}

	@Test
	void getUpdateDeleteAndReactivateLifecycle() throws Exception {
		long id = crear("Ana", "Perez", "30111222");

		MockHttpServletResponse detalle = call(get("/api/pacientes/" + id));
		MockHttpServletResponse editado = send(put("/api/pacientes/" + id),
				body("Ana", "Perez", "30111222", "+54 9 11 0000-1111"));
		MockHttpServletResponse baja1 = call(delete("/api/pacientes/" + id));
		MockHttpServletResponse baja2 = call(delete("/api/pacientes/" + id));
		JsonNode trasBaja = json(call(get("/api/pacientes/" + id)));
		JsonNode listadoDefault = json(call(get("/api/pacientes")));
		JsonNode listadoInactivos = json(call(get("/api/pacientes").param("incluirInactivos", "true")));
		MockHttpServletResponse reactivado = call(post("/api/pacientes/" + id + "/reactivar"));
		JsonNode trasReactivar = json(call(get("/api/pacientes")));

		assertThat(detalle.getStatus()).isEqualTo(200);
		assertThat(editado.getStatus()).isEqualTo(200);
		assertThat(json(editado).get("telefono").asText()).isEqualTo("+5491100001111");
		assertThat(baja1.getStatus()).isEqualTo(204);
		assertThat(baja2.getStatus()).isEqualTo(204);
		assertThat(trasBaja.get("activo").asBoolean()).isFalse();
		assertThat(listadoDefault.get("totalElementos").asLong()).isZero();
		assertThat(listadoInactivos.get("totalElementos").asLong()).isEqualTo(1);
		assertThat(reactivado.getStatus()).isEqualTo(204);
		assertThat(trasReactivar.get("totalElementos").asLong()).isEqualTo(1);
	}

	@Test
	void updateWithAnotherPatientsDniIs409() throws Exception {
		long p1 = crear("Ana", "Perez", "30111222");
		long p2 = crear("Eva", "Paz", "27000111");

		MockHttpServletResponse r = send(put("/api/pacientes/" + p2), body("Eva", "Paz", "30111222", null));

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(json(r).get("pacienteId").asLong()).isEqualTo(p1);
		assertThat(json(call(get("/api/pacientes/" + p2))).get("dni").asText()).isEqualTo("27000111");
	}

	@Test
	void missingAndNonNumericIdsAre404And400() throws Exception {
		MockHttpServletResponse inexistente = call(get("/api/pacientes/999999"));
		MockHttpServletResponse noNumerico = call(get("/api/pacientes/abc"));

		assertThat(inexistente.getStatus()).isEqualTo(404);
		assertThat(noNumerico.getStatus()).isEqualTo(400);
		assertThat(noNumerico.getContentAsString()).doesNotContain("abc");
	}

	@Test
	void withoutTokenIs401() throws Exception {
		MockHttpServletResponse r = mockMvc.perform(get("/api/pacientes")).andReturn().getResponse();

		assertThat(r.getStatus()).isEqualTo(401);
	}
}
