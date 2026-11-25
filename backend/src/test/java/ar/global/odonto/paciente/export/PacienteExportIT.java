package ar.global.odonto.paciente.export;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

import com.fasterxml.jackson.databind.JsonNode;

import ar.global.odonto.paciente.export.ExportFixtures.Fila;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;

/**
 * Spec patient-data-export "Exportación de los datos de un paciente" y "Auditoría de cada exportación" por HTTP
 * (C-15 tareas 2.1-2.3 y 3.1). Datos creados por la API real; auditoría leída con SQL directo.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, ExportFixtures.class,
		TestClockConfig.class })
class PacienteExportIT {

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

	@Autowired
	private MutableClock clock;

	private AuthFlows.Cuenta cuenta;

	private String profesional;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		clock.set(TestClockConfig.START);
		cuenta = auth.registrar("export@consultorio.test");
		profesional = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.PROFESIONAL);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
		clock.set(TestClockConfig.START);
	}

	private static String url(long pacienteId) {
		return "/api/pacientes/" + pacienteId + "/export";
	}

	/** Paciente con consentimiento, ficha, dos notas (la segunda un minuto despues) y dos turnos. */
	private long pacienteCompleto() throws Exception {
		long id = export.paciente(profesional, ExportFixtures.APELLIDO, ExportFixtures.DNI);
		export.consentir(profesional, id);
		export.ficha(profesional, id);
		export.nota(profesional, id, ExportFixtures.NOTA_1);
		clock.advance(Duration.ofMinutes(1));
		export.nota(profesional, id, ExportFixtures.NOTA_2);
		long[] agenda = export.agenda(profesional);
		export.turno(profesional, id, agenda, "15:00");
		export.turno(profesional, id, agenda, "13:00");
		clock.set(TestClockConfig.START.plus(Duration.ofMinutes(5)));
		return id;
	}

	@Test
	void fullExportHasEveryPartInChronologicalOrderAndDownloadHeaders() throws Exception {
		long id = pacienteCompleto();

		MockHttpServletResponse r = api.get(profesional, url(id));

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		assertThat(r.getContentType()).startsWith("application/json");
		assertThat(r.getHeader("Content-Disposition"))
				.isEqualTo("attachment; filename=\"paciente-" + id + "-export.json\"");
		assertThat(r.getHeader("Cache-Control")).contains("no-store");
		JsonNode json = api.json(r);
		assertThat(json.get("exportadoEn").asText())
				.isEqualTo(TestClockConfig.START.plus(Duration.ofMinutes(5)).toString());
		assertThat(json.get("paciente").get("id").asLong()).isEqualTo(id);
		assertThat(json.get("paciente").get("apellido").asText()).isEqualTo(ExportFixtures.APELLIDO);
		assertThat(json.get("paciente").get("dni").asText()).isEqualTo(ExportFixtures.DNI);
		assertThat(json.get("paciente").get("activo").asBoolean()).isTrue();
		assertThat(json.get("consentimientos")).hasSize(1);
		assertThat(json.get("consentimientos").get(0).get("versionTexto").asText()).isEqualTo("v1");
		assertThat(json.get("consentimientos").get(0).get("registradoPorUsuarioId").asLong())
				.isEqualTo(cuenta.usuarioId());
		assertThat(json.get("ficha").get("alergias").asText()).isEqualTo(ExportFixtures.ALERGIA);
		assertThat(json.get("ficha").get("embarazo").asBoolean()).isFalse();
		assertThat(json.get("ficha").has("actualizadaEn")).isTrue();
		assertThat(json.get("notas")).hasSize(2);
		assertThat(json.get("notas").get(0).get("texto").asText()).isEqualTo(ExportFixtures.NOTA_1);
		assertThat(json.get("notas").get(1).get("texto").asText()).isEqualTo(ExportFixtures.NOTA_2);
		assertThat(json.get("notas").get(0).has("profesionalId")).isTrue();
		assertThat(json.get("turnos")).hasSize(2);
		JsonNode primero = json.get("turnos").get(0);
		assertThat(primero.get("inicio").asText()).isEqualTo("2026-12-07T13:00:00Z");
		assertThat(primero.get("fin").asText()).isEqualTo("2026-12-07T13:30:00Z");
		assertThat(primero.get("estado").asText()).isEqualTo("PROGRAMADO");
		assertThat(primero.get("sobreturno").asBoolean()).isFalse();
		assertThat(primero.get("prestacion").get("nombre").asText()).isEqualTo("Consulta");
		assertThat(primero.get("sillon").get("nombre").asText()).isEqualTo("Sillón 1");
		assertThat(primero.has("profesionalId")).isTrue();
		assertThat(json.get("turnos").get(1).get("inicio").asText()).isEqualTo("2026-12-07T15:00:00Z");
	}

	@Test
	void exportLeavesOutTenantAndTechnicalVersionFields() throws Exception {
		long id = pacienteCompleto();

		String body = api.get(profesional, url(id)).getContentAsString();

		assertThat(body).doesNotContain("consultorioId").doesNotContain("consultorio_id")
				.doesNotContain("\"version\"").doesNotContain("createdAt").doesNotContain("updatedAt");
	}

	@Test
	void successfulExportIsAuditedWithCountsOnly() throws Exception {
		long id = pacienteCompleto();

		api.get(profesional, url(id));

		assertThat(export.exports()).containsExactly(new Fila(cuenta.consultorioId(), cuenta.usuarioId(), "Paciente",
				id, "{\"consentimientos\":1,\"ficha\":true,\"notas\":2,\"turnos\":2}"));
	}

	@Test
	void patientWithNothingExportsNullFichaEmptyListsAndZeroCounts() throws Exception {
		long id = export.pacienteVacio(profesional);
		String admin = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.ADMIN);

		MockHttpServletResponse r = api.get(admin, url(id));

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode json = api.json(r);
		assertThat(json.get("ficha").isNull()).isTrue();
		assertThat(json.get("consentimientos")).isEmpty();
		assertThat(json.get("notas")).isEmpty();
		assertThat(json.get("turnos")).isEmpty();
		assertThat(export.exports()).extracting(Fila::detalle)
				.containsExactly("{\"consentimientos\":0,\"ficha\":false,\"notas\":0,\"turnos\":0}");
	}

	@Test
	void deactivatedPatientIsStillExportedAndAudited() throws Exception {
		long id = pacienteCompleto();
		assertThat(api.delete(profesional, "/api/pacientes/" + id).getStatus()).isEqualTo(204);

		MockHttpServletResponse r = api.get(profesional, url(id));

		assertThat(r.getStatus()).isEqualTo(200);
		assertThat(api.json(r).get("paciente").get("activo").asBoolean()).isFalse();
		assertThat(api.json(r).get("notas")).hasSize(2);
		assertThat(export.exports()).hasSize(1);
	}

	@Test
	void unknownPatientIs404WithoutAudit() throws Exception {
		MockHttpServletResponse r = api.get(profesional, url(999_999));

		assertThat(r.getStatus()).isEqualTo(404);
		assertThat(export.exports()).isEmpty();
	}

	@Test
	void patientOfAnotherTenantIs404WithoutDataNorAuditAnywhere() throws Exception {
		AuthFlows.Cuenta otra = auth.registrar("export-b@consultorio.test");
		String deB = tokens.bearer(otra.usuarioId(), otra.consultorioId(), Rol.ADMIN);
		long idB = export.paciente(deB, ExportFixtures.APELLIDO, ExportFixtures.DNI);
		export.consentir(deB, idB);
		export.ficha(deB, idB);

		MockHttpServletResponse r = api.get(profesional, url(idB));

		assertThat(r.getStatus()).isEqualTo(404);
		assertThat(r.getContentAsString()).doesNotContain(ExportFixtures.APELLIDO)
				.doesNotContain(ExportFixtures.ALERGIA);
		assertThat(export.exports()).isEmpty();
		assertThat(api.get(deB, url(idB)).getStatus()).isEqualTo(200);
	}
}
