package ar.global.odonto.consultorio;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

@PersistenceTest
class ConsultorioRepositoryTest {

	@Autowired
	private ConsultorioRepository repository;

	@Autowired
	private TenantFixtures fixtures;

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	@Test
	void savesAndReadsAConsultorio() {
		Consultorio c = new Consultorio("Consultorio Demo");
		c.setTelefono("+5491155550000");

		Long id = TenantContext.runAsSystem(() -> repository.save(c).getId());
		Consultorio found = TenantContext.runAsSystem(() -> repository.findById(id).orElseThrow());

		assertThat(id).isPositive();
		assertThat(found.getNombre()).isEqualTo("Consultorio Demo");
		assertThat(found.getTelefono()).isEqualTo("+5491155550000");
		assertThat(found.isActivo()).isTrue();
		assertThat(found.getZonaHoraria()).isEqualTo("America/Argentina/Buenos_Aires");
	}

	@Test
	void findByIdOfUnknownConsultorioIsEmpty() {
		assertThat(TenantContext.runAsSystem(() -> repository.findById(987_654L))).isEmpty();
	}

	@Test
	void consultorioCanBeReadInsideItsOwnTenantContext() {
		Long id = fixtures.createConsultorio("Propio");

		Consultorio found = TenantContext.runAs(id, () -> repository.findById(id).orElseThrow());

		assertThat(found.getId()).isEqualTo(id);
	}
}
