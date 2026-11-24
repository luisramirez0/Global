package ar.global.odonto.auditoria.consulta;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** Spec audit-log "Entradas de otro consultorio invisibles por la API" (regla 2). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class })
class AuditoriaTenantIsolationIT {

	@Autowired
	private ApiCalls api;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TenantFixtures fixtures;

	private AuthFlows.Cuenta a;
	private AuthFlows.Cuenta b;
	private String tokenA;
	private String tokenB;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		a = auth.registrar("aislamiento-a@consultorio.test");
		b = auth.registrar("aislamiento-b@consultorio.test");
		tokenA = auth.bearer(a.email()); // cada login deja una entrada LOGIN en su consultorio
		tokenB = auth.bearer(b.email());
		auth.bearer(b.email());
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void listOnlyShowsEntriesOfTheTokenTenant() throws Exception {
		JsonNode json = api.json(api.get(tokenA, "/api/auditoria"));

		assertThat(json.get("totalElementos").asLong()).isEqualTo(1);
		assertThat(json.get("contenido").findValues("usuarioId")).extracting(JsonNode::asLong)
				.containsOnly(a.usuarioId());
	}

	@Test
	void filteringByAUserOfAnotherTenantReturnsNothing() throws Exception {
		JsonNode json = api.json(api.get(tokenA, "/api/auditoria?usuarioId=" + b.usuarioId()));

		assertThat(json.get("totalElementos").asLong()).isZero();
		assertThat(json.get("contenido")).isEmpty();
	}

	@Test
	void filteringByTheEntityIdOfAnotherTenantUserReturnsNothing() throws Exception {
		JsonNode json = api.json(api.get(tokenA, "/api/auditoria?entidad=Usuario&entidadId=" + b.usuarioId()));

		assertThat(json.get("totalElementos").asLong()).isZero();
	}

	@Test
	void theOtherTenantStillSeesItsOwnEntries() throws Exception {
		JsonNode json = api.json(api.get(tokenB, "/api/auditoria"));

		assertThat(json.get("totalElementos").asLong()).isEqualTo(2);
		assertThat(json.get("contenido").findValues("usuarioId")).extracting(JsonNode::asLong)
				.containsOnly(b.usuarioId());
	}
}
