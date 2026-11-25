package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/** Consulta de turnos pendientes de recordatorio (C-09, design D10). */
@PersistenceTest
class RecordatorioRepositoryPendientesTest {

	private static final Instant DESDE = Instant.parse("2026-11-26T03:00:00Z");
	private static final Instant HASTA = Instant.parse("2026-11-27T03:00:00Z");
	private static final Instant EN_RANGO = Instant.parse("2026-11-26T13:00:00Z");
	private static final Instant GENERADO_EN = Instant.parse("2026-11-25T12:00:00Z");
	private static final Set<EstadoTurno> RECORDABLES = Set.of(EstadoTurno.PROGRAMADO, EstadoTurno.CONFIRMADO);

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private RecordatorioRepository recordatorios;

	@Autowired
	private TurnoRepository turnos;

	@Autowired
	private JdbcTemplate jdbc;

	private Tenants tenants;
	private Graph a;
	private Graph b;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
		jdbc.update("DELETE FROM recordatorio");
		jdbc.update("DELETE FROM nota_clinica");
		jdbc.update("DELETE FROM turno");
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	private Turno turno(Long tenant, Graph g, Instant inicio, EstadoTurno estado) {
		return fixtures.inTenant(tenant, () -> {
			Turno t = new Turno(g.paciente(), g.profesional(), g.sillon(), g.prestacion(), inicio,
					inicio.plusSeconds(1800));
			if (estado != EstadoTurno.PROGRAMADO) {
				t.cambiarEstado(estado, estado == EstadoTurno.CANCELADO ? "motivo" : null);
			}
			return turnos.save(t);
		});
	}

	private Recordatorio recordatorio(Long tenant, Turno turno, EstadoRecordatorio estado, Instant generadoEn) {
		return fixtures.inTenant(tenant, () -> recordatorios.save(new Recordatorio(
				turnos.getReferenceById(turno.getId()), CanalRecordatorio.EMAIL, generadoEn, estado)));
	}

	private List<Long> pendientes(Long tenant) {
		return fixtures.inTenant(tenant, () -> recordatorios.buscarPendientes(RECORDABLES, DESDE, HASTA).stream()
				.map(Turno::getId).toList());
	}

	@Test
	void programadoAndConfirmadoWithoutReminderAppear() {
		Turno programado = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		Turno confirmado = turno(tenants.a(), a, EN_RANGO.plusSeconds(3600), EstadoTurno.CONFIRMADO);

		assertThat(pendientes(tenants.a())).containsExactly(programado.getId(), confirmado.getId());
	}

	@Test
	void turnoWithGeneradoOrEnviadoReminderIsExcluded() {
		Turno conGenerado = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		Turno conEnviado = turno(tenants.a(), a, EN_RANGO.plusSeconds(3600), EstadoTurno.PROGRAMADO);
		Turno sinNada = turno(tenants.a(), a, EN_RANGO.plusSeconds(7200), EstadoTurno.PROGRAMADO);
		recordatorio(tenants.a(), conGenerado, EstadoRecordatorio.GENERADO, GENERADO_EN);
		recordatorio(tenants.a(), conEnviado, EstadoRecordatorio.ENVIADO, GENERADO_EN);

		assertThat(pendientes(tenants.a())).containsExactly(sinNada.getId());
	}

	@Test
	void turnoWithOnlyErrorReminderIsIncluded() {
		Turno conError = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		recordatorio(tenants.a(), conError, EstadoRecordatorio.ERROR, GENERADO_EN);

		assertThat(pendientes(tenants.a())).containsExactly(conError.getId());
	}

	@Test
	void turnoWithErrorAndLaterGeneradoIsExcluded() {
		Turno t = turno(tenants.a(), a, EN_RANGO, EstadoTurno.CONFIRMADO);
		recordatorio(tenants.a(), t, EstadoRecordatorio.ERROR, GENERADO_EN);
		recordatorio(tenants.a(), t, EstadoRecordatorio.GENERADO, GENERADO_EN.plusSeconds(60));

		assertThat(pendientes(tenants.a())).isEmpty();
	}

	@Test
	void nonRecordableStatesAreExcluded() {
		turno(tenants.a(), a, EN_RANGO, EstadoTurno.CANCELADO);
		turno(tenants.a(), a, EN_RANGO.plusSeconds(3600), EstadoTurno.ASISTIO);
		turno(tenants.a(), a, EN_RANGO.plusSeconds(7200), EstadoTurno.AUSENTE);

		assertThat(pendientes(tenants.a())).isEmpty();
	}

	@Test
	void rangeIsClosedOnDesdeAndOpenOnHasta() {
		Turno enDesde = turno(tenants.a(), a, DESDE, EstadoTurno.PROGRAMADO);
		Turno ultimoSegundo = turno(tenants.a(), a, HASTA.minusSeconds(1), EstadoTurno.PROGRAMADO);
		turno(tenants.a(), a, HASTA, EstadoTurno.PROGRAMADO);
		turno(tenants.a(), a, DESDE.minusSeconds(1), EstadoTurno.PROGRAMADO);

		assertThat(pendientes(tenants.a())).containsExactly(enDesde.getId(), ultimoSegundo.getId());
	}

