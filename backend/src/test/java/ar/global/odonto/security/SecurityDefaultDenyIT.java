package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Guarda de regresion: todo lo que no sea explicitamente publico exige autenticacion. Desde C-03 el 401 es un
 * {@code ProblemDetail} generico (spec access-control): solo type/title/status/detail, sin datos del recurso.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityDefaultDenyIT {

	@Autowired
	private MockMvc mockMvc;

	@ParameterizedTest
	@ValueSource(strings = { "/api/cualquier-recurso", "/api/pacientes", "/api/health/extra" })
	void unauthenticatedRequestsToNonPublicPathsGet401WithGenericProblem(String path) throws Exception {
		var response = mockMvc.perform(get(path)).andReturn().getResponse();
		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		List<String> fields = new ArrayList<>();
		new ObjectMapper().readTree(response.getContentAsString()).fieldNames().forEachRemaining(fields::add);
		assertThat(fields).isSubsetOf("type", "title", "status", "detail");
	}
}
