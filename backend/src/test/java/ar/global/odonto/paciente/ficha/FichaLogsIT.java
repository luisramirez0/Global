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
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;

/** Spec clinical-record "Datos de salud fuera de logs y errores" (regla 5, design D11). */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, FichaFixtures.class })
class FichaLogsIT {

	private static final String NOMBRE = "Zuleikamarta";

	private static final String APELLIDO = "Quintanarossi";

	private static final String DNI = "41987654";

	private static final String ALERGIA = "ALERGIA-PARA-LOGS";

	private static final String NOTA = "NOTA-PARA-LOGS";

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

	private String profesional;

	private String sinAuditoria;

	private long pacienteId;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		AuthFlows.Cuenta cuenta = auth.registrar("logs-ficha@consultorio.test");
		profesional = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.PROFESIONAL);
		sinAuditoria = tokens.bearer(cuenta.usuarioId() + 5000, cuenta.consultorioId(), Rol.PROFESIONAL);
		String paciente = api.mapper.createObjectNode().put("nombre", NOMBRE).put("apellido", APELLIDO)
				.put("dni", DNI).toString();
		pacienteId = api.json(api.post(profesional, "/api/pacientes", paciente)).get("id").asLong();
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private void assertSinDatos(CapturedOutput output) {
		assertThat(output.getAll()).doesNotContain(NOMBRE).doesNotContain(APELLIDO).doesNotContain(DNI)
				.doesNotContain(ALERGIA).doesNotContain(NOTA);
	}

	@Test
	void successfulFlowsLogOnlyIds(CapturedOutput output) throws Exception {
		String base = "/api/pacientes/" + pacienteId;
		ficha.consentir(profesional, pacienteId);
		assertThat(api.put(profesional, base + "/ficha", "{\"alergias\":\"" + ALERGIA + "\",\"version\":null}")
				.getStatus()).isEqualTo(200);
		assertThat(api.post(profesional, base + "/notas", "{\"texto\":\"" + NOTA + "\"}").getStatus()).isEqualTo(201);
		api.get(profesional, base + "/ficha");
		api.get(profesional, base + "/notas");

		assertThat(output.getAll()).contains("Ficha clinica guardada pacienteId=" + pacienteId)
				.contains("Nota clinica creada");
		assertSinDatos(output);
	}

	@Test
	void rejectedAndFailedFlowsLogOnlyIds(CapturedOutput output) throws Exception {
		String base = "/api/pacientes/" + pacienteId;
		// 409 sin consentimiento
		api.put(profesional, base + "/ficha", "{\"alergias\":\"" + ALERGIA + "\",\"version\":null}");
		ficha.consentir(profesional, pacienteId);
		// 400 por largo
		api.post(profesional, base + "/notas", "{\"texto\":\"" + NOTA + "x".repeat(10_000) + "\"}");
		// 409 por version
		api.put(profesional, base + "/ficha", "{\"alergias\":\"" + ALERGIA + "\",\"version\":7}");
		// 500 por auditoria imposible
		api.put(sinAuditoria, base + "/ficha", "{\"alergias\":\"" + ALERGIA + "\",\"version\":null}");

		assertThat(output.getAll()).contains("Error no controlado");
		assertSinDatos(output);
	}
}