	@Test
	void resultsAreOrderedByInicioThenId() {
		Turno tarde = turno(tenants.a(), a, EN_RANGO.plusSeconds(7200), EstadoTurno.PROGRAMADO);
		Turno primeroMismaHora = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		Turno segundoMismaHora = turno(tenants.a(), a, EN_RANGO, EstadoTurno.CONFIRMADO);

		assertThat(pendientes(tenants.a())).containsExactly(primeroMismaHora.getId(), segundoMismaHora.getId(),
				tarde.getId());
	}

	@Test
	void pacienteAndProfesionalAreInitializedAfterTransactionCloses() {
		turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);

		List<Turno> result = fixtures.inTenant(tenants.a(),
				() -> recordatorios.buscarPendientes(RECORDABLES, DESDE, HASTA));

		assertThat(result).hasSize(1);
		Turno t = result.get(0);
		assertThat(Hibernate.isInitialized(t.getPaciente())).isTrue();
		assertThat(Hibernate.isInitialized(t.getProfesional())).isTrue();
		assertThat(t.getPaciente().getId()).isEqualTo(a.paciente().getId());
		assertThat(t.getProfesional().getId()).isEqualTo(a.profesional().getId());
	}

	@Test
	void tenantOnlySeesItsOwnTurnos() {
		Turno deA = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		Turno deB = turno(tenants.b(), b, EN_RANGO, EstadoTurno.PROGRAMADO);

		assertThat(pendientes(tenants.a())).containsExactly(deA.getId());
		assertThat(pendientes(tenants.b())).containsExactly(deB.getId());
	}

	@Test
	void generadoReminderOfOtherTenantDoesNotHideTurnosOfA() {
		Turno deA = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		Turno deB = turno(tenants.b(), b, EN_RANGO, EstadoTurno.PROGRAMADO);
		recordatorio(tenants.b(), deB, EstadoRecordatorio.GENERADO, GENERADO_EN);

		assertThat(pendientes(tenants.a())).containsExactly(deA.getId());
		assertThat(pendientes(tenants.b())).isEmpty();
	}

	// --- buscarPorTurnos (task 2.2): ultimo recordatorio elegido en memoria por el servicio ---

	private List<Long> idsPorTurnos(Long tenant, Long... turnoIds) {
		return fixtures.inTenant(tenant, () -> recordatorios.buscarPorTurnos(List.of(turnoIds)).stream()
				.map(Recordatorio::getId).toList());
	}

	@Test
	void buscarPorTurnosReturnsLatestGeneradoEnFirst() {
		Turno t = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		Recordatorio viejo = recordatorio(tenants.a(), t, EstadoRecordatorio.ERROR, GENERADO_EN);
		Recordatorio nuevo = recordatorio(tenants.a(), t, EstadoRecordatorio.GENERADO, GENERADO_EN.plusSeconds(60));
		Recordatorio medio = recordatorio(tenants.a(), t, EstadoRecordatorio.ERROR, GENERADO_EN.plusSeconds(30));

		assertThat(idsPorTurnos(tenants.a(), t.getId())).containsExactly(nuevo.getId(), medio.getId(),
				viejo.getId());
	}

	@Test
	void buscarPorTurnosBreaksGeneradoEnTieByIdDescending() {
		Turno t = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		Recordatorio primero = recordatorio(tenants.a(), t, EstadoRecordatorio.ERROR, GENERADO_EN);
		Recordatorio segundo = recordatorio(tenants.a(), t, EstadoRecordatorio.ENVIADO, GENERADO_EN);

		assertThat(idsPorTurnos(tenants.a(), t.getId())).containsExactly(segundo.getId(), primero.getId());
	}

	@Test
	void buscarPorTurnosOmitsTurnosWithoutReminderAndOthersNotRequested() {
		Turno conRecordatorio = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		Turno sinRecordatorio = turno(tenants.a(), a, EN_RANGO.plusSeconds(3600), EstadoTurno.PROGRAMADO);
		Turno noPedido = turno(tenants.a(), a, EN_RANGO.plusSeconds(7200), EstadoTurno.PROGRAMADO);
		Recordatorio r = recordatorio(tenants.a(), conRecordatorio, EstadoRecordatorio.GENERADO, GENERADO_EN);
		recordatorio(tenants.a(), noPedido, EstadoRecordatorio.GENERADO, GENERADO_EN);

		List<Recordatorio> result = fixtures.inTenant(tenants.a(), () -> recordatorios
				.buscarPorTurnos(List.of(conRecordatorio.getId(), sinRecordatorio.getId())));

		assertThat(result).extracting(Recordatorio::getId).containsExactly(r.getId());
		assertThat(result.get(0).getTurno().getId()).isEqualTo(conRecordatorio.getId());
	}

	@Test
	void buscarPorTurnosDoesNotReturnRemindersOfOtherTenant() {
		Turno deA = turno(tenants.a(), a, EN_RANGO, EstadoTurno.PROGRAMADO);
		Turno deB = turno(tenants.b(), b, EN_RANGO, EstadoTurno.PROGRAMADO);
		Recordatorio rA = recordatorio(tenants.a(), deA, EstadoRecordatorio.GENERADO, GENERADO_EN);
		Recordatorio rB = recordatorio(tenants.b(), deB, EstadoRecordatorio.GENERADO, GENERADO_EN);

		assertThat(idsPorTurnos(tenants.a(), deA.getId(), deB.getId())).containsExactly(rA.getId());
		assertThat(idsPorTurnos(tenants.b(), deA.getId(), deB.getId())).containsExactly(rB.getId());
	}
}
