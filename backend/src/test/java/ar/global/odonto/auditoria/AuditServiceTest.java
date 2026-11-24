package ar.global.odonto.auditoria;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.Pageable;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Spec audit-log "Registro de acciones desde otros modulos" (design D2, D3). Servicio real sobre H2. */
@PersistenceTest
@Import({ AuditService.class, ContextoAuditoria.class })
class AuditServiceTest {

	@Autowired
	private AuditService service;

	@Autowired
	private AuditLogRepository auditLogs;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	private Tenants tenants;
	private Graph a;
	private Graph b;
	/** Filas sembradas por DomainFixtures (una por tenant): se excluyen de las aserciones. */
	private List<Long> sembradas;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
		sembradas = List.of(a.audit().getId(), b.audit().getId());
	}

	@AfterEach
	void cleanUp() {
		SecurityContextHolder.clearContext();
		RequestContextHolder.resetRequestAttributes();
		fixtures.cleanAll();
	}

	@Test
	void registrarStoresTenantUserIpActionEntityAndTimestamp() {
		simularRequest(a.usuario().getId(), "203.0.113.7");

		fixtures.inTenant(tenants.a(), () -> {
			service.registrar(AccionAuditoria.READ, "FichaClinica", 12L, DetalleAuditoria.vacio());
			return null;
		});

		assertThat(todos(tenants.a())).singleElement().satisfies(l -> {
			assertThat(l.getConsultorioId()).isEqualTo(tenants.a());
			assertThat(l.getUsuarioId()).isEqualTo(a.usuario().getId());
			assertThat(l.getAccion()).isEqualTo(AccionAuditoria.READ);
			assertThat(l.getEntidad()).isEqualTo("FichaClinica");
			assertThat(l.getEntidadId()).isEqualTo(12L);
			assertThat(l.getDetalle()).isNull();
			assertThat(l.getIp()).isEqualTo("203.0.113.7");
			assertThat(l.getCreatedAt()).isEqualTo(Instant.parse("2026-11-23T13:00:00Z"));
		});
	}

	@Test
	void registrarSerializesTheDetail() {
		simularRequest(a.usuario().getId(), "10.0.0.1");

		fixtures.inTenant(tenants.a(), () -> {
			service.registrar(AccionAuditoria.CREATE, "Turno", 31L,
					DetalleAuditoria.vacio().con("turnoId", 31L).con("sobreturno", true));
			return null;
		});

		assertThat(todos(tenants.a())).singleElement()
				.satisfies(l -> assertThat(l.getDetalle()).isEqualTo("{\"turnoId\":31,\"sobreturno\":true}"));
	}

	@Test
	void registrarWithoutRequestStoresNullUserAndIp() {
		fixtures.inTenant(tenants.a(), () -> {
			service.registrar(AccionAuditoria.EXPORT, "Paciente", null, DetalleAuditoria.vacio());
			return null;
		});

		assertThat(todos(tenants.a())).singleElement().satisfies(l -> {
			assertThat(l.getUsuarioId()).isNull();
			assertThat(l.getIp()).isNull();
			assertThat(l.getEntidadId()).isNull();
		});
	}

	@Test
	void registrarComoUsesTheExplicitUserAndIp() {
		simularRequest(a.usuario().getId(), "203.0.113.7");

		fixtures.inTenant(tenants.a(), () -> {
			service.registrarComo(null, "198.51.100.1", AccionAuditoria.LOGIN, "Usuario", 7L,
					DetalleAuditoria.codigo("resultado", "ok"));
			return null;
		});

		assertThat(todos(tenants.a())).singleElement().satisfies(l -> {
			assertThat(l.getUsuarioId()).isNull();
			assertThat(l.getIp()).isEqualTo("198.51.100.1");
			assertThat(l.getDetalle()).isEqualTo("{\"resultado\":\"ok\"}");
		});
	}

	@Test
	void rowLandsInTheCurrentTenantOnly() {
		simularRequest(b.usuario().getId(), "10.0.0.2");

		fixtures.inTenant(tenants.b(), () -> {
			service.registrar(AccionAuditoria.READ, "FichaClinica", 1L, DetalleAuditoria.vacio());
			return null;
		});

		assertThat(todos(tenants.b())).singleElement()
				.satisfies(l -> assertThat(l.getConsultorioId()).isEqualTo(tenants.b()));
		assertThat(todos(tenants.a())).isEmpty();
	}

	@Test
	void callWithoutTransactionIsRejectedAndLeavesNoRow() {
		assertThatThrownBy(() -> TenantContext.runAs(tenants.a(),
				() -> {
					service.registrar(AccionAuditoria.READ, "FichaClinica", 1L, DetalleAuditoria.vacio());
					return null;
				})).isInstanceOf(IllegalTransactionStateException.class);

		assertThat(todos(tenants.a())).isEmpty();
	}

	@Test
	void blankOrTooLongEntityIsRejectedWithoutRow() {
		for (String entidad : new String[] { "  ", "", "x".repeat(101) }) {
			assertThatThrownBy(() -> fixtures.inTenant(tenants.a(), () -> {
				service.registrar(AccionAuditoria.READ, entidad, 1L, DetalleAuditoria.vacio());
				return null;
			})).isInstanceOf(IllegalArgumentException.class);
		}

		assertThat(todos(tenants.a())).isEmpty();
	}

	@Test
	void entityOfExactly100CharactersIsAccepted() {
		fixtures.inTenant(tenants.a(), () -> {
			service.registrar(AccionAuditoria.READ, "x".repeat(100), 1L, DetalleAuditoria.vacio());
			return null;
		});

		assertThat(todos(tenants.a())).hasSize(1);
	}

	@Test
	void userOutsideTheTenantFailsOnTheForeignKeyAndLeavesNoRow() {
		simularRequest(b.usuario().getId(), "10.0.0.3");

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(), () -> {
			service.registrar(AccionAuditoria.READ, "FichaClinica", 1L, DetalleAuditoria.vacio());
			return null;
		})).isInstanceOf(DataAccessException.class);

		assertThat(todos(tenants.a())).isEmpty();
	}

	private List<AuditLog> todos(Long consultorioId) {
		return fixtures.inTenant(consultorioId, () -> auditLogs.findAll(Pageable.unpaged()).getContent()
				.stream().filter(l -> !sembradas.contains(l.getId())).toList());
	}

	private static void simularRequest(Long usuarioId, String ip) {
		Instant now = Instant.parse("2026-11-23T13:00:00Z");
		Jwt jwt = new Jwt("t", now, now.plusSeconds(60), Map.of("alg", "HS256"),
				Map.of("sub", String.valueOf(usuarioId)));
		SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr(ip);
		RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
	}
}
