package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;

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

/**
 * Spec clinical-record "Auditoría de cada acceso a la historia clínica", escenario "Auditoría imposible" (fail-closed
 * de C-06), sin mocks: un token con un {@code usuarioId} que no existe en el consultorio hace que la FK compuesta de
 * {@code audit_log} rechace el INSERT.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, FichaFixtures.class })
class FichaFailClosedIT {

	private static final String ALERGIA = "ALERGIA-QUE-NO-DEBE-SALIR";

	private static final String NOTA = "NOTA-QUE-NO-DEBE-SALIR";

	@Autowired
	private ApiCalls api;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private FichaFixtures ficha;

	private String valido;

	private String sinAuditoria;

	private long pacienteId;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		AuthFlows.Cuenta cuenta = auth.registrar("failclosed-ficha@consultorio.test");
		valido = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.PROFESIONAL);
		sinAuditoria = tokens.bearer(cuenta.usuarioId() + 5000, cuenta.consultorioId(), Rol.PROFESIONAL);
		pacienteId = ficha.crearPaciente(valido);
		ficha.consentir(valido, pacienteId);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private String url(String sufijo) {
		return "/api/pacientes/" + pacienteId + sufijo;
	}

	private void assertGeneric500(MockHttpServletResponse r, String dato) throws Exception {
		assertThat(r.getStatus()).isEqualTo(500);
		assertThat(r.getContentType()).contains("application/problem+json");
		assertThat(r.getContentAsString()).contains("Error interno").doesNotContain(dato);
	}

	@Test
	void readingTheFichaWithoutPossibleAuditIsAGeneric500WithoutClinicalData() throws Exception {
		api.put(valido, url("/ficha"), "{\"alergias\":\"" + ALERGIA + "\",\"version\":null}");

		assertGeneric500(api.get(sinAuditoria, url("/ficha")), ALERGIA);
	}

	@Test
	void listingNotesWithoutPossibleAuditIsAGeneric500WithoutTheText() throws Exception {
		api.post(valido, url("/notas"), "{\"texto\":\"" + NOTA + "\"}");

		assertGeneric500(api.get(sinAuditoria, url("/notas")), NOTA);
	}

	@Test
	void firstLoadWithoutPossibleAuditIsRolledBack() throws Exception {
		MockHttpServletResponse r = api.put(sinAuditoria, url("/ficha"),
				"{\"alergias\":\"" + ALERGIA + "\",\"version\":null}");

		assertGeneric500(r, ALERGIA);
		assertThat(ficha.contar("ficha_clinica", pacienteId)).isZero();
	}

	@Test
	void updateWithoutPossibleAuditIsRolledBackAndNotMistakenForAConflict() throws Exception {
		api.put(valido, url("/ficha"), "{\"alergias\":\"original\",\"version\":null}");

		MockHttpServletResponse r = api.put(sinAuditoria, url("/ficha"),
				"{\"alergias\":\"" + ALERGIA + "\",\"version\":0}");

		assertGeneric500(r, ALERGIA);
		assertThat(ficha.filaFicha(pacienteId).get("ALERGIAS")).isEqualTo("original");
		assertThat(((Number) ficha.filaFicha(pacienteId).get("VERSION")).longValue()).isZero();
	}
}
