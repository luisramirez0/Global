package ar.global.odonto.recordatorio;

import static ar.global.odonto.recordatorio.RecordatorioFixture.APELLIDO;
import static ar.global.odonto.recordatorio.RecordatorioFixture.EMAIL;
import static ar.global.odonto.recordatorio.RecordatorioFixture.NOMBRE;
import static ar.global.odonto.recordatorio.RecordatorioFixture.NOTAS;
import static ar.global.odonto.recordatorio.RecordatorioFixture.TELEFONO;
import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.recordatorio.RecordatorioFixture.TurnoRecordable;
import ar.global.odonto.agenda.turno.AgendaDeTurnosFixture;
import ar.global.odonto.recordatorio.email.EmailNoConfiguradoException;
import ar.global.odonto.recordatorio.email.EnvioEmailFallidoException;
import ar.global.odonto.recordatorio.email.FakeEnvioEmail;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec appointment-reminders, escenarios de WhatsApp (C-09 tarea 3.3, design D1, D2, D12). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class, AgendaDeTurnosFixture.class,
		RecordatorioFixture.class, TestClockConfig.class, FakeEnvioEmail.class })
class RecordatorioControllerIT {

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private RecordatorioFixture turnosFixture;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private MutableClock clock;

	@Autowired
	private FakeEnvioEmail fake;

	private String bearer;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		clock.set(TestClockConfig.START);
		fake.reset();
		bearer = auth.bearer(auth.registrar("recordatorio@a.test").email());
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private static String url(long turnoId) {
		return "/api/turnos/" + turnoId + "/recordatorio/whatsapp";
	}

