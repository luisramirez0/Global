package ar.global.odonto.auditoria;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

@PersistenceTest
class AuditLogRepositoryTest {

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private AuditLogRepository auditLogs;

	@Autowired
	private MutableClock clock;

	private Tenants tenants;
	private Graph a;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		clock.set(TestClockConfig.START);
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	@Test
	void insertStoresAllFieldsWithTheClockTimestamp() {
		Long usuarioId = a.usuario().getId();

		AuditLog saved = fixtures.inTenant(tenants.a(),
				() -> auditLogs.save(new AuditLog(usuarioId, AccionAuditoria.READ, "FichaClinica", 12L, null, "10.0.0.5")));

		AuditLog read = fixtures.inTenant(tenants.a(), () -> auditLogs.findById(saved.getId()).orElseThrow());
		assertThat(read.getConsultorioId()).isEqualTo(tenants.a());
		assertThat(read.getUsuarioId()).isEqualTo(usuarioId);
		assertThat(read.getAccion()).isEqualTo(AccionAuditoria.READ);
		assertThat(read.getEntidad()).isEqualTo("FichaClinica");
		assertThat(read.getEntidadId()).isEqualTo(12L);
		assertThat(read.getIp()).isEqualTo("10.0.0.5");
		assertThat(read.getCreatedAt()).isEqualTo(Instant.parse("2026-11-23T13:00:00Z"));
	}

	@Test
	void eventWithoutUserIsAllowed() {
		AuditLog saved = fixtures.inTenant(tenants.a(),
				() -> auditLogs.save(new AuditLog(null, AccionAuditoria.LOGIN, "Usuario", null, null, null)));

		assertThat(saved.getUsuarioId()).isNull();
		assertThat(saved.getId()).isPositive();
	}

	@Test
	void onlyTheCurrentConsultorioRecordsAreListed() {
		Graph b = domain.seed(tenants.b(), "b");
		fixtures.inTenant(tenants.b(), () -> auditLogs.save(new AuditLog(b.usuario().getId(), AccionAuditoria.EXPORT,
				"Paciente", null, null, null)));
		fixtures.inTenant(tenants.a(), () -> auditLogs.save(new AuditLog(a.usuario().getId(), AccionAuditoria.CREATE,
				"Paciente", 1L, null, null)));

		Page<AuditLog> pageA = fixtures.inTenant(tenants.a(), () -> auditLogs.findAll(PageRequest.of(0, 50)));
		Page<AuditLog> pageB = fixtures.inTenant(tenants.b(), () -> auditLogs.findAll(PageRequest.of(0, 50)));

		assertThat(pageA.getContent()).isNotEmpty().allSatisfy(l -> assertThat(l.getConsultorioId()).isEqualTo(tenants.a()));
		assertThat(pageB.getContent()).isNotEmpty().allSatisfy(l -> assertThat(l.getConsultorioId()).isEqualTo(tenants.b()));
		Long foreignId = pageB.getContent().get(0).getId();
		assertThat(fixtures.inTenant(tenants.a(), () -> auditLogs.findById(foreignId))).isEmpty();
	}

	@Test
	void auditLogToStringHasOnlyClassAndId() {
		AuditLog saved = fixtures.inTenant(tenants.a(), () -> auditLogs.save(new AuditLog(a.usuario().getId(),
				AccionAuditoria.READ, "FichaClinica", 12L, null, "10.0.0.5")));

		assertThat(saved.toString()).isEqualTo("AuditLog#" + saved.getId());
	}

	// --- buscar (C-06, design D6) ---

	@Test
	void buscarWithoutFiltersReturnsEveryRecordOfTheTenantNewestFirst() {
		Graph b = domain.seed(tenants.b(), "b");
		Long id1 = guardar(tenants.a(), a, AccionAuditoria.READ, "FichaClinica", 1L, Duration.ofMinutes(1));
		Long id2 = guardar(tenants.a(), a, AccionAuditoria.UPDATE, "Paciente", 2L, Duration.ofMinutes(2));
		guardar(tenants.b(), b, AccionAuditoria.READ, "FichaClinica", 9L, Duration.ofMinutes(3));

		List<AuditLog> r = buscar(tenants.a(), null, null, null, null, null, null);

		assertThat(r).extracting(AuditLog::getId).startsWith(id2, id1);
		assertThat(r).extracting(AuditLog::getConsultorioId).containsOnly(tenants.a());
		assertThat(r).hasSize(3); // las 2 + la fila sembrada por DomainFixtures
	}

