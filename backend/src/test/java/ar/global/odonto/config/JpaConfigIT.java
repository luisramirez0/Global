package ar.global.odonto.config;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.core.env.Environment;

@PersistenceTest
class JpaConfigIT {

	@Autowired
	private ConsultorioRepository consultorios;

	@Autowired
	private MutableClock clock;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private EntityManagerFactory emf;

	@Autowired
	private Environment env;

	@Autowired
	private LoggingSystem loggingSystem;

	@BeforeEach
	void resetClock() {
		clock.set(TestClockConfig.START);
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	@Test
	void createdAndUpdatedAtComeFromTheClock() {
		Long id = fixtures.createConsultorio("Original");
		Consultorio created = TenantContext.runAsSystem(() -> consultorios.findById(id).orElseThrow());
		assertThat(created.getCreatedAt()).isEqualTo(Instant.parse("2026-11-23T13:00:00Z"));
		assertThat(created.getUpdatedAt()).isEqualTo(Instant.parse("2026-11-23T13:00:00Z"));

		clock.advance(Duration.ofHours(1));
		created.setNombre("Modificado");
		TenantContext.runAsSystem(() -> consultorios.save(created));

		Consultorio reloaded = TenantContext.runAsSystem(() -> consultorios.findById(id).orElseThrow());
		assertThat(reloaded.getCreatedAt()).isEqualTo(Instant.parse("2026-11-23T13:00:00Z"));
		assertThat(reloaded.getUpdatedAt()).isEqualTo(Instant.parse("2026-11-23T14:00:00Z"));
	}

	@Test
	void hibernateWritesInUtc() {
		assertThat(emf.getProperties()).containsEntry("hibernate.jdbc.time_zone", "UTC");
	}

	@Test
	void sqlAndBindParametersAreNotLogged() {
		assertThat(env.getProperty("spring.jpa.show-sql", Boolean.class)).isFalse();
		LogLevel bindLevel = loggingSystem.getLoggerConfiguration("org.hibernate.orm.jdbc.bind")
				.getEffectiveLevel();
		assertThat(bindLevel).isNotEqualTo(LogLevel.TRACE);
		assertThat(emf.getProperties().get("hibernate.show_sql")).isIn(null, "false", Boolean.FALSE);
	}

	@Test
	void updatesToImmutableEntitiesFailInsteadOfBeingIgnored() {
		assertThat(emf.getProperties())
				.containsEntry("hibernate.query.immutable_entity_update_query_handling_mode", "exception");
	}
}
