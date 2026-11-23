package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/** Guarda de regresion: todo lo que no sea explicitamente publico exige autenticacion. */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityDefaultDenyIT {

	@Autowired
	private MockMvc mockMvc;

	@ParameterizedTest
	@ValueSource(strings = { "/api/cualquier-recurso", "/api/pacientes", "/api/health/extra" })
	void unauthenticatedRequestsToNonPublicPathsGet401WithoutBody(String path) throws Exception {
		var response = mockMvc.perform(get(path)).andReturn().getResponse();
		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(response.getContentAsString()).isEmpty();
	}
}
