package ar.global.odonto.usuario.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.usuario.UsuarioRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/** Spec authentication "Usuario en curso" (design D8). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class })
class MeControllerIT {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private UsuarioRepository usuarios;

	private final ObjectMapper mapper = new ObjectMapper();

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void returnsTheUserAndConsultorioOfTheToken() throws Exception {
		AuthFlows.Cuenta cuenta = auth.registrar("me@consultorio.test");

		var r = mockMvc.perform(get("/api/auth/me").header("Authorization", auth.bearer("me@consultorio.test")))
				.andReturn().getResponse();

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode json = mapper.readTree(r.getContentAsString());
		assertThat(json.get("usuario").get("id").asLong()).isEqualTo(cuenta.usuarioId());
		assertThat(json.get("usuario").get("email").asText()).isEqualTo("me@consultorio.test");
		assertThat(json.get("usuario").get("nombre").asText()).isEqualTo("Ana");
		assertThat(json.get("usuario").get("rol").asText()).isEqualTo("ADMIN");
		assertThat(json.get("usuario").has("passwordHash")).isFalse();
		assertThat(json.get("consultorio").get("id").asLong()).isEqualTo(cuenta.consultorioId());
		assertThat(json.get("consultorio").get("nombre").asText()).isEqualTo("Consultorio me@consultorio.test");
	}

	@Test
	void deactivatedUserIsRejectedWithItsStillValidToken() throws Exception {
		AuthFlows.Cuenta cuenta = auth.registrar("me-inactivo@consultorio.test");
		String bearer = auth.bearer("me-inactivo@consultorio.test");
		fixtures.inTenant(cuenta.consultorioId(), () -> {
			usuarios.findById(cuenta.usuarioId()).orElseThrow().setActivo(false);
			return null;
		});

		var r = mockMvc.perform(get("/api/auth/me").header("Authorization", bearer)).andReturn().getResponse();

		assertThat(r.getStatus()).isEqualTo(401);
	}
}
