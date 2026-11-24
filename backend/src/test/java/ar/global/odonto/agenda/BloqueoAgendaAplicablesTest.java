package ar.global.odonto.agenda;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * {@code BloqueoAgendaRepository.aplicables} (C-07 design D11): bloqueos que se cruzan con el turno y cuyo
 * sillon/profesional es nulo (cualquiera) o igual. Fechas el 2026-12-07 (el bloqueo del seed es el 2026-12-01).
 */
@PersistenceTest
class BloqueoAgendaAplicablesTest {

	private static final String DIA = "2026-12-07";

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private BloqueoAgendaRepository bloqueos;

	@Autowired
	private SillonRepository sillones;

	@Autowired
	private ProfesionalRepository profesionales;

	private Tenants tenants;
	private Graph a;
	private Graph b;
	private Sillon sillon2A;
	private Profesional profesional2A;

	private static Instant t(String hora) {
		return Instant.parse(DIA + "T" + hora + ":00Z");
	}

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
		sillon2A = fixtures.inTenant(tenants.a(), () -> sillones.save(new Sillon("Sillon 2 a")));
		profesional2A = fixtures.inTenant(tenants.a(), () -> profesionales.save(new Profesional("Prof", "Dos a")));
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	private BloqueoAgenda bloqueo(Long tenant, Sillon sillon, Profesional profesional, String desde, String hasta) {
		return fixtures.inTenant(tenant, () -> {
			BloqueoAgenda nuevo = new BloqueoAgenda(t(desde), t(hasta));
			if (sillon != null) {
				nuevo.setSillon(sillones.getReferenceById(sillon.getId()));
			}
			if (profesional != null) {
				nuevo.setProfesional(profesionales.getReferenceById(profesional.getId()));
			}
			return bloqueos.save(nuevo);
		});
	}

	private List<Long> aplicablesA(String desde, String hasta, Sillon sillon, Profesional profesional) {
		return fixtures.inTenant(tenants.a(), () -> bloqueos
				.aplicables(t(desde), t(hasta), sillon.getId(), profesional.getId()).stream()
				.map(BloqueoAgenda::getId).toList());
	}

	@Test
	void sillonBlockAppliesOnlyToThatSillon() {
		BloqueoAgenda deSillon1 = bloqueo(tenants.a(), a.sillon(), null, "14:00", "15:00");

		assertThat(aplicablesA("14:00", "14:30", a.sillon(), a.profesional())).containsExactly(deSillon1.getId());
		assertThat(aplicablesA("14:00", "14:30", sillon2A, a.profesional())).isEmpty();
	}

	@Test
	void profesionalBlockAppliesOnAnySillonOnlyForThatProfesional() {
		BloqueoAgenda deProfesional = bloqueo(tenants.a(), null, a.profesional(), "14:00", "15:00");

		assertThat(aplicablesA("14:30", "15:00", sillon2A, a.profesional())).containsExactly(deProfesional.getId());
		assertThat(aplicablesA("14:30", "15:00", a.sillon(), profesional2A)).isEmpty();
	}

	@Test
	void consultorioWideBlockAppliesToEverySillonAndProfesional() {
		BloqueoAgenda general = bloqueo(tenants.a(), null, null, "14:00", "15:00");

		assertThat(aplicablesA("14:00", "14:30", a.sillon(), a.profesional())).containsExactly(general.getId());
		assertThat(aplicablesA("14:00", "14:30", sillon2A, profesional2A)).containsExactly(general.getId());
	}

	@Test
	void blockOfSillonAndProfesionalNeedsBothToMatch() {
		BloqueoAgenda ambos = bloqueo(tenants.a(), a.sillon(), a.profesional(), "14:00", "15:00");

		assertThat(aplicablesA("14:00", "14:30", a.sillon(), a.profesional())).containsExactly(ambos.getId());
		assertThat(aplicablesA("14:00", "14:30", a.sillon(), profesional2A)).isEmpty();
		assertThat(aplicablesA("14:00", "14:30", sillon2A, a.profesional())).isEmpty();
	}

	@Test
	void adjacentAndDisjointBlocksDoNotApply() {
		bloqueo(tenants.a(), null, null, "14:00", "15:00");

		assertThat(aplicablesA("15:00", "15:30", a.sillon(), a.profesional())).isEmpty();
		assertThat(aplicablesA("13:30", "14:00", a.sillon(), a.profesional())).isEmpty();
		assertThat(aplicablesA("09:00", "09:30", a.sillon(), a.profesional())).isEmpty();
	}

	@Test
	void severalApplicableBlocksAreOrderedByStart() {
		BloqueoAgenda tarde = bloqueo(tenants.a(), null, null, "14:30", "15:30");
		BloqueoAgenda temprano = bloqueo(tenants.a(), a.sillon(), null, "13:30", "14:30");
		bloqueo(tenants.a(), sillon2A, null, "13:00", "16:00");

		assertThat(aplicablesA("14:00", "15:00", a.sillon(), a.profesional()))
				.containsExactly(temprano.getId(), tarde.getId());
	}

	@Test
	void blocksOfAnotherTenantNeverApply() {
		bloqueo(tenants.b(), null, null, "14:00", "15:00");
		bloqueo(tenants.b(), b.sillon(), null, "14:00", "15:00");

		assertThat(aplicablesA("14:00", "14:30", a.sillon(), a.profesional())).isEmpty();
	}
}
