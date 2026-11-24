package ar.global.odonto.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Los errores construidos por {@code ApiExceptionHandler.problem(...)} fijan {@code instance} en
 * {@code about:blank}: Spring lo completaria con la ruta pedida, que contiene el id consultado.
 *
 * <p>
 * Limitacion conocida (no se afirma aca): las rutas que no pasan por {@code problem()} conservan el
 * {@code instance} por defecto de Spring (405, 404 de ruta inexistente, 401/403 de
 * {@code ProblemDetailSecurityHandler}).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class })
class ProblemInstanceIT {

	private static final String BLANK = "about:blank";

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TenantFixtures fixtures;

	private String a;
	private String b;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		a = auth.bearer(auth.registrar("inst-a@a.test").email());
		b = auth.bearer(auth.registrar("inst-b@b.test").email());
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private void assertInstanceBlank(MockHttpServletResponse r, int status) throws Exception {
		assertThat(r.getStatus()).isEqualTo(status);
		assertThat(api.json(r).get("instance").asText()).isEqualTo(BLANK);
	}

	// --- C-03 (via ApiExceptionHandler) --------------------------------------------------------

	@Test
	void duplicateRegistrationEmailIs409WithBlankInstance() throws Exception {
		String body = "{\"consultorioNombre\":\"X\",\"nombre\":\"Ana\",\"apellido\":\"Perez\","
				+ "\"email\":\"inst-a@a.test\",\"password\":\"" + AuthFlows.PASSWORD + "\"}";

		assertInstanceBlank(api.post("", "/api/auth/register", body), 409);
	}

	@Test
	void registrationValidationErrorIs400WithBlankInstance() throws Exception {
		assertInstanceBlank(api.post("", "/api/auth/register", "{\"email\":\"x@\"}"), 400);
	}

	// --- C-04 ----------------------------------------------------------------------------------

	@Test
	void foreignSillonIdIs404WithBlankInstanceAndNoIdInTheBody() throws Exception {
		long ajeno = api.ids(api.get(b, "/api/sillones")).get(0);

		MockHttpServletResponse r = api.put(a, "/api/sillones/" + ajeno, "{\"nombre\":\"x\",\"activo\":true}");

		assertInstanceBlank(r, 404);
		assertThat(r.getContentAsString()).doesNotContain("/api/sillones").doesNotContain(String.valueOf(ajeno));
	}

	@Test
	void sillonLimitIs409WithBlankInstance() throws Exception {
		api.post(a, "/api/sillones", "{\"nombre\":\"S2\"}");

		assertInstanceBlank(api.post(a, "/api/sillones", "{\"nombre\":\"S3\"}"), 409);
	}

	@Test
	void invalidReferenceIs422AndCrossFieldRuleIs400BothWithBlankInstance() throws Exception {
		String rango = "\"inicio\":\"2026-12-24T12:00:00Z\",\"fin\":\"2026-12-24T13:00:00Z\"";
		assertInstanceBlank(api.post(a, "/api/bloqueos", "{\"sillonId\":999999," + rango + "}"), 422);
		assertInstanceBlank(api.post(a, "/api/horarios-atencion",
				"{\"diaSemana\":1,\"horaDesde\":\"13:00\",\"horaHasta\":\"09:00\"}"), 400);
	}
}
