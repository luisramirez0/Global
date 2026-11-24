package ar.global.odonto.paciente;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.paciente.abm.CriterioBusqueda;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

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

	// --- Busqueda (C-05, design D5) ---

	private static final PageRequest PAGE = PageRequest.of(0, 50, Sort.by("apellido", "nombre", "id"));

	private Paciente save(Long tenant, String nombre, String apellido, String dni, boolean activo) {
		Paciente p = new Paciente(nombre, apellido, dni);
		p.setActivo(activo);
		return fixtures.inTenant(tenant, () -> pacientes.save(p));
	}

	private List<String> buscar(Long tenant, String q, boolean incluirInactivos) {
		CriterioBusqueda c = CriterioBusqueda.de(q);
		return fixtures.inTenant(tenant, () -> pacientes.buscar(c.patron(), c.dniPrefijo(), incluirInactivos, PAGE)
				.map(p -> p.getNombre() + " " + p.getApellido()).getContent());
	}

	@Test
	void searchByPartialSurnameIgnoringCase() {
		save(tenants.a(), "Ana", "Perez", "30111222", true);
		save(tenants.a(), "Luis", "Gomez", "27000111", true);

		assertThat(buscar(tenants.a(), "PER", false)).containsExactly("Ana Perez");
		assertThat(buscar(tenants.a(), "gom", false)).containsExactly("Luis Gomez");
	}

	@Test
	void searchByNameThenSurnameAndSurnameThenName() {
		save(tenants.a(), "Ana", "Perez", "30111222", true);
		save(tenants.a(), "Ana", "Gomez", "27000111", true);

		assertThat(buscar(tenants.a(), "ana per", false)).containsExactly("Ana Perez");
		assertThat(buscar(tenants.a(), "gomez ana", false)).containsExactly("Ana Gomez");
	}

	@Test
	void searchByDniPrefixIgnoringSeparators() {
		save(tenants.a(), "Ana", "Perez", "30111222", true);
		save(tenants.a(), "Luis", "Gomez", "27000111", true);

		assertThat(buscar(tenants.a(), "30.111", false)).containsExactly("Ana Perez");
		assertThat(buscar(tenants.a(), "111222", false)).isEmpty();
	}

	@Test
	void wildcardsInTheQueryAreLiterals() {
		save(tenants.a(), "Ana", "Perez", "30111222", true);
		save(tenants.a(), "Eva", "Sonrisa 100%", "27000111", true);
		save(tenants.a(), "Juan", "a_b", "28000111", true);
		save(tenants.a(), "Juan", "axb", "29000111", true);

		assertThat(buscar(tenants.a(), "%", false)).containsExactly("Eva Sonrisa 100%");
		assertThat(buscar(tenants.a(), "a_b", false)).containsExactly("Juan a_b");
	}

	@Test
	void inactivePatientsAreExcludedUnlessRequested() {
		save(tenants.a(), "Ana", "Perez", "30111222", true);
		save(tenants.a(), "Eva", "Paz", "27000111", false);

		assertThat(buscar(tenants.a(), null, false)).containsExactly("Ana Perez");
		assertThat(buscar(tenants.a(), null, true)).containsExactly("Eva Paz", "Ana Perez");
	}

	@Test
	void resultsAreOrderedBySurnameThenName() {
		save(tenants.a(), "Luis", "Perez", "30111222", true);
		save(tenants.a(), "Ana", "Perez", "27000111", true);
		save(tenants.a(), "Eva", "Gomez", "28000111", true);

		assertThat(buscar(tenants.a(), "", false)).containsExactly("Eva Gomez", "Ana Perez", "Luis Perez");
	}

	@Test
	void searchNeverReturnsPatientsOfAnotherConsultorio() {
		save(tenants.a(), "Ana", "Perez", "30111222", true);
		save(tenants.b(), "Beto", "Perez", "40999888", true);

		assertThat(buscar(tenants.a(), "perez", true)).containsExactly("Ana Perez");
		assertThat(buscar(tenants.a(), "40999888", true)).isEmpty();
		assertThat(buscar(tenants.a(), null, true)).containsExactly("Ana Perez");
	}
}
