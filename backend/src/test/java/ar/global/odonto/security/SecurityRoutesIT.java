package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Specs access-control "Rutas públicas explícitas" y api-cors-policy "Acceso denegado por defecto". */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityRoutesIT {

	@Autowired
	private MockMvc mockMvc;

	private final ObjectMapper mapper = new ObjectMapper();

	@Test
	void protectedRouteWithoutTokenReturns401ProblemDetail() throws Exception {
		var response = mockMvc.perform(get("/api/auth/me")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		assertThat(response.getHeader("WWW-Authenticate")).isEqualTo("Bearer");
		JsonNode body = mapper.readTree(response.getContentAsString());
		assertThat(body.get("status").asInt()).isEqualTo(401);
	}

	@Test
	void invalidTokenReturns401WithoutTechnicalCause() throws Exception {
		var response = mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer no-es-un-jwt"))
				.andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(response.getHeader("WWW-Authenticate")).isEqualTo("Bearer");
		assertThat(response.getContentAsString()).doesNotContainIgnoringCase("malformed")
				.doesNotContainIgnoringCase("jwt");
	}

	@ParameterizedTest
	@ValueSource(strings = { "/api/auth/login", "/api/auth/register" })
	void authEndpointsAreNotRejectedBySecurity(String path) throws Exception {
		var response = mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andReturn().getResponse();

		assertThat(response.getStatus()).isNotIn(401, 403);
		assertThat(response.getCookie("JSESSIONID")).isNull();
	}

	@Test
	void healthStaysPublic() throws Exception {
		assertThat(mockMvc.perform(get("/api/health")).andReturn().getResponse().getStatus()).isEqualTo(200);
	}

	@Test
	void getOnLoginIsNotPublic() throws Exception {
		assertThat(mockMvc.perform(get("/api/auth/login")).andReturn().getResponse().getStatus()).isEqualTo(401);
	}
}
