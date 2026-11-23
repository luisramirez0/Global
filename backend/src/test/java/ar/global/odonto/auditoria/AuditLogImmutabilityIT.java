package ar.global.odonto.auditoria;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import jakarta.persistence.EntityManager;
import java.lang.reflect.Method;
import java.util.Arrays;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/** Commit real (la transaccion de cada bloque se confirma) y limpieza explicita de filas. */
@PersistenceTest
class AuditLogImmutabilityIT {

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private AuditLogRepository auditLogs;

	@Autowired
	private EntityManager em;

	@Autowired
	private JdbcTemplate jdbc;

	private Tenants tenants;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	private Long saveRead() {
		return fixtures.inTenant(tenants.a(),
				() -> auditLogs.save(new AuditLog(null, AccionAuditoria.READ, "FichaClinica", 12L, null, null)).getId());
	}

	@Test
	void modifyingALoadedEntityAndCommittingLeavesTheRowUntouched() {
		Long id = saveRead();

		fixtures.inTenant(tenants.a(), () -> {
			AuditLog loaded = auditLogs.findById(id).orElseThrow();
			ReflectionTestUtils.setField(loaded, "accion", AccionAuditoria.DELETE);
			ReflectionTestUtils.setField(loaded, "entidad", "Otra");
			return null;
		});

		String accion = jdbc.queryForObject("SELECT accion FROM audit_log WHERE id = ?", String.class, id);
		String entidad = jdbc.queryForObject("SELECT entidad FROM audit_log WHERE id = ?", String.class, id);
		assertThat(accion).isEqualTo("READ");
		assertThat(entidad).isEqualTo("FichaClinica");
	}

	@Test
	void bulkHqlUpdateIsRejected() {
		saveRead();

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> em.createQuery("update AuditLog a set a.accion = :x").setParameter("x", AccionAuditoria.DELETE)
						.executeUpdate())).isInstanceOf(RuntimeException.class);

		assertThat(jdbc.queryForObject("SELECT accion FROM audit_log", String.class)).isEqualTo("READ");
	}

	@Test
	void bulkHqlDeleteIsRejected() {
		saveRead();

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> em.createQuery("delete from AuditLog a").executeUpdate())).isInstanceOf(RuntimeException.class);

		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log", Integer.class)).isEqualTo(1);
	}

	@Test
	void nativeSqlDeleteAndUpdateAreRejected() {
		saveRead();

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> em.createNativeQuery("delete from audit_log").executeUpdate())).isInstanceOf(RuntimeException.class);
		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> em.createNativeQuery("update audit_log set accion = 'DELETE'").executeUpdate()))
				.isInstanceOf(RuntimeException.class);

		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE accion = 'READ'", Integer.class))
				.isEqualTo(1);
	}

	@Test
	void insertsAndSelectsOnAuditLogStillWork() {
		Long id = saveRead();

		assertThat(fixtures.inTenant(tenants.a(), () -> auditLogs.findById(id))).isPresent();
		assertThat(fixtures.inTenant(tenants.a(), () -> em.createNativeQuery("select count(*) from audit_log")
				.getSingleResult())).isNotNull();
	}

	@Test
	void statementsOnOtherTablesAreNotAffected() {
		fixtures.inTenant(tenants.a(), () -> em.createNativeQuery(
				"insert into sillon (consultorio_id, nombre, created_at, updated_at) values (" + tenants.a()
						+ ", 'S', current_timestamp, current_timestamp)").executeUpdate());

		int deleted = fixtures.inTenant(tenants.a(), () -> em.createNativeQuery("delete from sillon").executeUpdate());

		assertThat(deleted).isEqualTo(1);
	}

	@Test
	void repositoryExposesNoDeleteUpdateOrSaveAllOperations() {
		Method[] methods = AuditLogRepository.class.getMethods();

		assertThat(methods).extracting(Method::getName)
				.noneMatch(n -> n.startsWith("delete") || n.startsWith("update") || n.equals("saveAll")
						|| n.equals("flush") || n.startsWith("saveAnd"));
		assertThat(Arrays.stream(methods).map(Method::getName)).contains("save", "findById");
		assertThat(AuditLogRepository.class.getInterfaces()).extracting(Class::getSimpleName)
				.containsExactly("Repository");
	}
}
