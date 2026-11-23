package ar.global.odonto.usuario.auth;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec authentication "Inicio de sesión" y "Límite de intentos de login" via HTTP. Emails unicos por test. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class })
class LoginControllerIT {

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TenantFixtures fixtures;

	private final ObjectMapper mapper = new ObjectMapper();

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void successfulLoginReturnsBearerTokenAndSummary() throws Exception {
		AuthFlows.Cuenta cuenta = auth.registrar("login-ok@consultorio.test");

		MockHttpServletResponse r = auth.login("LOGIN-OK@consultorio.test", AuthFlows.PASSWORD);

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode json = mapper.readTree(r.getContentAsString());
		assertThat(json.get("tokenType").asText()).isEqualTo("Bearer");
		assertThat(json.get("expiresIn").asLong()).isEqualTo(1800);
		assertThat(json.get("accessToken").asText()).isNotBlank();
		assertThat(json.get("consultorioId").asLong()).isEqualTo(cuenta.consultorioId());
		assertThat(json.get("usuario").get("id").asLong()).isEqualTo(cuenta.usuarioId());
		assertThat(json.get("usuario").get("rol").asText()).isEqualTo("ADMIN");
		assertThat(r.getContentAsString()).doesNotContain(AuthFlows.PASSWORD);
	}

	@Test
	void unknownEmailAndWrongPasswordAreIndistinguishable() throws Exception {
		auth.registrar("login-401@consultorio.test");

		MockHttpServletResponse unknown = auth.login("nadie-401@consultorio.test", AuthFlows.PASSWORD);
		MockHttpServletResponse wrong = auth.login("login-401@consultorio.test", "incorrecta");

		assertThat(unknown.getStatus()).isEqualTo(401);
		assertThat(wrong.getStatus()).isEqualTo(401);
		assertThat(unknown.getContentAsString()).isEqualTo(wrong.getContentAsString());
		assertThat(unknown.getContentAsString()).doesNotContain("nadie-401");
	}

	@Test
	void sixthAttemptAfterFiveFailuresIs429EvenWithTheRightPassword() throws Exception {
		auth.registrar("login-429@consultorio.test");
		for (int i = 0; i < 5; i++) {
			assertThat(auth.login("login-429@consultorio.test", "incorrecta").getStatus()).isEqualTo(401);
		}

		MockHttpServletResponse r = auth.login("login-429@consultorio.test", AuthFlows.PASSWORD);

		assertThat(r.getStatus()).isEqualTo(429);
		assertThat(Long.parseLong(r.getHeader("Retry-After"))).isBetween(1L, 900L);
	}

	@Test
	void missingCredentialsAre400() throws Exception {
		assertThat(auth.login("", "").getStatus()).isEqualTo(400);
	}
}
