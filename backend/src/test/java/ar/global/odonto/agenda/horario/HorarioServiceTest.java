package ar.global.odonto.agenda.horario;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.HorarioAtencionRepository;
import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.common.web.ValidacionException;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.LocalTime;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

/** Design D8: resolucion del profesional y solapamiento de franjas (tenant A; B para aislamiento). */
@PersistenceTest
@Import(HorarioService.class)
class HorarioServiceTest {

	@Autowired
	private HorarioService service;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private ProfesionalRepository profesionales;

	@Autowired
	private HorarioAtencionRepository horarios;

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

	private <T> T enA(Supplier<T> block) {
		return TenantContext.runAs(tenants.a(), block);
	}

	private long count(Long tenant) {
		return fixtures.inTenant(tenant, () -> horarios.count());
	}

	private Long profesional(Long tenant, String apellido, boolean activo) {
		return fixtures.inTenant(tenant, () -> {
			Profesional p = new Profesional("Dr", apellido);
			p.setActivo(activo);
			return profesionales.save(p).getId();
		});
	}

	private static HorarioRequest req(Long profesionalId, int dia, int desde, int hasta) {
		return new HorarioRequest(profesionalId, dia, LocalTime.of(desde, 0), LocalTime.of(hasta, 0));
	}

	// --- 5.1 resolucion de profesional -------------------------------------------------------

	@Test
	void omittedWithNoActiveProfessionalsIsInvalidReference() {
		profesional(tenants.a(), "Inactivo", false);

		assertThatThrownBy(() -> enA(() -> service.crear(req(null, 1, 9, 13))))
				.isInstanceOf(ReferenciaInvalidaException.class);
		assertThat(count(tenants.a())).isZero();
	}

	@Test
	void omittedWithOneActiveProfessionalUsesIt() {
		Long unico = profesional(tenants.a(), "Unico", true);
		profesional(tenants.a(), "Inactivo", false);

		HorarioResponse r = enA(() -> service.crear(req(null, 1, 9, 13)));

		assertThat(r.profesionalId()).isEqualTo(unico);
	}

	@Test
	void omittedWithTwoActiveProfessionalsIsInvalidReference() {
		profesional(tenants.a(), "Uno", true);
		profesional(tenants.a(), "Dos", true);

		assertThatThrownBy(() -> enA(() -> service.crear(req(null, 1, 9, 13))))
				.isInstanceOf(ReferenciaInvalidaException.class);
	}

	@Test
	void givenProfessionalIsUsedEvenWithSeveralActive() {
		profesional(tenants.a(), "Uno", true);
		Long dos = profesional(tenants.a(), "Dos", true);

		assertThat(enA(() -> service.crear(req(dos, 1, 9, 13))).profesionalId()).isEqualTo(dos);
	}

	@Test
	void givenInactiveProfessionalIsInvalidReference() {
		profesional(tenants.a(), "Activo", true);
		Long inactivo = profesional(tenants.a(), "Inactivo", false);

		assertThatThrownBy(() -> enA(() -> service.crear(req(inactivo, 1, 9, 13))))
				.isInstanceOf(ReferenciaInvalidaException.class);
	}

	@Test
	void givenProfessionalOfAnotherConsultorioIsInvalidReference() {
		profesional(tenants.a(), "Activo", true);
		Long deB = profesional(tenants.b(), "De B", true);

		assertThatThrownBy(() -> enA(() -> service.crear(req(deB, 1, 9, 13))))
				.isInstanceOf(ReferenciaInvalidaException.class);
	}

	@Test
	void sameResolutionRulesApplyWhenEditing() {
		Long uno = profesional(tenants.a(), "Uno", true);
		Long id = enA(() -> service.crear(req(uno, 1, 9, 13))).id();
		Long dos = profesional(tenants.a(), "Dos", true);

		assertThatThrownBy(() -> enA(() -> service.actualizar(id, req(null, 1, 9, 13))))
				.isInstanceOf(ReferenciaInvalidaException.class);
		Long inactivo = profesional(tenants.a(), "Inactivo", false);
		assertThatThrownBy(() -> enA(() -> service.actualizar(id, req(inactivo, 1, 9, 13))))
				.isInstanceOf(ReferenciaInvalidaException.class);
		assertThat(enA(() -> service.actualizar(id, req(dos, 1, 9, 13))).profesionalId()).isEqualTo(dos);
	}

	@Test
	void editingWithOmittedProfessionalAndOneActiveUsesTheOnlyOne() {
		Long unico = profesional(tenants.a(), "Unico", true);
		Long id = enA(() -> service.crear(req(unico, 1, 9, 13))).id();

		assertThat(enA(() -> service.actualizar(id, req(null, 2, 9, 13))).profesionalId()).isEqualTo(unico);
	}

	// --- 5.2 solapamiento ---------------------------------------------------------------------

