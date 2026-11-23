package ar.global.odonto.consultorio.registro;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import ar.global.odonto.testsupport.TenantFixtures;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.AfterEach;
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

/** Spec authentication "Alta de consultorio y usuario" via HTTP. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TenantFixtures.class)
@ExtendWith(OutputCaptureExtension.class)
class RegistroControllerIT {

	private static final String PASSWORD = "Segura123!";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TenantFixtures fixtures;

	private final ObjectMapper mapper = new ObjectMapper();

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void validRegistrationReturns201WithIdsAndNoToken(CapturedOutput output) throws Exception {
		MockHttpServletResponse response = register(body("ana@consultorio.test"));

		assertThat(response.getStatus()).isEqualTo(201);
		JsonNode json = mapper.readTree(response.getContentAsString());
		assertThat(json.get("consultorioId").isNumber()).isTrue();
		assertThat(json.get("usuarioId").isNumber()).isTrue();
		assertThat(json.has("accessToken")).isFalse();
		assertThat(response.getContentAsString()).doesNotContain(PASSWORD);
		assertThat(output.getAll()).doesNotContain(PASSWORD).doesNotContain("ana@consultorio.test");
	}

	@Test
	void duplicateEmailReturns409() throws Exception {
		register(body("ana@consultorio.test"));

		MockHttpServletResponse response = register(body("ANA@consultorio.test"));

		assertThat(response.getStatus()).isEqualTo(409);
		assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		assertThat(response.getContentAsString()).doesNotContainIgnoringCase("ana@consultorio.test");
	}

	@Test
	void malformedEmailIs400NamingTheField() throws Exception {
		MockHttpServletResponse response = register(body("x@"));

		assertThat(response.getStatus()).isEqualTo(400);
		assertThat(fields(response)).contains("email");
		assertThat(response.getContentAsString()).doesNotContain("\"x@\"");
	}

	@Test
	void passwordShorterThan8Is400() throws Exception {
		ObjectNode body = body("ana@consultorio.test");
		body.put("password", "1234567");

		MockHttpServletResponse response = register(body);

		assertThat(response.getStatus()).isEqualTo(400);
		assertThat(fields(response)).containsExactly("password");
		assertThat(response.getContentAsString()).doesNotContain("1234567");
	}

	@Test
	void passwordLongerThan72BytesIs400() throws Exception {
		ObjectNode body = body("ana@consultorio.test");
		body.put("password", "ñ".repeat(37)); // 37 caracteres, 74 bytes UTF-8

		MockHttpServletResponse response = register(body);

		assertThat(response.getStatus()).isEqualTo(400);
		assertThat(fields(response)).containsExactly("password");
	}

	@Test
	void missingFieldsAre400() throws Exception {
		MockHttpServletResponse response = register(mapper.createObjectNode());

		assertThat(response.getStatus()).isEqualTo(400);
		assertThat(fields(response)).contains("consultorioNombre", "nombre", "apellido", "email", "password");
	}

	private MockHttpServletResponse register(ObjectNode body) throws Exception {
		return mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(mapper.writeValueAsString(body))).andReturn().getResponse();
	}

	private ObjectNode body(String email) {
		return mapper.createObjectNode()
				.put("consultorioNombre", "Consultorio Pérez")
				.put("nombre", "Ana")
				.put("apellido", "Pérez")
				.put("email", email)
				.put("password", PASSWORD)
				.put("matricula", "MN 1234");
	}

	private java.util.List<String> fields(MockHttpServletResponse response) throws Exception {
		return mapper.readTree(response.getContentAsString()).get("errores").findValuesAsText("campo");
	}
}
