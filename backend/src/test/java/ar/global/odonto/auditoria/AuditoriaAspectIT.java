package ar.global.odonto.auditoria;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.usuario.Rol;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Spec audit-log "Registro de acciones desde otros modulos" y "Fallo de auditoria hace fallar la operacion"
 * (design D2, D3). Sin mocks: el fallo se provoca con un usuario inexistente en el tenant (FK compuesta).
 */
@SpringBootTest
@Import({ TenantFixtures.class, DomainFixtures.class, AuditedProbeService.class })
@ExtendWith(OutputCaptureExtension.class)
class AuditoriaAspectIT {

	@Autowired
	private AuditedProbeService probe;

	@Autowired
	private AuditLogRepository auditLogs;

	@Autowired
	private SillonRepository sillones;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	private Tenants tenants;
	private Graph a;
	private List<Long> sembradas;
	private long sillonesSembrados;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		sembradas = List.of(a.audit().getId());
		sillonesSembrados = sillonesDelTenant();
		probe.resetReadOnlyVisto();
		autenticar(a.usuario().getId(), "ROLE_ADMIN");
	}

	@AfterEach
	void cleanUp() {
		SecurityContextHolder.clearContext();
		fixtures.cleanAll();
	}

	@Test
	void successfulCreateRegistersTheIdTakenFromTheResult() {
		AuditedProbeService.SillonCreado creado = enTenant(() -> probe.crear("Sillon uno"));

		assertThat(entradas()).singleElement().satisfies(l -> {
			assertThat(l.getAccion()).isEqualTo(AccionAuditoria.CREATE);
			assertThat(l.getEntidad()).isEqualTo("Sillon");
			assertThat(l.getEntidadId()).isEqualTo(creado.id());
			assertThat(l.getUsuarioId()).isEqualTo(a.usuario().getId());
			assertThat(l.getConsultorioId()).isEqualTo(tenants.a());
		});
	}

	@Test
	void eachInvocationRegistersItsOwnEntry() {
		AuditedProbeService.SillonCreado uno = enTenant(() -> probe.crear("Sillon uno"));
		AuditedProbeService.SillonCreado dos = enTenant(() -> probe.crear("Sillon dos"));

		assertThat(entradas()).extracting(AuditLog::getEntidadId).containsExactlyInAnyOrder(uno.id(), dos.id());
	}

	@Test
	void readTakesTheIdFromTheArgument() {
		Long id = enTenant(() -> probe.crear("Sillon lectura")).id();

		String nombre = enTenant(() -> probe.leer(id));

		assertThat(nombre).isEqualTo("Sillon lectura");
		assertThat(entradas()).filteredOn(l -> l.getAccion() == AccionAuditoria.READ).singleElement()
				.satisfies(l -> assertThat(l.getEntidadId()).isEqualTo(id));
	}

	@Test
	void failingOperationRegistersNothingAndKeepsTheSameException() {
		assertThatThrownBy(() -> enTenant(() -> probe.leerInexistente(99L)))
				.isInstanceOf(RecursoNoEncontradoException.class);

		assertThat(entradas()).isEmpty();
	}

	@Test
	void auditedReadMustNotRunInAReadOnlyTransaction() {
		Long id = enTenant(() -> probe.crear("Sillon ro")).id();

		enTenant(() -> probe.leer(id));

		// @Transactional(readOnly = true) del metodo se une a la transaccion RW del aspecto: en MySQL un INSERT
		// en conexion read-only fallaria y H2 no lo detecta, por eso se verifica el flag (ver Javadoc de @Audited).
		assertThat(probe.readOnlyVisto()).isFalse();
		assertThat(entradas()).filteredOn(l -> l.getAccion() == AccionAuditoria.READ).hasSize(1);
	}

	@Test
	void auditFailureAbortsTheCreateAndRollsBackTheBusinessRow(CapturedOutput output) {
		autenticar(987654L, "ROLE_ADMIN"); // usuario inexistente en el tenant -> la FK rechaza el INSERT

		assertThatThrownBy(() -> enTenant(() -> probe.crear("Sillon secreto-xyz")))
				.isInstanceOf(AuditoriaFallidaException.class);

		assertThat(sillonesDelTenant()).isEqualTo(sillonesSembrados);
		assertThat(entradas()).isEmpty();
		assertThat(output.getAll()).contains("CREATE", "Sillon", String.valueOf(tenants.a()))
				.contains("DataIntegrityViolationException").doesNotContain("secreto-xyz");
	}

	@Test
	void auditFailureOnReadDoesNotReturnTheData() {
		Long id = enTenant(() -> probe.crear("Sillon dato")).id();
		autenticar(987654L, "ROLE_ADMIN");

		assertThatThrownBy(() -> enTenant(() -> probe.leer(id))).isInstanceOf(AuditoriaFallidaException.class);
	}

	@Test
	void nonNumericEntityIdFailsTheOperationAndRollsBack(CapturedOutput output) {
		assertThatThrownBy(() -> enTenant(() -> probe.crearConIdString("Sillon texto-abc")))
				.isInstanceOf(AuditoriaFallidaException.class);

		assertThat(sillonesDelTenant()).isEqualTo(sillonesSembrados);
		assertThat(entradas()).isEmpty();
		assertThat(output.getAll()).doesNotContain("texto-abc");
	}

	@Test
	void authorizationRunsBeforeTheAspectSoDeniedCallsAreNotAudited() {
		autenticar(a.usuario().getId(), "ROLE_" + Rol.RECEPCION.name());

		assertThatThrownBy(() -> enTenant(() -> probe.crearSoloGestion("Sillon x")))
				.isInstanceOf(AccessDeniedException.class);

		assertThat(entradas()).isEmpty();
		assertThat(sillonesDelTenant()).isEqualTo(sillonesSembrados);
	}

	@Test
	void authorizedCallThroughPreAuthorizeIsAudited() {
		AuditedProbeService.SillonCreado creado = enTenant(() -> probe.crearSoloGestion("Sillon gestion"));

		assertThat(entradas()).singleElement().satisfies(l -> assertThat(l.getEntidadId()).isEqualTo(creado.id()));
	}

	private <T> T enTenant(Supplier<T> block) {
		return TenantContext.runAs(tenants.a(), block);
	}

	private long sillonesDelTenant() {
		return fixtures.inTenant(tenants.a(), sillones::count);
	}

	private List<AuditLog> entradas() {
		return fixtures.inTenant(tenants.a(), () -> auditLogs.findAll(Pageable.unpaged()).getContent().stream()
				.filter(l -> !sembradas.contains(l.getId())).toList());
	}

	private static void autenticar(Long usuarioId, String authority) {
		Instant now = Instant.parse("2026-11-23T13:00:00Z");
		Jwt jwt = new Jwt("t", now, now.plusSeconds(600), Map.of("alg", "HS256"),
				Map.of("sub", String.valueOf(usuarioId)));
		SecurityContextHolder.getContext()
				.setAuthentication(new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority(authority))));
	}
}
