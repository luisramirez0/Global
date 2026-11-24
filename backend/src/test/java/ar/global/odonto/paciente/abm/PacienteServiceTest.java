package ar.global.odonto.paciente.abm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.Pagina;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.LocalDate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

/** Spec patient-management: alta, unicidad, edicion, baja logica, reactivacion y aislamiento (design D1-D6). */
@PersistenceTest
@Import(PacienteService.class)
class PacienteServiceTest {

	@Autowired
	private PacienteService service;

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

	private static PacienteRequest req(String nombre, String apellido, String dni, String telefono) {
		return new PacienteRequest(nombre, apellido, dni, null, null, telefono, null, null, null);
	}

	private PacienteResponse crear(Long tenant, PacienteRequest req) {
		return TenantContext.runAs(tenant, () -> service.crear(req));
	}

	private Paciente leer(Long tenant, Long id) {
		return fixtures.inTenant(tenant, () -> pacientes.findById(id).orElseThrow());
	}

	@Test
	void createNormalizesAndAssignsTheCurrentConsultorio() {
		var req = new PacienteRequest("  Ana ", " Pérez ", "30.111.222", LocalDate.of(1990, 5, 1), " ",
				"+54 9 11 2345-6789", " Ana@Mail.TEST ", "", " OSDE 210 ");

		PacienteResponse r = crear(tenants.a(), req);

		assertThat(r.id()).isPositive();
		assertThat(r.nombre()).isEqualTo("Ana");
		assertThat(r.apellido()).isEqualTo("Pérez");
		assertThat(r.dni()).isEqualTo("30111222");
		assertThat(r.telefono()).isEqualTo("+5491123456789");
		assertThat(r.email()).isEqualTo("ana@mail.test");
		assertThat(r.sexo()).isNull();
		assertThat(r.direccion()).isNull();
		assertThat(r.obraSocialTexto()).isEqualTo("OSDE 210");
		assertThat(r.fechaNacimiento()).isEqualTo(LocalDate.of(1990, 5, 1));
		assertThat(r.activo()).isTrue();
		assertThat(leer(tenants.a(), r.id()).getConsultorioId()).isEqualTo(tenants.a());
	}

	@Test
	void createWithoutPhoneStoresNull() {
		PacienteResponse r = crear(tenants.a(), req("Ana", "Perez", "30111222", "  "));

		assertThat(r.telefono()).isNull();
	}

	@Test
	void invalidDniAndPhoneAreReportedTogetherAndNothingIsSaved() {
		assertThatThrownBy(() -> crear(tenants.a(), req("Ana", "Perez", "12AB", "011 15 2345 6789")))
				.isInstanceOfSatisfying(DatoInvalidoException.class,
						ex -> assertThat(ex.getCampos()).containsExactly("dni", "telefono"));
		assertThat(fixtures.inTenant(tenants.a(), () -> pacientes.count())).isZero();
	}

	@Test
	void duplicateDniWithAnotherFormatIsRejectedWithTheExistingId() {
		PacienteResponse existente = crear(tenants.a(), req("Ana", "Perez", "30111222", null));

		assertThatThrownBy(() -> crear(tenants.a(), req("Eva", "Paz", "30.111.222", null)))
				.isInstanceOfSatisfying(DniDuplicadoException.class,
						ex -> assertThat(ex.getPacienteId()).isEqualTo(existente.id()));
		assertThat(fixtures.inTenant(tenants.a(), () -> pacientes.count())).isEqualTo(1);
	}

	@Test
	void duplicateDniOfAnInactivePatientIsRejected() {
		PacienteResponse existente = crear(tenants.a(), req("Ana", "Perez", "30111222", null));
		TenantContext.runAs(tenants.a(), () -> {
			service.darDeBaja(existente.id());
			return null;
		});

		assertThatThrownBy(() -> crear(tenants.a(), req("Eva", "Paz", "30111222", null)))
				.isInstanceOfSatisfying(DniDuplicadoException.class,
						ex -> assertThat(ex.getPacienteId()).isEqualTo(existente.id()));
	}

	@Test
	void sameDniInAnotherConsultorioIsAllowed() {
		crear(tenants.b(), req("Beto", "Paz", "30111222", null));

		assertThat(crear(tenants.a(), req("Ana", "Perez", "30111222", null)).id()).isPositive();
	}

	@Test
	void editReplacesFieldsKeepsActivoAndAcceptsItsOwnDni() {
		PacienteResponse p = crear(tenants.a(), req("Ana", "Perez", "30111222", null));

		PacienteResponse r = TenantContext.runAs(tenants.a(),
				() -> service.editar(p.id(), req("Ana María", "Pérez", "30.111.222", "+5491100000000")));

		assertThat(r.nombre()).isEqualTo("Ana María");
		assertThat(r.telefono()).isEqualTo("+5491100000000");
		assertThat(r.activo()).isTrue();
		assertThat(leer(tenants.a(), p.id()).getNombre()).isEqualTo("Ana María");
	}

