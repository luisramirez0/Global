package ar.global.odonto.auditoria.consulta;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.DetalleAuditoria;
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

/** Spec audit-log "Consulta del registro de auditoria" y "Filtros" (design D6). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class })
class AuditoriaControllerIT {

	@Autowired
	private ApiCalls api;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private AuditService auditService;

	private AuthFlows.Cuenta cuenta;
	private String admin;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("auditoria-it@consultorio.test");
		admin = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.ADMIN);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void listsPagedNewestFirstWithTotal() throws Exception {
		for (long i = 1; i <= 25; i++) {
			sembrar(AccionAuditoria.READ, "FichaClinica", i, DetalleAuditoria.vacio());
		}

		MockHttpServletResponse r = api.get(admin, "/api/auditoria?page=0&size=10");

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode json = api.json(r);
		assertThat(json.get("contenido")).hasSize(10);
		assertThat(json.get("totalElementos").asLong()).isEqualTo(25);
		assertThat(json.get("totalPaginas").asInt()).isEqualTo(3);
		assertThat(json.get("contenido").get(0).get("entidadId").asLong()).isEqualTo(25);
		assertThat(json.get("contenido").get(9).get("entidadId").asLong()).isEqualTo(16);
	}

	@Test
	void lastPageHasTheRemainingEntries() throws Exception {
		for (long i = 1; i <= 25; i++) {
			sembrar(AccionAuditoria.READ, "FichaClinica", i, DetalleAuditoria.vacio());
		}

		JsonNode json = api.json(api.get(admin, "/api/auditoria?page=2&size=10"));

		assertThat(json.get("contenido")).hasSize(5);
		assertThat(json.get("contenido").get(4).get("entidadId").asLong()).isEqualTo(1);
	}

	@Test
	void sizeIsCappedAt100AndDefaultsTo20() throws Exception {
		assertThat(api.json(api.get(admin, "/api/auditoria?size=1000")).get("tamanio").asInt()).isEqualTo(100);
		assertThat(api.json(api.get(admin, "/api/auditoria")).get("tamanio").asInt()).isEqualTo(20);
		assertThat(api.json(api.get(admin, "/api/auditoria?size=0")).get("tamanio").asInt()).isEqualTo(20);
	}

	@Test
	void entryExposesTheDocumentedFieldsAndTheDetailAsAnObject() throws Exception {
		sembrar(AccionAuditoria.LOGIN, "Usuario", cuenta.usuarioId(), DetalleAuditoria.codigo("resultado", "ok"));

		JsonNode e = api.json(api.get(admin, "/api/auditoria")).get("contenido").get(0);

		assertThat(e.get("id").asLong()).isPositive();
		assertThat(e.get("fecha").asText()).isNotBlank();
		assertThat(e.get("usuarioId").asLong()).isEqualTo(cuenta.usuarioId());
		assertThat(e.get("accion").asText()).isEqualTo("LOGIN");
		assertThat(e.get("entidad").asText()).isEqualTo("Usuario");
		assertThat(e.get("entidadId").asLong()).isEqualTo(cuenta.usuarioId());
		assertThat(e.get("detalle").get("resultado").asText()).isEqualTo("ok");
		assertThat(e.get("ip").asText()).isEqualTo("10.0.0.9");
		assertThat(e.has("nombre") || e.has("email") || e.has("consultorioId")).isFalse();
	}

	@Test
	void filtersByActionAndEntity() throws Exception {
		sembrar(AccionAuditoria.READ, "FichaClinica", 1L, DetalleAuditoria.vacio());
		sembrar(AccionAuditoria.UPDATE, "FichaClinica", 2L, DetalleAuditoria.vacio());
		sembrar(AccionAuditoria.LOGIN, "Usuario", 3L, DetalleAuditoria.vacio());

		JsonNode json = api.json(api.get(admin, "/api/auditoria?accion=READ&entidad=FichaClinica"));

		assertThat(json.get("contenido")).hasSize(1);
		assertThat(json.get("contenido").get(0).get("entidadId").asLong()).isEqualTo(1);
		assertThat(api.json(api.get(admin, "/api/auditoria?entidad=Usuario")).get("totalElementos").asLong())
				.isEqualTo(1);
	}

	@Test
	void filtersByEntityIdAndUser() throws Exception {
		sembrar(AccionAuditoria.READ, "FichaClinica", 1L, DetalleAuditoria.vacio());
		sembrar(AccionAuditoria.READ, "FichaClinica", 2L, DetalleAuditoria.vacio());

		assertThat(api.json(api.get(admin, "/api/auditoria?entidadId=2")).get("contenido")).hasSize(1);
		assertThat(api.json(api.get(admin, "/api/auditoria?usuarioId=" + cuenta.usuarioId()))
				.get("totalElementos").asLong()).isEqualTo(2);
		assertThat(api.json(api.get(admin, "/api/auditoria?usuarioId=" + (cuenta.usuarioId() + 1000)))
				.get("totalElementos").asLong()).isZero();
	}

	@Test
	void filtersByDateRange() throws Exception {
		sembrar(AccionAuditoria.READ, "FichaClinica", 1L, DetalleAuditoria.vacio());

		assertThat(api.json(api.get(admin,
				"/api/auditoria?desde=2000-01-01T00:00:00Z&hasta=2100-01-01T00:00:00Z")).get("totalElementos")
				.asLong()).isEqualTo(1);
		assertThat(api.json(api.get(admin,
				"/api/auditoria?desde=2000-01-01T00:00:00Z&hasta=2000-01-02T00:00:00Z")).get("totalElementos")
				.asLong()).isZero();
		assertThat(api.json(api.get(admin, "/api/auditoria?desde=2100-01-01T00:00:00Z")).get("totalElementos")
				.asLong()).isZero();
	}

	@Test
	void unknownActionIs400WithoutEchoingTheValue() throws Exception {
		MockHttpServletResponse r = api.get(admin, "/api/auditoria?accion=BORRAR");

		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(r.getContentAsString()).doesNotContain("BORRAR").contains("accion");
	}

	@Test
	void invertedRangeIs400ProblemDetail() throws Exception {
		MockHttpServletResponse r = api.get(admin,
				"/api/auditoria?desde=2026-11-02T00:00:00Z&hasta=2026-11-01T00:00:00Z");

		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(r.getContentType()).contains("application/problem+json");
		assertThat(r.getContentAsString()).doesNotContain("2026-11-02");
	}

	@Test
	void malformedDateAndIdsAre400WithoutEchoingTheValue() throws Exception {
		MockHttpServletResponse fecha = api.get(admin, "/api/auditoria?desde=no-fecha");
		MockHttpServletResponse id = api.get(admin, "/api/auditoria?entidadId=abc-secreto");

		assertThat(fecha.getStatus()).isEqualTo(400);
		assertThat(fecha.getContentAsString()).doesNotContain("no-fecha");
		assertThat(id.getStatus()).isEqualTo(400);
		assertThat(id.getContentAsString()).doesNotContain("abc-secreto");
	}

	@Test
	void entityFilterLongerThan100CharactersIs400() throws Exception {
		MockHttpServletResponse r = api.get(admin, "/api/auditoria?entidad=" + "x".repeat(101));

		assertThat(r.getStatus()).isEqualTo(400);
	}

	@Test
	void readingTheLogIsNotAudited() throws Exception {
		sembrar(AccionAuditoria.READ, "FichaClinica", 1L, DetalleAuditoria.vacio());

		api.get(admin, "/api/auditoria");
		api.get(admin, "/api/auditoria");

		assertThat(api.json(api.get(admin, "/api/auditoria")).get("totalElementos").asLong()).isEqualTo(1);
	}

	private void sembrar(AccionAuditoria accion, String entidad, Long entidadId, DetalleAuditoria detalle) {
		fixtures.inTenant(cuenta.consultorioId(), () -> {
			auditService.registrarComo(cuenta.usuarioId(), "10.0.0.9", accion, entidad, entidadId, detalle);
			return null;
		});
	}
}