	@Test
	void eachFilterWorksAlone() {
		Long read = guardar(tenants.a(), a, AccionAuditoria.READ, "FichaClinica", 12L, Duration.ofMinutes(1));
		Long upd = guardar(tenants.a(), a, AccionAuditoria.UPDATE, "FichaClinica", 13L, Duration.ofMinutes(2));
		Long login = guardar(tenants.a(), a, AccionAuditoria.LOGIN, "Usuario", 14L, Duration.ofMinutes(3));

		assertThat(ids(buscar(tenants.a(), null, null, AccionAuditoria.UPDATE, null, null, null))).containsExactly(upd);
		assertThat(ids(buscar(tenants.a(), null, null, null, "Usuario", null, null))).containsExactly(login);
		assertThat(ids(buscar(tenants.a(), null, null, null, null, 12L, null))).containsExactly(read);
		assertThat(buscar(tenants.a(), null, null, null, null, null, a.usuario().getId())).hasSize(4);
		assertThat(ids(buscar(tenants.a(), Instant.parse("2026-11-23T13:02:00Z"), null, null, null, null, null)))
				.containsExactly(login, upd);
	}

	@Test
	void filtersCombineWithAnd() {
		Long read = guardar(tenants.a(), a, AccionAuditoria.READ, "FichaX", 12L, Duration.ofMinutes(1));
		guardar(tenants.a(), a, AccionAuditoria.UPDATE, "FichaX", 12L, Duration.ofMinutes(2));
		guardar(tenants.a(), a, AccionAuditoria.READ, "Paciente", 12L, Duration.ofMinutes(3));

		assertThat(ids(buscar(tenants.a(), null, null, AccionAuditoria.READ, "FichaX", null, null)))
				.containsExactly(read);
		assertThat(ids(buscar(tenants.a(), null, null, AccionAuditoria.READ, "FichaX", 99L, null))).isEmpty();
	}

	@Test
	void desdeIsInclusiveAndHastaIsExclusive() {
		Long en0 = guardar(tenants.a(), a, AccionAuditoria.READ, "X", 1L, Duration.ofMinutes(10));
		Long en5 = guardar(tenants.a(), a, AccionAuditoria.READ, "X", 2L, Duration.ofMinutes(15));
		Long en10 = guardar(tenants.a(), a, AccionAuditoria.READ, "X", 3L, Duration.ofMinutes(20));
		Instant desde = TestClockConfig.START.plus(Duration.ofMinutes(10));
		Instant hasta = TestClockConfig.START.plus(Duration.ofMinutes(20));

		assertThat(ids(buscar(tenants.a(), desde, hasta, null, "X", null, null))).containsExactly(en5, en0);
		assertThat(ids(buscar(tenants.a(), desde, hasta.plusMillis(1), null, "X", null, null)))
				.containsExactly(en10, en5, en0);
	}

	@Test
	void sameInstantIsOrderedByIdDescending() {
		Long primero = guardar(tenants.a(), a, AccionAuditoria.READ, "Y", 1L, Duration.ofMinutes(5));
		Long segundo = guardar(tenants.a(), a, AccionAuditoria.READ, "Y", 2L, Duration.ofMinutes(5));

		assertThat(ids(buscar(tenants.a(), null, null, null, "Y", null, null))).containsExactly(segundo, primero);
	}

	@Test
	void pagingReportsTheTotal() {
		for (int i = 0; i < 5; i++) {
			guardar(tenants.a(), a, AccionAuditoria.READ, "Z", (long) i, Duration.ofMinutes(i));
		}

		Page<AuditLog> page = fixtures.inTenant(tenants.a(),
				() -> auditLogs.buscar(null, null, null, "Z", null, null, PageRequest.of(1, 2)));

		assertThat(page.getTotalElements()).isEqualTo(5);
		assertThat(page.getContent()).hasSize(2);
	}

	@Test
	void usuarioIdOfAnotherTenantReturnsNothing() {
		Graph b = domain.seed(tenants.b(), "b");
		guardar(tenants.b(), b, AccionAuditoria.READ, "FichaX", 1L, Duration.ofMinutes(1));

		assertThat(buscar(tenants.a(), null, null, null, null, null, b.usuario().getId())).isEmpty();
		assertThat(buscar(tenants.a(), null, null, null, "FichaX", null, null)).isEmpty();
	}

	@Test
	void repositoryExposesNoDeleteOrBulkWriteMethods() {
		assertThat(java.util.Arrays.stream(AuditLogRepository.class.getMethods()).map(m -> m.getName()))
				.noneMatch(n -> n.startsWith("delete") || n.equals("saveAll") || n.equals("flush"));
	}

	private Long guardar(Long tenant, Graph g, AccionAuditoria accion, String entidad, Long entidadId, Duration offset) {
		clock.set(TestClockConfig.START.plus(offset));
		return fixtures.inTenant(tenant, () -> auditLogs
				.save(new AuditLog(g.usuario().getId(), accion, entidad, entidadId, null, null)).getId());
	}

	private List<AuditLog> buscar(Long tenant, Instant desde, Instant hasta, AccionAuditoria accion, String entidad,
			Long entidadId, Long usuarioId) {
		return fixtures.inTenant(tenant, () -> auditLogs
				.buscar(desde, hasta, accion, entidad, entidadId, usuarioId, PageRequest.of(0, 100)).getContent());
	}

	private static List<Long> ids(List<AuditLog> logs) {
		return logs.stream().map(AuditLog::getId).toList();
	}
}
