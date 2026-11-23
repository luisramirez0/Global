package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import ar.global.odonto.testsupport.ProbeController;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Spec access-control "Autorización por rol" (matriz KB 03 via {@link Permisos}). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ ProbeController.class, TestTokens.class })
class RbacIT {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TestTokens tokens;

	@ParameterizedTest
	@CsvSource({
			"ADMIN,       /api/test/gestion,   200",
			"PROFESIONAL, /api/test/gestion,   200",
			"RECEPCION,   /api/test/gestion,   403",
			"ADMIN,       /api/test/operacion, 200",
			"PROFESIONAL, /api/test/operacion, 200",
			"RECEPCION,   /api/test/operacion, 200" })
	void permissionsFollowTheRbacMatrix(Rol rol, String path, int expected) throws Exception {
		var response = mockMvc.perform(get(path).header("Authorization", tokens.bearer(1L, 7L, rol))).andReturn()
				.getResponse();

		assertThat(response.getStatus()).isEqualTo(expected);
	}

	@Test
	void forbiddenIsAProblemDetail() throws Exception {
		var response = mockMvc.perform(get("/api/test/gestion").header("Authorization",
				tokens.bearer(1L, 7L, Rol.RECEPCION))).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(403);
		assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
	}

	@Test
	void roleEscalationByTamperingIsRejected() throws Exception {
		String token = tokens.tamper(tokens.token(1L, 7L, Rol.RECEPCION), TokenService.CLAIM_ROL, "ADMIN");

		var response = mockMvc.perform(get("/api/test/gestion").header("Authorization", "Bearer " + token))
				.andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(401);
	}
}
