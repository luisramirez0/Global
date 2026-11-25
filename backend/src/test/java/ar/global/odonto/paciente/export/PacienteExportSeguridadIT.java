package ar.global.odonto.paciente.export;

import static org.assertj.core.api.Assertions.assertThat;

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
import org.springframework.mock.web.MockHttpServletResponse;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;

/**
 * Spec patient-data-export: "Export restringido por rol y consultorio", escenario "Auditoría imposible" (sin
 * mocks: un token con un usuario inexistente en el consultorio hace que la FK compuesta de {@code audit_log}
 * rechace el INSERT) y "Export sin datos de salud en logs" (C-15 tareas 3.2, 3.3 y 4.2).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, ExportFixtures.class,
		TestClockConfig.class })
class PacienteExportSeguridadIT {

	@Autowired
	private ApiCalls api;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private ExportFixtures export;

	private AuthFlows.Cuenta cuenta;

	private String profesional;

	private long pacienteId;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("export-seg@consultorio.test");
		profesional = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.PROFESIONAL);
		pacienteId = export.paciente(profesional, ExportFixtures.APELLIDO, ExportFixtures.DNI);
		export.consentir(profesional, pacienteId);
		export.ficha(profesional, pacienteId);
		export.nota(profesional, pacienteId, ExportFixtures.NOTA_1);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private String url() {
		return "/api/pacientes/" + pacienteId + "/export";
	}

	private String bearer(Rol rol) {
		return tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), rol);
	}

	@Test
	void recepcionIsForbiddenAndLeavesNoAudit() throws Exception {
		MockHttpServletResponse r = api.get(bearer(Rol.RECEPCION), url());

		assertThat(r.getStatus()).isEqualTo(403);
		assertThat(r.getContentAsString()).doesNotContain(ExportFixtures.APELLIDO);
		assertThat(export.exports()).isEmpty();
	}

	@Test
	void withoutTokenIs401AndLeavesNoAudit() throws Exception {
		assertThat(api.getSinToken(url()).getStatus()).isEqualTo(401);
		assertThat(export.exports()).isEmpty();
	}

	@Test
	void adminAndProfesionalCanExport() throws Exception {
		assertThat(api.get(bearer(Rol.ADMIN), url()).getStatus()).isEqualTo(200);
		assertThat(api.get(bearer(Rol.PROFESIONAL), url()).getStatus()).isEqualTo(200);
		assertThat(export.exports()).hasSize(2);
	}

	@Test
	void impossibleAuditIsAGeneric500WithoutPatientData() throws Exception {
		String sinAuditoria = tokens.bearer(cuenta.usuarioId() + 5000, cuenta.consultorioId(), Rol.PROFESIONAL);

		MockHttpServletResponse r = api.get(sinAuditoria, url());

		assertThat(r.getStatus()).isEqualTo(500);
		assertThat(r.getContentType()).contains("application/problem+json");
		assertThat(r.getHeader("Content-Disposition")).isNull();
		assertThat(r.getContentAsString()).contains("Error interno").doesNotContain(ExportFixtures.APELLIDO)
				.doesNotContain(ExportFixtures.DNI).doesNotContain(ExportFixtures.ALERGIA)
				.doesNotContain(ExportFixtures.NOTA_1);
		assertThat(export.exports()).isEmpty();
	}

	@Test
	void successfulExportLogsOnlyIds(CapturedOutput output) throws Exception {
		assertThat(api.get(profesional, url()).getStatus()).isEqualTo(200);

		assertThat(output.getAll()).contains("Exportacion de datos de paciente pacienteId=" + pacienteId);
		assertSinDatos(output);
	}

	@Test
	void failedExportLogsOnlyIds(CapturedOutput output) throws Exception {
		String sinAuditoria = tokens.bearer(cuenta.usuarioId() + 5000, cuenta.consultorioId(), Rol.PROFESIONAL);

		assertThat(api.get(sinAuditoria, url()).getStatus()).isEqualTo(500);

		assertThat(output.getAll()).contains("Fallo de auditoria accion=EXPORT");
		assertSinDatos(output);
	}

	private static void assertSinDatos(CapturedOutput output) {
		assertThat(output.getAll()).doesNotContain(ExportFixtures.APELLIDO).doesNotContain(ExportFixtures.DNI)
				.doesNotContain(ExportFixtures.ALERGIA).doesNotContain(ExportFixtures.NOTA_1);
	}
}