	private long recordatorios() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM recordatorio", Long.class);
	}

	private static void assertSinDatosPersonales(MockHttpServletResponse r) throws Exception {
		assertThat(r.getContentAsString()).doesNotContain(TELEFONO).doesNotContain(TELEFONO.substring(1))
				.doesNotContain(EMAIL).doesNotContain(NOMBRE).doesNotContain(APELLIDO).doesNotContain(NOTAS);
	}

	@Test
	void okReturnsIdLinkAndGeneratedAtAndRegistersGenerado() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);

		MockHttpServletResponse r = api.get(bearer, url(t.turnoId()));

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		JsonNode body = api.json(r);
		assertThat(body.fieldNames()).toIterable().containsExactlyInAnyOrder("recordatorioId", "enlace",
				"generadoEn");
		String enlace = body.get("enlace").asText();
		assertThat(enlace).startsWith("https://wa.me/5491155667788?text=");
		assertThat(body.get("generadoEn").asText()).isNotBlank();
		assertThat(jdbc.queryForObject("SELECT estado FROM recordatorio WHERE id = ?", String.class,
				body.get("recordatorioId").asLong())).isEqualTo("GENERADO");
		assertThat(recordatorios()).isEqualTo(1);

		String mensaje = URLDecoder.decode(enlace.substring(enlace.indexOf("?text=") + 6), StandardCharsets.UTF_8);
		assertThat(mensaje).startsWith("Recordatorio: tiene un turno el 07/12/2026 a las 10:00 en ")
				.doesNotContain(NOMBRE).doesNotContain(APELLIDO).doesNotContain("Consulta").doesNotContain(NOTAS);
	}

	@Test
	void cancelledTurnoIs409WithoutPersonalData() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		assertThat(api.patch(bearer, "/api/turnos/" + t.turnoId() + "/estado", "{\"estado\":\"CANCELADO\"}")
				.getStatus()).isEqualTo(200);

		MockHttpServletResponse r = api.get(bearer, url(t.turnoId()));

		assertThat(r.getStatus()).isEqualTo(409);
		assertSinDatosPersonales(r);
		assertThat(recordatorios()).isZero();
	}

	@Test
	void patientWithoutPhoneIs422WithCampoTelefonoAndWithoutPersonalData() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", null, EMAIL);

		MockHttpServletResponse r = api.get(bearer, url(t.turnoId()));

		assertThat(r.getStatus()).isEqualTo(422);
		assertThat(api.json(r).get("errores").get(0).get("campo").asText()).isEqualTo("telefono");
		assertSinDatosPersonales(r);
		assertThat(recordatorios()).isZero();
	}

	@Test
	void unknownTurnoIs404ProblemDetail() throws Exception {
		MockHttpServletResponse r = api.get(bearer, url(999_999L));

		assertThat(r.getStatus()).isEqualTo(404);
		assertThat(r.getContentType()).contains("application/problem+json");
		assertSinDatosPersonales(r);
		assertThat(recordatorios()).isZero();
	}

	// ---- Pendientes de recordatorio (tarea 4.1 / 4.2, design D7) ----

	private static final String PENDIENTES = "/api/turnos/pendientes-recordatorio";

	private static LocalDateTime utc(String instante) {
		return LocalDateTime.ofInstant(Instant.parse(instante), ZoneOffset.UTC);
	}

	/** Mueve el turno de la fixture a otro instante (duracion 30 min). */
	private void mover(long turnoId, String inicio) {
		jdbc.update("UPDATE turno SET inicio = ?, fin = ? WHERE id = ?", utc(inicio),
				utc(Instant.parse(inicio).plusSeconds(1800).toString()), turnoId);
	}

	/** Copia el turno (mismo paciente/profesional/sillon) en otro instante y estado; devuelve el id nuevo. */
	private long copiar(long turnoId, String inicio, String estado) {
		jdbc.update("""
				INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_id, prestacion_id, inicio, fin,
				  estado, es_sobreturno, version, created_at, updated_at)
				SELECT consultorio_id, paciente_id, profesional_id, sillon_id, prestacion_id, ?, ?, ?, TRUE, 0,
				  created_at, updated_at FROM turno WHERE id = ?""", utc(inicio),
				utc(Instant.parse(inicio).plusSeconds(1800).toString()), estado, turnoId);
		return jdbc.queryForObject("SELECT MAX(id) FROM turno", Long.class);
	}

	/** Mueve el reloj y devuelve un token vigente en ese instante (el token del setUp vence con el reloj). */
	private String conRelojEn(String instante) throws Exception {
		clock.set(Instant.parse(instante));
		return auth.bearer("recordatorio@a.test");
	}

	private List<Long> turnoIds(MockHttpServletResponse r) throws Exception {
		List<Long> ids = new ArrayList<>();
		api.json(r).forEach(n -> ids.add(n.get("turnoId").asLong()));
		return ids;
	}

	@Test
	void explicitFechaListsOnlyTurnosOfThatLocalDay() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-27T02:30:00Z"); // 26/11 23:30 local
		long ayerLocal = copiar(t.turnoId(), "2026-11-26T02:30:00Z", "PROGRAMADO"); // 25/11 23:30 local

		MockHttpServletResponse r = api.get(bearer, PENDIENTES + "?fecha=2026-11-26");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		assertThat(turnoIds(r)).containsExactly(t.turnoId()).doesNotContain(ayerLocal);
	}

	@Test
	void itemCarriesTurnoPacienteAndProfesionalFields() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");

		MockHttpServletResponse r = api.get(bearer, PENDIENTES + "?fecha=2026-11-26");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		JsonNode item = api.json(r).get(0);
		assertThat(item.get("turnoId").asLong()).isEqualTo(t.turnoId());
		assertThat(Instant.parse(item.get("inicio").asText())).isEqualTo(Instant.parse("2026-11-26T13:00:00Z"));
		assertThat(Instant.parse(item.get("fin").asText())).isEqualTo(Instant.parse("2026-11-26T13:30:00Z"));
		assertThat(item.get("estado").asText()).isEqualTo("PROGRAMADO");
		assertThat(item.get("paciente").get("id").asLong()).isEqualTo(t.pacienteId());
		assertThat(item.get("paciente").get("nombre").asText()).isEqualTo(NOMBRE);
		assertThat(item.get("paciente").get("apellido").asText()).isEqualTo(APELLIDO);
		assertThat(item.get("profesional").get("id").asLong()).isEqualTo(t.agenda().profesionalId());
		assertThat(item.get("profesional").get("nombre").asText()).isNotBlank();
		assertThat(item.get("profesional").get("apellido").asText()).isNotBlank();
	}

	@Test
	void flagsAreTrueWhenPacienteHasValidPhoneAndEmail() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");

		JsonNode item = api.json(api.get(bearer, PENDIENTES + "?fecha=2026-11-26")).get(0);

		assertThat(item.get("tieneTelefono").asBoolean()).isTrue();
		assertThat(item.get("tieneEmail").asBoolean()).isTrue();
	}

	@Test
	void flagsAreFalseWhenPacienteHasNoPhoneNorEmail() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", null, null);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");

		JsonNode item = api.json(api.get(bearer, PENDIENTES + "?fecha=2026-11-26")).get(0);

		assertThat(item.get("tieneTelefono").asBoolean()).isFalse();
		assertThat(item.get("tieneEmail").asBoolean()).isFalse();
	}

	@Test
	void tieneTelefonoIsFalseWhenStoredPhoneIsNotValidE164AndTieneEmailIsFalseWhenBlank() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");
		jdbc.update("UPDATE paciente SET telefono = '12345', email = '   ' WHERE id = ?", t.pacienteId());

		JsonNode item = api.json(api.get(bearer, PENDIENTES + "?fecha=2026-11-26")).get(0);

		assertThat(item.get("tieneTelefono").asBoolean()).isFalse();
		assertThat(item.get("tieneEmail").asBoolean()).isFalse();
	}

	@Test
	void jsonNeverContainsTelefonoNorEmailNorNotas() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");

		MockHttpServletResponse r = api.get(bearer, PENDIENTES + "?fecha=2026-11-26");

		assertThat(r.getStatus()).isEqualTo(200);
		assertThat(r.getContentAsString()).doesNotContain(TELEFONO).doesNotContain(TELEFONO.substring(1))
				.doesNotContain(EMAIL).doesNotContain(NOTAS).doesNotContain("telefono\"").doesNotContain("email\"");
	}

	private void recordatorio(long turnoId, String canal, String estado, String generadoEn) {
		jdbc.update("""
				INSERT INTO recordatorio (consultorio_id, turno_id, canal, generado_en, estado, detalle_error,
				  created_at, updated_at)
				SELECT consultorio_id, id, ?, ?, ?, 'SMTP_FALLO:Test', created_at, updated_at FROM turno WHERE id = ?""",
				canal, utc(generadoEn), estado, turnoId);
	}

	@Test
	void ultimoRecordatorioIsPresentWhenTurnoOnlyHasErrorReminders() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");
		recordatorio(t.turnoId(), "EMAIL", "ERROR", "2026-11-25T12:00:00Z");

		MockHttpServletResponse r = api.get(bearer, PENDIENTES + "?fecha=2026-11-26");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		JsonNode ultimo = api.json(r).get(0).get("ultimoRecordatorio");
		assertThat(ultimo.get("canal").asText()).isEqualTo("EMAIL");
		assertThat(ultimo.get("estado").asText()).isEqualTo("ERROR");
		assertThat(Instant.parse(ultimo.get("generadoEn").asText())).isEqualTo(Instant.parse("2026-11-25T12:00:00Z"));
		assertThat(r.getContentAsString()).doesNotContain("SMTP_FALLO");
	}

	@Test
	void ultimoRecordatorioIsAbsentWhenTurnoHasNoReminders() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");

		JsonNode item = api.json(api.get(bearer, PENDIENTES + "?fecha=2026-11-26")).get(0);

		assertThat(item.path("ultimoRecordatorio").isMissingNode() || item.get("ultimoRecordatorio").isNull())
				.isTrue();
	}

	@Test
	void ultimoRecordatorioIsTheMostRecentOfSeveralErrors() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");
		recordatorio(t.turnoId(), "EMAIL", "ERROR", "2026-11-25T12:00:00Z");
		recordatorio(t.turnoId(), "WHATSAPP_LINK", "ERROR", "2026-11-25T15:00:00Z");
		recordatorio(t.turnoId(), "EMAIL", "ERROR", "2026-11-25T09:00:00Z");

		JsonNode ultimo = api.json(api.get(bearer, PENDIENTES + "?fecha=2026-11-26")).get(0)
				.get("ultimoRecordatorio");

		assertThat(ultimo.get("canal").asText()).isEqualTo("WHATSAPP_LINK");
		assertThat(Instant.parse(ultimo.get("generadoEn").asText())).isEqualTo(Instant.parse("2026-11-25T15:00:00Z"));
	}

	@Test
	void dayWithoutPendingTurnosIsEmptyArray() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");

		MockHttpServletResponse r = api.get(bearer, PENDIENTES + "?fecha=2026-11-28");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		assertThat(api.json(r).isArray()).isTrue();
		assertThat(api.json(r)).isEmpty();
	}

	@Test
	void withoutFechaListsTomorrowLocalAtMidday() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");
		copiar(t.turnoId(), "2026-11-25T13:00:00Z", "PROGRAMADO");
		copiar(t.turnoId(), "2026-11-27T13:00:00Z", "PROGRAMADO");
		String conReloj = conRelojEn("2026-11-25T14:00:00Z"); // 25/11 11:00 local

		MockHttpServletResponse r = api.get(conReloj, PENDIENTES);

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		assertThat(turnoIds(r)).containsExactly(t.turnoId());
	}

	@Test
	void withoutFechaUsesLocalDateEvenWhenUtcAlreadyRolledOver() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");
		copiar(t.turnoId(), "2026-11-27T13:00:00Z", "PROGRAMADO");
		String conReloj = conRelojEn("2026-11-26T02:30:00Z"); // 25/11 23:30 local, 26/11 en UTC

		MockHttpServletResponse r = api.get(conReloj, PENDIENTES);

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		assertThat(turnoIds(r)).containsExactly(t.turnoId());
	}

	@ParameterizedTest
	@ValueSource(strings = { "2026-13-40", "ma%C3%B1ana" })
	void malformedFechaIs400WithoutEchoingTheValue(String fecha) throws Exception {
		turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);

		MockHttpServletResponse r = api.get(bearer, PENDIENTES + "?fecha=" + fecha);

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(400);
		assertThat(api.campos(r)).containsExactly("fecha");
		assertThat(r.getContentAsString()).doesNotContain("2026-13-40").doesNotContain("mañana")
				.doesNotContain("ma%C3%B1ana");
	}

	@Test
	void queryDoesNotAddAuditRows() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		mover(t.turnoId(), "2026-11-26T13:00:00Z");
		long antes = jdbc.queryForObject("SELECT COUNT(*) FROM audit_log", Long.class);

		assertThat(api.get(bearer, PENDIENTES + "?fecha=2026-11-26").getStatus()).isEqualTo(200);
		assertThat(api.get(bearer, PENDIENTES).getStatus()).isEqualTo(200);

		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log", Long.class)).isEqualTo(antes);
	}

	@Test
	void literalRouteWinsOverTurnoIdAndTurnoByIdStillWorks() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);

		MockHttpServletResponse listado = api.get(bearer, PENDIENTES + "?fecha=2026-12-07");
		MockHttpServletResponse porId = api.get(bearer, "/api/turnos/" + t.turnoId());

		assertThat(listado.getStatus()).as(listado.getContentAsString()).isEqualTo(200);
		assertThat(api.json(listado).isArray()).isTrue();
		assertThat(porId.getStatus()).as(porId.getContentAsString()).isEqualTo(200);
		assertThat(api.json(porId).get("id").asLong()).isEqualTo(t.turnoId());
	}

	// ---- Email (tarea 5.4, design D5, D12) ----

	private static String urlEmail(long turnoId) {
		return "/api/turnos/" + turnoId + "/recordatorio/email";
	}

	@Test
	void emailOkReturns201WithIdEstadoAndEnviadoEnAndSendsTheMessage() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);

		MockHttpServletResponse r = api.post(bearer, urlEmail(t.turnoId()), "");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(201);
		JsonNode body = api.json(r);
		assertThat(body.fieldNames()).toIterable().containsExactlyInAnyOrder("recordatorioId", "estado",
				"enviadoEn");
		assertThat(body.get("estado").asText()).isEqualTo("ENVIADO");
		assertThat(Instant.parse(body.get("enviadoEn").asText())).isEqualTo(TestClockConfig.START);
		assertThat(jdbc.queryForObject("SELECT canal || '/' || estado FROM recordatorio WHERE id = ?", String.class,
				body.get("recordatorioId").asLong())).isEqualTo("EMAIL/ENVIADO");
		assertThat(fake.envios()).hasSize(1);
		assertThat(fake.envios().get(0).destinatario()).isEqualTo(EMAIL);
		assertThat(fake.envios().get(0).texto()).startsWith("Recordatorio: tiene un turno el 07/12/2026 a las 10:00 en ")
				.doesNotContain(NOMBRE).doesNotContain(APELLIDO).doesNotContain(NOTAS);
	}

	@Test
	void smtpFailureIs502GenericProblemDetailAndRegistersErrorWithoutLeakingAnything() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		fake.fallaCon(new EnvioEmailFallidoException("SMTP_FALLO:MailSendException"));

		MockHttpServletResponse r = api.post(bearer, urlEmail(t.turnoId()), "");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(502);
		assertThat(r.getContentType()).contains("application/problem+json");
		assertSinDatosPersonales(r);
		assertThat(r.getContentAsString()).doesNotContain("SMTP").doesNotContain("MailSendException")
				.doesNotContain("EnvioEmailFallido");
		JsonNode body = api.json(r);
		assertThat(body.get("status").asInt()).isEqualTo(502);
		assertThat(body.get("instance").asText()).isEqualTo("about:blank");
		assertThat(jdbc.queryForObject("SELECT estado FROM recordatorio", String.class)).isEqualTo("ERROR");
		assertThat(jdbc.queryForObject("SELECT detalle_error FROM recordatorio", String.class))
				.isEqualTo("SMTP_FALLO:MailSendException");
		assertThat(jdbc.queryForObject("SELECT enviado_en FROM recordatorio", Object.class)).isNull();
	}

	@Test
	void smtpNotConfiguredIs503GenericNotBadGatewayAndRegistersErrorSmtpNoConfigurado() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		fake.fallaCon(new EmailNoConfiguradoException());

		MockHttpServletResponse r = api.post(bearer, urlEmail(t.turnoId()), "");

		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(503);
		assertThat(r.getContentType()).contains("application/problem+json");
		assertSinDatosPersonales(r);
		assertThat(r.getContentAsString()).doesNotContain("SMTP").doesNotContain("NO_CONFIGURADO")
				.doesNotContain("EmailNoConfigurado");
		assertThat(api.json(r).get("instance").asText()).isEqualTo("about:blank");
		assertThat(jdbc.queryForObject("SELECT estado FROM recordatorio", String.class)).isEqualTo("ERROR");
		assertThat(jdbc.queryForObject("SELECT detalle_error FROM recordatorio", String.class))
				.isEqualTo("SMTP_NO_CONFIGURADO");
		assertThat(jdbc.queryForObject("SELECT enviado_en FROM recordatorio", Object.class)).isNull();
	}

	@Test
	void emailPatientWithoutEmailIs422WithCampoEmailNoSendNoRecord() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, null);

		MockHttpServletResponse r = api.post(bearer, urlEmail(t.turnoId()), "");

		assertThat(r.getStatus()).isEqualTo(422);
		assertThat(api.json(r).get("errores").get(0).get("campo").asText()).isEqualTo("email");
		assertSinDatosPersonales(r);
		assertThat(fake.envios()).isEmpty();
		assertThat(recordatorios()).isZero();
	}

	@Test
	void emailCancelledTurnoIs409NoSendNoRecord() throws Exception {
		TurnoRecordable t = turnosFixture.preparar(bearer, "30111222", TELEFONO, EMAIL);
		assertThat(api.patch(bearer, "/api/turnos/" + t.turnoId() + "/estado", "{\"estado\":\"CANCELADO\"}")
				.getStatus()).isEqualTo(200);

		MockHttpServletResponse r = api.post(bearer, urlEmail(t.turnoId()), "");

		assertThat(r.getStatus()).isEqualTo(409);
		assertSinDatosPersonales(r);
		assertThat(fake.envios()).isEmpty();
		assertThat(recordatorios()).isZero();
	}

	@Test
	void emailUnknownTurnoIs404ProblemDetailNoSendNoRecord() throws Exception {
		MockHttpServletResponse r = api.post(bearer, urlEmail(999_999L), "");

		assertThat(r.getStatus()).isEqualTo(404);
		assertThat(r.getContentType()).contains("application/problem+json");
		assertSinDatosPersonales(r);
		assertThat(fake.envios()).isEmpty();
		assertThat(recordatorios()).isZero();
	}
}
