package ar.global.odonto.auditoria.consulta;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec audit-log "Consulta de auditoria restringida por rol y consultorio" (matriz KB 03). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class })
class AuditoriaRbacIT {

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
		cuenta = auth.registrar("rbac-auditoria@consultorio.test");
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@ParameterizedTest
	@EnumSource(value = Rol.class, names = { "ADMIN", "PROFESIONAL" })
	void managementRolesCanList(Rol rol) throws Exception {
		MockHttpServletResponse r = api.get(tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), rol),
				"/api/auditoria");

		assertThat(r.getStatus()).isEqualTo(200);
	}

	@Test
	void receptionIsForbidden() throws Exception {
		MockHttpServletResponse r = api.get(tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.RECEPCION),
				"/api/auditoria");

		assertThat(r.getStatus()).isEqualTo(403);
		assertThat(r.getContentType()).contains("application/problem+json");
	}

	@Test
	void withoutTokenIs401() throws Exception {
		MockHttpServletResponse r = api.getSinToken("/api/auditoria");

		assertThat(r.getStatus()).isEqualTo(401);
	}
}