	@Test
	void overlappingCreateOnTheSameDayIsConflict() {
		Long p = profesional(tenants.a(), "Uno", true);
		enA(() -> service.crear(req(p, 1, 9, 13)));

		assertThatThrownBy(() -> enA(() -> service.crear(req(p, 1, 12, 15)))).isInstanceOf(ConflictoException.class);
		assertThat(count(tenants.a())).isEqualTo(1);
	}

	@Test
	void adjacentOrOtherDayOrOtherProfessionalDoesNotConflict() {
		Long p = profesional(tenants.a(), "Uno", true);
		Long q = profesional(tenants.a(), "Dos", true);
		enA(() -> service.crear(req(p, 1, 9, 13)));

		enA(() -> service.crear(req(p, 1, 13, 17)));
		enA(() -> service.crear(req(p, 2, 9, 13)));
		enA(() -> service.crear(req(q, 1, 9, 13)));

		assertThat(count(tenants.a())).isEqualTo(4);
	}

	@Test
	void editingTowardsAnOverlapIsConflictAndLeavesTheRowUnchanged() {
		Long p = profesional(tenants.a(), "Uno", true);
		enA(() -> service.crear(req(p, 1, 9, 13)));
		Long martes = enA(() -> service.crear(req(p, 2, 9, 13))).id();

		assertThatThrownBy(() -> enA(() -> service.actualizar(martes, req(p, 1, 11, 14))))
				.isInstanceOf(ConflictoException.class);

		HorarioResponse intacto = enA(() -> service.obtener(martes));
		assertThat(intacto.diaSemana()).isEqualTo(2);
		assertThat(intacto.horaDesde()).isEqualTo(LocalTime.of(9, 0));
	}

	@Test
	void editingByChangingProfessionalTowardsAnOverlapIsConflict() {
		Long p = profesional(tenants.a(), "Uno", true);
		Long q = profesional(tenants.a(), "Dos", true);
		enA(() -> service.crear(req(p, 1, 9, 13)));
		Long deQ = enA(() -> service.crear(req(q, 1, 10, 12))).id();

		assertThatThrownBy(() -> enA(() -> service.actualizar(deQ, req(p, 1, 10, 12))))
				.isInstanceOf(ConflictoException.class);
	}

	@Test
	void editingAFranjaOverItselfByExtendingItIsOk() {
		Long p = profesional(tenants.a(), "Uno", true);
		Long id = enA(() -> service.crear(req(p, 1, 9, 13))).id();

		HorarioResponse r = enA(() -> service.actualizar(id, req(p, 1, 9, 14)));

		assertThat(r.horaHasta()).isEqualTo(LocalTime.of(14, 0));
	}

	// --- validacion entre campos y aislamiento ------------------------------------------------

	@Test
	void horaHastaNotAfterHoraDesdeIsValidationErrorOnHoraHasta() {
		Long p = profesional(tenants.a(), "Uno", true);

		assertThatThrownBy(() -> enA(() -> service.crear(req(p, 1, 13, 9)))).isInstanceOfSatisfying(
				ValidacionException.class, e -> assertThat(e.getCampo()).isEqualTo("horaHasta"));
		assertThatThrownBy(() -> enA(() -> service.crear(req(p, 1, 9, 9)))).isInstanceOfSatisfying(
				ValidacionException.class, e -> assertThat(e.getCampo()).isEqualTo("horaHasta"));
	}

	@Test
	void horaOffTheGridIsValidationErrorOnThatField() {
		Long p = profesional(tenants.a(), "Uno", true);

		assertThatThrownBy(() -> enA(() -> service.crear(
				new HorarioRequest(p, 1, LocalTime.of(9, 10), LocalTime.of(12, 0))))).isInstanceOfSatisfying(
						ValidacionException.class, e -> assertThat(e.getCampo()).isEqualTo("horaDesde"));
		assertThatThrownBy(() -> enA(() -> service.crear(
				new HorarioRequest(p, 1, LocalTime.of(9, 0), LocalTime.of(12, 5))))).isInstanceOfSatisfying(
						ValidacionException.class, e -> assertThat(e.getCampo()).isEqualTo("horaHasta"));
	}

	@Test
	void franjaOfAnotherConsultorioIsNotFound() {
		Long pb = profesional(tenants.b(), "De B", true);
		Long deB = TenantContext.runAs(tenants.b(), () -> service.crear(req(pb, 1, 9, 13))).id();
		profesional(tenants.a(), "De A", true);

		assertThatThrownBy(() -> enA(() -> service.obtener(deB))).isInstanceOf(RecursoNoEncontradoException.class);
		assertThatThrownBy(() -> enA(() -> service.actualizar(deB, req(null, 1, 9, 13))))
				.isInstanceOf(RecursoNoEncontradoException.class);
		assertThatThrownBy(() -> enA(() -> {
			service.borrar(deB);
			return null;
		})).isInstanceOf(RecursoNoEncontradoException.class);
		assertThat(count(tenants.b())).isEqualTo(1);
		assertThat(enA(() -> service.listar(null))).isEmpty();
	}
}
