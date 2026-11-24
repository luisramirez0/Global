package ar.global.odonto.agenda.config;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

@PersistenceTest
class ConsultorioLockTest {

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private ConsultorioRepository consultorios;

	@Autowired
	private SillonRepository sillones;

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

	@Test
	void lockByIdReturnsTheCurrentConsultorioInsideATransaction() {
		Long id = fixtures.inTenant(tenants.a(), () -> consultorios.lockById(TenantContext.require()).orElseThrow().getId());

		assertThat(id).isEqualTo(tenants.a());
	}

	@Test
	void lockByIdOfTheOtherTenantIdIsStillADifferentRow() {
		Long id = fixtures.inTenant(tenants.b(), () -> consultorios.lockById(TenantContext.require()).orElseThrow().getId());

		assertThat(id).isEqualTo(tenants.b());
	}

	@Test
	void countsAndListsOnlyActiveSillonesOfTheCurrentTenant() {
		fixtures.inTenant(tenants.a(), () -> {
			sillones.save(new Sillon("Zeta"));
			sillones.save(new Sillon("Alfa"));
			Sillon off = new Sillon("Off");
			off.setActivo(false);
			sillones.save(off);
			return null;
		});
		fixtures.inTenant(tenants.b(), () -> sillones.save(new Sillon("De B")));

		assertThat(fixtures.inTenant(tenants.a(), sillones::countByActivoTrue)).isEqualTo(2L);
		assertThat(fixtures.inTenant(tenants.a(),
				() -> sillones.findAllByActivoTrueOrderByNombre().stream().map(Sillon::getNombre).toList()))
				.containsExactly("Alfa", "Zeta");
		assertThat(fixtures.inTenant(tenants.b(), sillones::countByActivoTrue)).isEqualTo(1L);
		assertThat(fixtures.inTenant(tenants.a(),
				() -> sillones.findAllByOrderByNombre().stream().map(Sillon::getNombre).toList()))
				.containsExactly("Alfa", "Off", "Zeta");
	}
}
