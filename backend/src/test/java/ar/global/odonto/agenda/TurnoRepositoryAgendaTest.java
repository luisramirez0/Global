package ar.global.odonto.agenda;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Consultas de C-07 sobre {@code turno} (design D2, D10, D11): conflictos por sillon y por profesional y agenda
 * por rango. Fechas el lunes 2026-12-07 para no cruzarse con el turno del seed (2026-12-02).
 */
@PersistenceTest
class TurnoRepositoryAgendaTest {

	private static final String DIA = "2026-12-07";

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private TurnoRepository turnos;

	@Autowired
	private PacienteRepository pacientes;

	@Autowired
	private SillonRepository sillones;

	@Autowired
	private ProfesionalRepository profesionales;

	@Autowired
	private PrestacionRepository prestaciones;

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

	private Turno turno(Long tenant, Graph g, Sillon sillon, Profesional profesional, String desde, String hasta,
			EstadoTurno estado) {
		return fixtures.inTenant(tenant, () -> {
			Turno nuevo = new Turno(pacientes.getReferenceById(g.paciente().getId()),
					profesionales.getReferenceById(profesional.getId()), sillones.getReferenceById(sillon.getId()),
					prestaciones.getReferenceById(g.prestacion().getId()), t(desde), t(hasta));
			if (estado != EstadoTurno.PROGRAMADO) {
				nuevo.cambiarEstado(estado, null);
			}
			return turnos.save(nuevo);
		});
	}

	private Turno turnoA(String desde, String hasta) {
		return turno(tenants.a(), a, a.sillon(), a.profesional(), desde, hasta, EstadoTurno.PROGRAMADO);
	}

	private Long conflictoSillonA(Long sillonId, String desde, String hasta, Long excluirId) {
		return fixtures.inTenant(tenants.a(), () -> turnos.primerConflictoSillon(sillonId, t(desde), t(hasta),
				excluirId).map(Turno::getId).orElse(null));
	}

	private Long conflictoProfesionalA(Long profesionalId, String desde, String hasta, Long excluirId) {
		return fixtures.inTenant(tenants.a(), () -> turnos.primerConflictoProfesional(profesionalId, t(desde),
				t(hasta), excluirId).map(Turno::getId).orElse(null));
	}

	@Nested
	class ConflictoPorSillon {

		@Test
		void exactAndPartialOverlapsAreConflicts() {
			Turno existente = turnoA("13:00", "13:30");

			assertThat(conflictoSillonA(a.sillon().getId(), "13:00", "13:30", null)).isEqualTo(existente.getId());
			assertThat(conflictoSillonA(a.sillon().getId(), "13:15", "13:45", null)).isEqualTo(existente.getId());
			assertThat(conflictoSillonA(a.sillon().getId(), "12:45", "13:15", null)).isEqualTo(existente.getId());
			assertThat(conflictoSillonA(a.sillon().getId(), "12:00", "15:00", null)).isEqualTo(existente.getId());
		}

		@Test
		void adjacentTurnosAreNotConflicts() {
			turnoA("13:00", "13:30");

			assertThat(conflictoSillonA(a.sillon().getId(), "13:30", "14:00", null)).isNull();
			assertThat(conflictoSillonA(a.sillon().getId(), "12:30", "13:00", null)).isNull();
		}

		@Test
		void cancelledTurnosDoNotOccupyTheSillon() {
			turno(tenants.a(), a, a.sillon(), a.profesional(), "13:00", "13:30", EstadoTurno.CANCELADO);

			assertThat(conflictoSillonA(a.sillon().getId(), "13:00", "13:30", null)).isNull();
		}

		@Test
		void finishedTurnosStillOccupyTheSillon() {
			Turno asistio = turno(tenants.a(), a, a.sillon(), a.profesional(), "13:00", "13:30", EstadoTurno.ASISTIO);
			Turno ausente = turno(tenants.a(), a, a.sillon(), a.profesional(), "14:00", "14:30", EstadoTurno.AUSENTE);

			assertThat(conflictoSillonA(a.sillon().getId(), "13:00", "13:30", null)).isEqualTo(asistio.getId());
			assertThat(conflictoSillonA(a.sillon().getId(), "14:00", "14:30", null)).isEqualTo(ausente.getId());
		}

		@Test
		void anotherSillonIsNotAConflict() {
			turnoA("13:00", "13:30");

			assertThat(conflictoSillonA(sillon2A.getId(), "13:00", "13:30", null)).isNull();
		}

		@Test
		void theTurnoItselfIsExcluded() {
			Turno propio = turnoA("13:00", "14:00");

			assertThat(conflictoSillonA(a.sillon().getId(), "13:30", "14:30", propio.getId())).isNull();
			Turno otro = turnoA("14:00", "14:30");
			assertThat(conflictoSillonA(a.sillon().getId(), "13:30", "14:30", propio.getId()))
					.isEqualTo(otro.getId());
		}

		@Test
		void earliestConflictIsReturnedFirst() {
			Turno segundo = turnoA("14:00", "14:30");
			Turno primero = turnoA("13:00", "13:30");

			assertThat(conflictoSillonA(a.sillon().getId(), "12:00", "15:00", null)).isEqualTo(primero.getId());
			assertThat(segundo.getId()).isNotEqualTo(primero.getId());
		}

