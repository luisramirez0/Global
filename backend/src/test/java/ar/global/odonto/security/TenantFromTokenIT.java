package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.testsupport.ProbeController;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/** Spec access-control "Consultorio en curso tomado del token". MockMvc corre en el hilo del test. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ ProbeController.class, TestTokens.class })
class TenantFromTokenIT {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TestTokens tokens;

	@AfterEach
	void clear() {
		TenantContext.clear();
	}

	@Test
	void requestRunsWithTheConsultorioOfTheTokenAndClearsItAfterwards() throws Exception {
		var response = mockMvc.perform(get("/api/test/tenant").header("Authorization", tokens.bearer(3L, 7L, Rol.ADMIN)))
				.andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(200);
		assertThat(response.getContentAsString()).contains("\"consultorioId\":7");
		assertThat(TenantContext.get()).isEmpty();
	}

	@Test
	void tenantIsClearedEvenWhenTheRequestFails() throws Exception {
		var response = mockMvc.perform(get("/api/test/falla").header("Authorization", tokens.bearer(3L, 7L, Rol.ADMIN)))
				.andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(500);
		assertThat(response.getContentAsString()).doesNotContain("falla de prueba");
		assertThat(TenantContext.get()).isEmpty();
	}

	@Test
	void tokenWithoutConsultorioIsRejected() throws Exception {
		String token = tokens.custom(c -> c.claim(TokenService.CLAIM_ROL, "ADMIN"));

		assertThat(status(token)).isEqualTo(401);
	}

	@Test
	void tokenWithNonNumericConsultorioIsRejected() throws Exception {
		String token = tokens.custom(c -> c.claim(TokenService.CLAIM_CONSULTORIO, "siete")
				.claim(TokenService.CLAIM_ROL, "ADMIN"));

		assertThat(status(token)).isEqualTo(401);
	}

	@Test
	void tokenWithUnknownRoleIsRejected() throws Exception {
		String token = tokens.custom(c -> c.claim(TokenService.CLAIM_CONSULTORIO, 7L)
				.claim(TokenService.CLAIM_ROL, "SUPERADMIN"));

		assertThat(status(token)).isEqualTo(401);
	}

	@Test
	void tamperedConsultorioIsRejected() throws Exception {
		String token = tokens.tamper(tokens.token(3L, 7L, Rol.ADMIN), TokenService.CLAIM_CONSULTORIO, 8L);

		assertThat(status(token)).isEqualTo(401);
	}

	private int status(String token) throws Exception {
		return mockMvc.perform(get("/api/test/tenant").header("Authorization", "Bearer " + token)).andReturn()
				.getResponse().getStatus();
	}
}
