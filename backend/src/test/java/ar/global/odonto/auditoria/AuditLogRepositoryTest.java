package ar.global.odonto.auditoria;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import java.time.Instant;
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
}