		@Test
		void turnoOfAnotherTenantInTheSameSlotIsInvisible() {
			Turno deB = turno(tenants.b(), b, b.sillon(), b.profesional(), "13:00", "13:30", EstadoTurno.PROGRAMADO);

			assertThat(conflictoSillonA(a.sillon().getId(), "13:00", "13:30", null)).isNull();
			assertThat(conflictoSillonA(b.sillon().getId(), "13:00", "13:30", null)).isNull();
			assertThat(fixtures.inTenant(tenants.b(), () -> turnos
					.primerConflictoSillon(b.sillon().getId(), t("13:00"), t("13:30"), null).map(Turno::getId)))
					.contains(deB.getId());
		}
	}

	@Nested
	class ConflictoPorProfesional {

		@Test
		void sameProfesionalOnAnotherSillonIsAConflict() {
			Turno existente = turnoA("13:00", "13:30");

			assertThat(conflictoProfesionalA(a.profesional().getId(), "13:15", "13:45", null))
					.isEqualTo(existente.getId());
		}

		@Test
		void anotherProfesionalAdjacentCancelledOrSelfAreNotConflicts() {
			Turno propio = turnoA("13:00", "13:30");
			turno(tenants.a(), a, sillon2A, a.profesional(), "15:00", "15:30", EstadoTurno.CANCELADO);

			assertThat(conflictoProfesionalA(profesional2A.getId(), "13:00", "13:30", null)).isNull();
			assertThat(conflictoProfesionalA(a.profesional().getId(), "13:30", "14:00", null)).isNull();
			assertThat(conflictoProfesionalA(a.profesional().getId(), "15:00", "15:30", null)).isNull();
			assertThat(conflictoProfesionalA(a.profesional().getId(), "13:00", "13:30", propio.getId())).isNull();
		}

		@Test
		void profesionalOfAnotherTenantIsInvisible() {
			turno(tenants.b(), b, b.sillon(), b.profesional(), "13:00", "13:30", EstadoTurno.PROGRAMADO);

			assertThat(conflictoProfesionalA(b.profesional().getId(), "13:00", "13:30", null)).isNull();
		}
	}

	@Nested
	class Agenda {

		private List<Turno> agendaA(String desde, String hasta, Long sillonId, Long profesionalId,
				boolean incluirCancelados) {
			return fixtures.inTenant(tenants.a(), () -> turnos.buscarAgenda(t(desde), t(hasta), sillonId,
					profesionalId, incluirCancelados));
		}

		@Test
		void returnsTurnosIntersectingTheRangeOrderedByStart() {
			Turno tarde = turnoA("15:00", "15:30");
			Turno temprano = turnoA("12:00", "12:30");
			Turno cruzaElInicio = turnoA("11:45", "12:15");
			turnoA("16:00", "16:30");

			assertThat(agendaA("12:00", "16:00", null, null, false)).extracting(Turno::getId)
					.containsExactly(cruzaElInicio.getId(), temprano.getId(), tarde.getId());
		}

		@Test
		void turnosOfOtherDaysAreExcluded() {
			Turno hoy = turnoA("13:00", "13:30");

			// El turno del seed (2026-12-02) queda fuera del dia consultado.
			assertThat(agendaA("00:00", "23:59", null, null, false)).extracting(Turno::getId)
					.containsExactly(hoy.getId());
		}

		@Test
		void filtersBySillonAndProfesional() {
			Turno sillon1 = turnoA("13:00", "13:30");
			Turno sillon2 = turno(tenants.a(), a, sillon2A, profesional2A, "13:00", "13:30", EstadoTurno.PROGRAMADO);

			assertThat(agendaA("00:00", "23:59", sillon2A.getId(), null, false)).extracting(Turno::getId)
					.containsExactly(sillon2.getId());
			assertThat(agendaA("00:00", "23:59", null, a.profesional().getId(), false)).extracting(Turno::getId)
					.containsExactly(sillon1.getId());
			assertThat(agendaA("00:00", "23:59", a.sillon().getId(), profesional2A.getId(), false)).isEmpty();
		}

		@Test
		void foreignFiltersReturnAnEmptyList() {
			turnoA("13:00", "13:30");

			assertThat(agendaA("00:00", "23:59", b.sillon().getId(), null, false)).isEmpty();
			assertThat(agendaA("00:00", "23:59", null, b.profesional().getId(), false)).isEmpty();
		}

		@Test
		void cancelledTurnosOnlyOnRequest() {
			Turno vigente = turnoA("13:00", "13:30");
			Turno cancelado = turno(tenants.a(), a, a.sillon(), a.profesional(), "14:00", "14:30",
					EstadoTurno.CANCELADO);

			assertThat(agendaA("00:00", "23:59", null, null, false)).extracting(Turno::getId)
					.containsExactly(vigente.getId());
			assertThat(agendaA("00:00", "23:59", null, null, true)).extracting(Turno::getId)
					.containsExactly(vigente.getId(), cancelado.getId());
		}

		@Test
		void agendaIsIsolatedBetweenTenants() {
			Turno deA = turnoA("13:00", "13:30");
			turno(tenants.b(), b, b.sillon(), b.profesional(), "13:00", "13:30", EstadoTurno.PROGRAMADO);

			assertThat(agendaA("00:00", "23:59", null, null, true)).extracting(Turno::getId)
					.containsExactly(deA.getId());
		}

		@Test
		void pacienteAndPrestacionAreFetchedWithTheTurno() {
			turnoA("13:00", "13:30");

			// La transaccion ya cerro: si no vinieran en la misma consulta, acceder lanzaria
			// LazyInitializationException (evita N+1 en la vista de agenda, design D10).
			Turno leido = agendaA("00:00", "23:59", null, null, false).get(0);
			Paciente paciente = leido.getPaciente();
			assertThat(paciente.getApellido()).isEqualTo("Apellido a");
			assertThat(leido.getPrestacion().getNombre()).isEqualTo("Consulta a");
		}
	}
}
