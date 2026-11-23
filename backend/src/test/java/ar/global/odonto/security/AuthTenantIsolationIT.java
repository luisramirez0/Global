package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.ProbeController;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/** Spec access-control "Aislamiento entre consultorios por token", de punta a punta por la API. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ProbeController.class, TestTokens.class })
class AuthTenantIsolationIT {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	private final ObjectMapper mapper = new ObjectMapper();

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void eachTokenOnlySeesItsOwnConsultorio() throws Exception {
		AuthFlows.Cuenta a = auth.registrar("aislamiento-a@a.test");
		AuthFlows.Cuenta b = auth.registrar("aislamiento-b@b.test");
		String tokenA = auth.bearer(a.email());
		String tokenB = auth.bearer(b.email());

		assertThat(usuariosVisibles(tokenA)).containsExactly(a.usuarioId());
		assertThat(usuariosVisibles(tokenB)).containsExactly(b.usuarioId());
		assertThat(meConsultorio(tokenA)).isEqualTo(a.consultorioId());
		assertThat(meConsultorio(tokenB)).isEqualTo(b.consultorioId());
	}

	@Test
	void tokenOfAWithForgedConsultorioOfBIsRejected() throws Exception {
		AuthFlows.Cuenta a = auth.registrar("forja-a@a.test");
		AuthFlows.Cuenta b = auth.registrar("forja-b@b.test");
		String tokenA = auth.bearer(a.email()).substring("Bearer ".length());
		String forged = tokens.tamper(tokenA, TokenService.CLAIM_CONSULTORIO, b.consultorioId());

		var r = mockMvc.perform(get("/api/test/usuarios").header("Authorization", "Bearer " + forged)).andReturn()
				.getResponse();

		assertThat(r.getStatus()).isEqualTo(401);
	}

	@Test
	void userOfAIsNotFoundWhenItsIdIsUsedWithTheConsultorioOfB() throws Exception {
		AuthFlows.Cuenta a = auth.registrar("cruzado-a@a.test");
		AuthFlows.Cuenta b = auth.registrar("cruzado-b@b.test");
		// Token valido (firmado) que combina el usuario de A con el consultorio de B: el filtro de tenant lo oculta.
		String mixed = tokens.bearer(a.usuarioId(), b.consultorioId(), Rol.ADMIN);

		var r = mockMvc.perform(get("/api/auth/me").header("Authorization", mixed)).andReturn().getResponse();

		assertThat(r.getStatus()).isEqualTo(401);
	}

	private List<Long> usuariosVisibles(String bearer) throws Exception {
		var r = mockMvc.perform(get("/api/test/usuarios").header("Authorization", bearer)).andReturn().getResponse();
		assertThat(r.getStatus()).isEqualTo(200);
		List<Long> ids = new ArrayList<>();
		mapper.readTree(r.getContentAsString()).forEach(n -> ids.add(n.asLong()));
		return ids;
	}

	private Long meConsultorio(String bearer) throws Exception {
		var r = mockMvc.perform(get("/api/auth/me").header("Authorization", bearer)).andReturn().getResponse();
		assertThat(r.getStatus()).isEqualTo(200);
		return mapper.readTree(r.getContentAsString()).get("consultorio").get("id").asLong();
	}
}
