package ar.global.odonto.usuario.auth;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditLog;
import ar.global.odonto.auditoria.AuditLogRepository;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec authentication "Inicio de sesión" y "Límite de intentos de login" via HTTP. Emails unicos por test. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class })
class LoginControllerIT {

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private AuditLogRepository auditLogs;

	@Autowired
	private JdbcTemplate jdbc;

	private final ObjectMapper mapper = new ObjectMapper();

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void successfulLoginReturnsBearerTokenAndSummary() throws Exception {
		AuthFlows.Cuenta cuenta = auth.registrar("login-ok@consultorio.test");

		MockHttpServletResponse r = auth.login("LOGIN-OK@consultorio.test", AuthFlows.PASSWORD);

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode json = mapper.readTree(r.getContentAsString());
		assertThat(json.get("tokenType").asText()).isEqualTo("Bearer");
		assertThat(json.get("expiresIn").asLong()).isEqualTo(1800);
		assertThat(json.get("accessToken").asText()).isNotBlank();
		assertThat(json.get("consultorioId").asLong()).isEqualTo(cuenta.consultorioId());
		assertThat(json.get("usuario").get("id").asLong()).isEqualTo(cuenta.usuarioId());
		assertThat(json.get("usuario").get("rol").asText()).isEqualTo("ADMIN");
		assertThat(r.getContentAsString()).doesNotContain(AuthFlows.PASSWORD);
	}

	@Test
	void unknownEmailAndWrongPasswordAreIndistinguishable() throws Exception {
		auth.registrar("login-401@consultorio.test");

		MockHttpServletResponse unknown = auth.login("nadie-401@consultorio.test", AuthFlows.PASSWORD);
		MockHttpServletResponse wrong = auth.login("login-401@consultorio.test", "incorrecta");

		assertThat(unknown.getStatus()).isEqualTo(401);
		assertThat(wrong.getStatus()).isEqualTo(401);
		assertThat(unknown.getContentAsString()).isEqualTo(wrong.getContentAsString());
		assertThat(unknown.getContentAsString()).doesNotContain("nadie-401");
	}

	@Test
	void sixthAttemptAfterFiveFailuresIs429EvenWithTheRightPassword() throws Exception {
		auth.registrar("login-429@consultorio.test");
		for (int i = 0; i < 5; i++) {
			assertThat(auth.login("login-429@consultorio.test", "incorrecta").getStatus()).isEqualTo(401);
		}

		MockHttpServletResponse r = auth.login("login-429@consultorio.test", AuthFlows.PASSWORD);

		assertThat(r.getStatus()).isEqualTo(429);
		assertThat(Long.parseLong(r.getHeader("Retry-After"))).isBetween(1L, 900L);
	}

	@Test
	void missingCredentialsAre400() throws Exception {
		assertThat(auth.login("", "").getStatus()).isEqualTo(400);
	}

	@Test
	void successfulLoginIsAuditedWithOkResultAndRequestIp() throws Exception {
		AuthFlows.Cuenta cuenta = auth.registrar("audit-ok@consultorio.test");

		assertThat(auth.login(cuenta.email(), AuthFlows.PASSWORD).getStatus()).isEqualTo(200);

		assertThat(logins(cuenta.consultorioId())).singleElement().satisfies(a -> {
			assertThat(a.getUsuarioId()).isEqualTo(cuenta.usuarioId());
			assertThat(a.getConsultorioId()).isEqualTo(cuenta.consultorioId());
			assertThat(a.getEntidad()).isEqualTo("Usuario");
			assertThat(a.getEntidadId()).isEqualTo(cuenta.usuarioId());
			assertThat(a.getDetalle()).isEqualTo("{\"resultado\":\"ok\"}");
			assertThat(a.getIp()).isEqualTo("127.0.0.1");
		});
	}

	/** Responde 401 y aun asi la fila de auditoria existe: no la revierte la excepcion. */
	@Test
	void wrongPasswordRespondsWith401AndStillPersistsTheFailedAuditRow() throws Exception {
		AuthFlows.Cuenta cuenta = auth.registrar("audit-fail@consultorio.test");

		MockHttpServletResponse r = auth.login(cuenta.email(), "incorrecta");

		assertThat(r.getStatus()).isEqualTo(401);
		assertThat(logins(cuenta.consultorioId())).singleElement().satisfies(a -> {
			assertThat(a.getUsuarioId()).isEqualTo(cuenta.usuarioId());
			assertThat(a.getConsultorioId()).isEqualTo(cuenta.consultorioId());
			assertThat(a.getEntidad()).isEqualTo("Usuario");
			assertThat(a.getEntidadId()).isEqualTo(cuenta.usuarioId());
			assertThat(a.getDetalle()).isEqualTo("{\"resultado\":\"fallido\"}");
			assertThat(a.getIp()).isEqualTo("127.0.0.1");
		});
		assertThat(r.getContentAsString()).doesNotContain("fallido");
	}

	@Test
	void unknownEmailWritesNoAuditRowAnywhere() throws Exception {
		AuthFlows.Cuenta cuenta = auth.registrar("audit-none@consultorio.test");
		int antes = totalAuditRows();

		MockHttpServletResponse r = auth.login("nadie-audit@consultorio.test", AuthFlows.PASSWORD);

		assertThat(r.getStatus()).isEqualTo(401);
		assertThat(totalAuditRows()).isEqualTo(antes);
		assertThat(logins(cuenta.consultorioId())).isEmpty();
	}

	private List<AuditLog> logins(Long consultorioId) {
		return fixtures.inTenant(consultorioId, () -> auditLogs.findAll(Pageable.unpaged()).getContent().stream()
				.filter(a -> a.getAccion() == AccionAuditoria.LOGIN).toList());
	}

	private int totalAuditRows() {
		Integer n = jdbc.queryForObject("select count(*) from audit_log", Integer.class);
		return n == null ? 0 : n;
	}
}
