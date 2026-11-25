package ar.global.odonto.paciente.export;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.paciente.NotaClinica;
import ar.global.odonto.paciente.NotaClinicaRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;

/**
 * Consultas de solo lectura del export (C-15 design D7), H2 MODE=MySQL con Flyway real. Las listas se leen FUERA
 * de la transaccion para comprobar que prestacion, sillon, profesional y turno vienen cargados (join fetch).
 */
@PersistenceTest
class PacienteExportRepositoryTest {

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private PacienteExportRepository repo;

	@Autowired
	private PacienteRepository pacientes;

	@Autowired
	private TurnoRepository turnos;

	@Autowired
	private NotaClinicaRepository notas;

	private Tenants tenants;

	private Graph a;

	private Graph b;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	private Turno turno(Paciente paciente, String inicio) {
		Instant i = Instant.parse(inicio);
		return turnos.save(new Turno(paciente, a.profesional(), a.sillon(), a.prestacion(), i, i.plusSeconds(1800)));
	}

	@Test
	void turnosOfThePatientComeInChronologicalOrderWithPrestacionAndSillonLoaded() {
		Long[] ids = fixtures.inTenant(tenants.a(), () -> {
			Paciente p = pacientes.findById(a.paciente().getId()).orElseThrow();
			Turno tarde = turno(p, "2026-12-10T15:00:00Z");
			Turno temprano = turno(p, "2026-12-01T12:00:00Z");
			return new Long[] { tarde.getId(), temprano.getId() };
		});

		List<Turno> lista = fixtures.inTenant(tenants.a(), () -> repo.turnosDe(a.paciente().getId()));

		// Seed: turno del 2026-12-02; mas los dos nuevos.
		assertThat(lista).extracting(Turno::getId).containsExactly(ids[1], a.turno().getId(), ids[0]);
		assertThat(lista.get(0).getPrestacion().getNombre()).isEqualTo("Consulta a");
		assertThat(lista.get(0).getSillon().getNombre()).isEqualTo("Sillon a");
		assertThat(lista.get(0).getProfesional().getId()).isEqualTo(a.profesional().getId());
	}

	@Test
	void turnosIncludeCancelledOnesAndExcludeOtherPatients() {
		Long cancelado = fixtures.inTenant(tenants.a(), () -> {
			Turno t = turnos.findById(a.turno().getId()).orElseThrow();
			t.cambiarEstado(EstadoTurno.CANCELADO, "motivo");
			Paciente otro = pacientes.save(new Paciente("Otro", "Paciente", "DNI-otro"));
			turno(otro, "2026-12-03T12:00:00Z");
			return t.getId();
		});

		List<Turno> lista = fixtures.inTenant(tenants.a(), () -> repo.turnosDe(a.paciente().getId()));

		assertThat(lista).extracting(Turno::getId).containsExactly(cancelado);
		assertThat(lista.get(0).getEstado()).isEqualTo(EstadoTurno.CANCELADO);
	}

	@Test
	void turnosOfAPatientOfAnotherTenantAreInvisible() {
		List<Turno> lista = fixtures.inTenant(tenants.a(), () -> repo.turnosDe(b.paciente().getId()));

		assertThat(lista).isEmpty();
		assertThat(fixtures.inTenant(tenants.b(), () -> repo.turnosDe(b.paciente().getId()))).hasSize(1);
	}

	@Test
	void notasComeInChronologicalOrderWithProfesionalAndOptionalTurnoLoaded() {
		Long sinTurno = fixtures.inTenant(tenants.a(), () -> {
			Paciente p = pacientes.findById(a.paciente().getId()).orElseThrow();
			return notas.save(new NotaClinica(p, a.profesional(), Instant.parse("2026-11-30T10:00:00Z"), "previa"))
					.getId();
		});

		List<NotaClinica> lista = fixtures.inTenant(tenants.a(), () -> repo.notasDe(a.paciente().getId()));

		assertThat(lista).extracting(NotaClinica::getId).containsExactly(sinTurno, a.nota().getId());
		assertThat(lista.get(0).getTurno()).isNull();
		assertThat(lista.get(1).getTurno().getId()).isEqualTo(a.turno().getId());
		assertThat(lista.get(1).getProfesional().getId()).isEqualTo(a.profesional().getId());
	}

	@Test
	void notasExcludeOtherPatientsAndOtherTenants() {
		fixtures.inTenant(tenants.a(), () -> {
			Paciente otro = pacientes.save(new Paciente("Otro", "Paciente", "DNI-otro"));
			return notas.save(new NotaClinica(otro, a.profesional(), Instant.parse("2026-11-30T10:00:00Z"), "x"));
		});

		assertThat(fixtures.inTenant(tenants.a(), () -> repo.notasDe(a.paciente().getId())))
				.extracting(NotaClinica::getId).containsExactly(a.nota().getId());
		assertThat(fixtures.inTenant(tenants.a(), () -> repo.notasDe(b.paciente().getId()))).isEmpty();
	}
}
