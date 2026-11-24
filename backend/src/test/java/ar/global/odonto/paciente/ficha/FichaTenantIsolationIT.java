package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec clinical-record "Historia clínica restringida por rol y consultorio": aislamiento A/B (regla 2). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, FichaFixtures.class })
class FichaTenantIsolationIT {

	private static final String ALERGIA_B = "ALERGIA-DEL-CONSULTORIO-B";

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

	private AuthFlows.Cuenta a;

	private AuthFlows.Cuenta b;

	private String tokenA;

	private String tokenB;

	private long pacienteB;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		a = auth.registrar("aislamiento-a@consultorio.test");
		b = auth.registrar("aislamiento-b@consultorio.test");
		tokenA = tokens.bearer(a.usuarioId(), a.consultorioId(), Rol.PROFESIONAL);
		tokenB = tokens.bearer(b.usuarioId(), b.consultorioId(), Rol.PROFESIONAL);
		pacienteB = ficha.crearPaciente(tokenB);
		ficha.consentir(tokenB, pacienteB);
		api.put(tokenB, "/api/pacientes/" + pacienteB + "/ficha",
				"{\"alergias\":\"" + ALERGIA_B + "\",\"version\":null}");
		api.post(tokenB, "/api/pacientes/" + pacienteB + "/notas", "{\"texto\":\"nota de B\"}");
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void everyEndpointOnAPatientOfBIs404FromAAndLeavesNoAudit() throws Exception {
		String base = "/api/pacientes/" + pacienteB;

		MockHttpServletResponse[] respuestas = { api.get(tokenA, base + "/ficha"),
				api.put(tokenA, base + "/ficha", "{\"alergias\":\"pisada\",\"version\":0}"),
				api.post(tokenA, base + "/notas", "{\"texto\":\"intrusa\"}"), api.get(tokenA, base + "/notas"),
				ficha.consentir(tokenA, pacienteB, "v1"), api.get(tokenA, base + "/consentimientos") };

		for (MockHttpServletResponse r : respuestas) {
			assertThat(r.getStatus()).isEqualTo(404);
			assertThat(r.getContentAsString()).doesNotContain(ALERGIA_B).doesNotContain("nota de B");
		}
		assertThat(ficha.auditoriaClinica(a.consultorioId())).isEmpty();
	}

	@Test
	void dataOfBIsIntactWhenReadWithTheTokenOfB() throws Exception {
		String base = "/api/pacientes/" + pacienteB;
		api.put(tokenA, base + "/ficha", "{\"alergias\":\"pisada\",\"version\":0}");
		api.post(tokenA, base + "/notas", "{\"texto\":\"intrusa\"}");

		JsonNode fichaB = api.json(api.get(tokenB, base + "/ficha"));
		JsonNode notasB = api.json(api.get(tokenB, base + "/notas"));

		assertThat(fichaB.get("alergias").asText()).isEqualTo(ALERGIA_B);
		assertThat(fichaB.get("version").asLong()).isZero();
		assertThat(notasB.get("totalElementos").asLong()).isEqualTo(1);
		assertThat(api.json(api.get(tokenB, base + "/consentimientos"))).hasSize(1);
	}
}
