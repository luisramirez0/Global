package ar.global.odonto.paciente;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.LocalDate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

@PersistenceTest
class PacienteRepositoryTest {

	@Autowired
	private PacienteRepository pacientes;

	@Autowired
	private TenantFixtures fixtures;

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

	private Paciente save(Long tenant, String dni) {
		return fixtures.inTenant(tenant, () -> pacientes.save(new Paciente("Ana", "Perez", dni)));
	}

	@Test
	void duplicateDniInTheSameConsultorioFails() {
		save(tenants.a(), "30111222");

		assertThatThrownBy(() -> save(tenants.a(), "30111222")).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void sameDniInAnotherConsultorioIsAllowed() {
		save(tenants.a(), "30111222");

		Paciente ofB = save(tenants.b(), "30111222");

		assertThat(ofB.getId()).isPositive();
		assertThat(ofB.getConsultorioId()).isEqualTo(tenants.b());
	}

	@Test
	void findByDniReturnsOnlyTheCurrentConsultorioPatient() {
		Paciente ofA = save(tenants.a(), "30111222");
		Paciente ofB = save(tenants.b(), "30111222");

		Paciente foundA = fixtures.inTenant(tenants.a(), () -> pacientes.findByDni("30111222").orElseThrow());
		Paciente foundB = fixtures.inTenant(tenants.b(), () -> pacientes.findByDni("30111222").orElseThrow());

		assertThat(foundA.getId()).isEqualTo(ofA.getId());
		assertThat(foundB.getId()).isEqualTo(ofB.getId());
	}

	@Test
	void findByIdOfAnotherConsultorioPatientIsEmpty() {
		Paciente ofB = save(tenants.b(), "30999888");

		assertThat(fixtures.inTenant(tenants.a(), () -> pacientes.findById(ofB.getId()))).isEmpty();
		assertThat(fixtures.inTenant(tenants.a(), () -> pacientes.findAll())).isEmpty();
	}

	@Test
	void activoIsTrueByDefaultAndBirthDateRoundTrips() {
		Paciente p = new Paciente("Luis", "Gomez", "27000111");
		p.setFechaNacimiento(LocalDate.of(1985, 3, 9));
		Paciente saved = fixtures.inTenant(tenants.a(), () -> pacientes.save(p));

		Paciente read = fixtures.inTenant(tenants.a(), () -> pacientes.findById(saved.getId()).orElseThrow());

		assertThat(read.isActivo()).isTrue();
		assertThat(read.getFechaNacimiento()).isEqualTo(LocalDate.of(1985, 3, 9));
	}

	@Test
	void toStringDoesNotLeakPersonalData() {
		Paciente saved = save(tenants.a(), "30111222");

		assertThat(saved.toString()).contains(String.valueOf(saved.getId())).doesNotContain("Ana")
				.doesNotContain("Perez").doesNotContain("30111222");
	}
}
