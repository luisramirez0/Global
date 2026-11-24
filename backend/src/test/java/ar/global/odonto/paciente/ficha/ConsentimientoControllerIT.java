package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec clinical-record "Registro del consentimiento de datos" (design D3, D8, D9, D10). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, FichaFixtures.class,
		TestClockConfig.class })
class ConsentimientoControllerIT {

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

	@Autowired
	private JdbcTemplate jdbc;

	private AuthFlows.Cuenta cuenta;

	private String profesional;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("consentimiento@consultorio.test");
		profesional = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.PROFESIONAL);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
		jdbc.update("DELETE FROM consentimiento_texto WHERE version LIKE 'test-%'");
	}

	private String url(long pacienteId) {
		return "/api/pacientes/" + pacienteId + "/consentimientos";
	}

	@Test
	void registersTheConsentWithServerTimeAndTokenUserAndAuditsIt() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);

		MockHttpServletResponse r = ficha.consentir(profesional, pacienteId, "v1");

		assertThat(r.getStatus()).isEqualTo(201);
		JsonNode body = api.json(r);
		assertThat(body.get("versionTexto").asText()).isEqualTo("v1");
		assertThat(body.get("aceptadoEn").asText()).isEqualTo(TestClockConfig.START.toString());
		assertThat(body.get("registradoPorUsuarioId").asLong()).isEqualTo(cuenta.usuarioId());
		long consentimientoId = body.get("id").asLong();

		assertThat(ficha.auditoriaClinica(cuenta.consultorioId())).containsExactly(new FichaFixtures.Fila(
				cuenta.usuarioId(), "CREATE", "ConsentimientoDatos", pacienteId,
				"{\"consentimientoId\":" + consentimientoId + ",\"versionTexto\":\"v1\"}"));
	}

	@Test
	void aSecondConsentKeepsTheHistoryNewestFirst() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);
		long primero = api.json(ficha.consentir(profesional, pacienteId, "v1")).get("id").asLong();
		long segundo = api.json(ficha.consentir(profesional, pacienteId, "v1")).get("id").asLong();

		MockHttpServletResponse r = api.get(profesional, url(pacienteId));

		assertThat(r.getStatus()).isEqualTo(200);
		assertThat(api.ids(r)).containsExactly(segundo, primero);
	}

	@Test
	void listIsEmptyWithoutConsentAndIsNotAudited() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);

		MockHttpServletResponse r = api.get(profesional, url(pacienteId));

		assertThat(r.getStatus()).isEqualTo(200);
		assertThat(api.json(r).isArray()).isTrue();
		assertThat(api.json(r)).isEmpty();
		assertThat(ficha.auditoriaClinica(cuenta.consultorioId())).isEmpty();
	}

	@Test
	void unknownVersionIs400WithoutEchoAndWithoutAudit() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);

		MockHttpServletResponse r = ficha.consentir(profesional, pacienteId, "v99-inventada");

		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(r.getContentAsString()).doesNotContain("v99-inventada");
		assertThat(api.campos(r)).containsExactly("versionTexto");
		assertThat(ficha.contar("consentimiento_datos", pacienteId)).isZero();
		assertThat(ficha.auditoriaClinica(cuenta.consultorioId())).isEmpty();
	}

	@Test
	void versionNotYetInForceIs400() throws Exception {
		jdbc.update("INSERT INTO consentimiento_texto (version, contenido, vigente_desde) VALUES (?, ?, ?)",
				"test-futuro", "Texto futuro",
				LocalDateTime.ofInstant(TestClockConfig.START.plusSeconds(3600), ZoneOffset.UTC));
		long pacienteId = ficha.crearPaciente(profesional);

		MockHttpServletResponse r = ficha.consentir(profesional, pacienteId, "test-futuro");

		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(r.getContentAsString()).doesNotContain("test-futuro");
		assertThat(ficha.contar("consentimiento_datos", pacienteId)).isZero();
	}

	@Test
	void blankVersionIs400() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);

		assertThat(ficha.consentir(profesional, pacienteId, " ").getStatus()).isEqualTo(400);
	}

	@Test
	void inactivePatientCannotGiveConsent() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);
		ficha.darDeBaja(profesional, pacienteId);

		MockHttpServletResponse r = ficha.consentir(profesional, pacienteId, "v1");

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(api.json(r).get("codigo").asText()).isEqualTo("PACIENTE_INACTIVO");
		assertThat(ficha.auditoriaClinica(cuenta.consultorioId())).isEmpty();
	}

	@Test
	void unknownPatientIs404() throws Exception {
		assertThat(ficha.consentir(profesional, 999_999, "v1").getStatus()).isEqualTo(404);
		assertThat(api.get(profesional, url(999_999)).getStatus()).isEqualTo(404);
	}

	@Test
	void currentTextIsV1WithItsContent() throws Exception {
		MockHttpServletResponse r = api.get(profesional, "/api/consentimientos/texto-vigente");

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode body = api.json(r);
		assertThat(body.get("version").asText()).isEqualTo("v1");
		assertThat(body.get("contenido").asText()).startsWith("CONSENTIMIENTO PARA EL TRATAMIENTO");
		assertThat(body.has("vigenteDesde")).isTrue();
	}

	@Test
	void currentTextIgnoresAVersionInTheFuture() throws Exception {
		jdbc.update("INSERT INTO consentimiento_texto (version, contenido, vigente_desde) VALUES (?, ?, ?)",
				"test-futuro", "Texto futuro",
				LocalDateTime.ofInstant(TestClockConfig.START.plusSeconds(3600), ZoneOffset.UTC));

		assertThat(api.json(api.get(profesional, "/api/consentimientos/texto-vigente")).get("version").asText())
				.isEqualTo("v1");
	}
}
