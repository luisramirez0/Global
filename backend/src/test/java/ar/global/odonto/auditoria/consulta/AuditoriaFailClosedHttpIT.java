package ar.global.odonto.auditoria.consulta;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.auditoria.AuditedProbeService;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec audit-log "Lectura sin registro posible": 500 generico sin el dato clinico (design D2). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, AuditedProbeService.class,
		AuditProbeController.class })
class AuditoriaFailClosedHttpIT {

	private static final String DATO = "DATO-CLINICO-FICTICIO";

	@Autowired
	private ApiCalls api;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	private AuthFlows.Cuenta cuenta;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("failclosed@consultorio.test");
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void whenTheAuditInsertFailsTheResponseIsAGeneric500WithoutTheData() throws Exception {
		// Usuario inexistente en el tenant: la FK compuesta rechaza el INSERT de auditoria (sin mocks).
		String bearer = tokens.bearer(cuenta.usuarioId() + 5000, cuenta.consultorioId(), Rol.ADMIN);

		MockHttpServletResponse r = api.get(bearer, "/api/test/auditado");

		assertThat(r.getStatus()).isEqualTo(500);
		assertThat(r.getContentType()).contains("application/problem+json");
		assertThat(r.getContentAsString()).doesNotContain(DATO).contains("Error interno");
	}

	@Test
	void whenTheAuditSucceedsTheDataIsReturnedAndTheReadIsRegistered() throws Exception {
		String bearer = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.ADMIN);

		MockHttpServletResponse r = api.get(bearer, "/api/test/auditado");

		assertThat(r.getStatus()).isEqualTo(200);
		assertThat(r.getContentAsString()).contains(DATO);
		assertThat(api.json(api.get(bearer, "/api/auditoria?accion=READ&entidad=FichaClinica")).get("totalElementos")
				.asLong()).isEqualTo(1);
	}
}
