package ar.global.odonto.testsupport;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

/** Registro y login por HTTP para tests de integracion (requiere {@code @AutoConfigureMockMvc}). */
@TestComponent
public class AuthFlows {

	public static final String PASSWORD = "Segura123!";

	@Autowired
	private MockMvc mockMvc;

	private final ObjectMapper mapper = new ObjectMapper();

	public record Cuenta(Long consultorioId, Long usuarioId, String email) {
	}

	public Cuenta registrar(String email) throws Exception {
		String body = mapper.createObjectNode().put("consultorioNombre", "Consultorio " + email).put("nombre", "Ana")
				.put("apellido", "Pérez").put("email", email).put("password", PASSWORD).toString();
		MockHttpServletResponse r = mockMvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse();
		if (r.getStatus() != 201) {
			throw new IllegalStateException("registro fallo: " + r.getStatus());
		}
		JsonNode json = mapper.readTree(r.getContentAsString());
		return new Cuenta(json.get("consultorioId").asLong(), json.get("usuarioId").asLong(), email);
	}

	public MockHttpServletResponse login(String email, String password) throws Exception {
		String body = mapper.createObjectNode().put("email", email).put("password", password).toString();
		return mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
				.andReturn().getResponse();
	}

	/** Devuelve el header {@code Authorization} listo para usar. */
	public String bearer(String email) throws Exception {
		MockHttpServletResponse r = login(email, PASSWORD);
		if (r.getStatus() != 200) {
			throw new IllegalStateException("login fallo: " + r.getStatus());
		}
		return "Bearer " + mapper.readTree(r.getContentAsString()).get("accessToken").asText();
	}
}