	@Test
	void editWithTheDniOfAnotherPatientIsRejectedAndKeepsData() {
		PacienteResponse p1 = crear(tenants.a(), req("Ana", "Perez", "30111222", null));
		PacienteResponse p2 = crear(tenants.a(), req("Eva", "Paz", "27000111", null));

		assertThatThrownBy(() -> TenantContext.runAs(tenants.a(),
				() -> service.editar(p2.id(), req("Eva", "Paz", "30111222", null))))
				.isInstanceOfSatisfying(DniDuplicadoException.class,
						ex -> assertThat(ex.getPacienteId()).isEqualTo(p1.id()));
		assertThat(leer(tenants.a(), p2.id()).getDni()).isEqualTo("27000111");
	}

	@Test
	void editOfAnInactivePatientKeepsItInactive() {
		PacienteResponse p = crear(tenants.a(), req("Ana", "Perez", "30111222", null));
		TenantContext.runAs(tenants.a(), () -> {
			service.darDeBaja(p.id());
			return null;
		});

		PacienteResponse r = TenantContext.runAs(tenants.a(),
				() -> service.editar(p.id(), req("Ana", "Perez", "30111222", null)));

		assertThat(r.activo()).isFalse();
	}

	@Test
	void patientOfAnotherConsultorioOrMissingIsNotFoundForEveryOperation() {
		PacienteResponse deB = crear(tenants.b(), req("Beto", "Paz", "40999888", null));

		for (Long id : new Long[] { deB.id(), 999_999L }) {
			assertThatThrownBy(() -> TenantContext.runAs(tenants.a(), () -> service.obtener(id)))
					.isInstanceOf(RecursoNoEncontradoException.class);
			assertThatThrownBy(() -> TenantContext.runAs(tenants.a(),
					() -> service.editar(id, req("X", "Y", "11222333", null))))
					.isInstanceOf(RecursoNoEncontradoException.class);
			assertThatThrownBy(() -> TenantContext.runAs(tenants.a(), () -> {
				service.darDeBaja(id);
				return null;
			})).isInstanceOf(RecursoNoEncontradoException.class);
			assertThatThrownBy(() -> TenantContext.runAs(tenants.a(), () -> {
				service.reactivar(id);
				return null;
			})).isInstanceOf(RecursoNoEncontradoException.class);
		}
		Paciente intacto = leer(tenants.b(), deB.id());
		assertThat(intacto.getNombre()).isEqualTo("Beto");
		assertThat(intacto.isActivo()).isTrue();
	}

	@Test
	void logicalDeleteIsIdempotentAndKeepsTheRow() {
		PacienteResponse p = crear(tenants.a(), req("Ana", "Perez", "30111222", null));

		TenantContext.runAs(tenants.a(), () -> {
			service.darDeBaja(p.id());
			service.darDeBaja(p.id());
			return null;
		});

		Paciente leido = leer(tenants.a(), p.id());
		assertThat(leido.isActivo()).isFalse();
		assertThat(leido.getNombre()).isEqualTo("Ana");
		assertThat(TenantContext.runAs(tenants.a(), () -> service.obtener(p.id())).activo()).isFalse();
	}

	@Test
	void reactivateIsIdempotent() {
		PacienteResponse p = crear(tenants.a(), req("Ana", "Perez", "30111222", null));

		TenantContext.runAs(tenants.a(), () -> {
			service.darDeBaja(p.id());
			service.reactivar(p.id());
			service.reactivar(p.id());
			return null;
		});

		assertThat(leer(tenants.a(), p.id()).isActivo()).isTrue();
	}

	@Test
	void searchClampsPagingAndMapsToDtos() {
		for (int i = 0; i < 3; i++) {
			crear(tenants.a(), req("Ana" + i, "Perez", "3011122" + i, null));
		}

		Pagina<PacienteResponse> chica = TenantContext.runAs(tenants.a(), () -> service.buscar("perez", false, 0, 2));
		Pagina<PacienteResponse> grande = TenantContext.runAs(tenants.a(), () -> service.buscar(null, false, -3, 500));

		assertThat(chica.contenido()).hasSize(2);
		assertThat(chica.totalElementos()).isEqualTo(3);
		assertThat(chica.totalPaginas()).isEqualTo(2);
		assertThat(grande.tamanio()).isEqualTo(PacienteService.TAMANIO_MAXIMO);
		assertThat(grande.pagina()).isZero();
		assertThat(grande.contenido()).extracting(PacienteResponse::nombre).containsExactly("Ana0", "Ana1", "Ana2");
	}
}
