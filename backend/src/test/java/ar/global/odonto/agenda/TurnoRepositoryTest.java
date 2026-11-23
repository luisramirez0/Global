package ar.global.odonto.agenda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.Instant;
import java.util.TimeZone;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

@PersistenceTest
class TurnoRepositoryTest {

	private static final Instant INICIO = Instant.parse("2026-11-24T12:00:00Z");
	private static final Instant FIN = Instant.parse("2026-11-24T12:30:00Z");

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

	@Autowired
	private JdbcTemplate jdbc;

	private final TimeZone originalZone = TimeZone.getDefault();

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
		TimeZone.setDefault(originalZone);
		fixtures.cleanAll();
	}

	private Turno newTurno(Long tenant, Graph g) {
		return fixtures.inTenant(tenant, () -> turnos.save(new Turno(pacientes.getReferenceById(g.paciente().getId()),
				profesionales.getReferenceById(g.profesional().getId()),
				sillones.getReferenceById(g.sillon().getId()),
				prestaciones.getReferenceById(g.prestacion().getId()), INICIO, FIN)));
	}

	@Test
	void turnoIsSavedAsProgramadoStoredAsText() {
		Turno saved = newTurno(tenants.a(), a);

		String estado = jdbc.queryForObject("SELECT estado FROM turno WHERE id = ?", String.class, saved.getId());

		assertThat(saved.getConsultorioId()).isEqualTo(tenants.a());
		assertThat(saved.getEstado()).isEqualTo(EstadoTurno.PROGRAMADO);
		assertThat(estado).isEqualTo("PROGRAMADO");
		assertThat(saved.isEsSobreturno()).isFalse();
	}

	@Test
	void instantRoundTripsWithAnotherJvmTimeZone() {
		TimeZone.setDefault(TimeZone.getTimeZone("America/Argentina/Buenos_Aires"));
		Turno saved = newTurno(tenants.a(), a);

		Turno read = fixtures.inTenant(tenants.a(), () -> turnos.findById(saved.getId()).orElseThrow());

		assertThat(read.getInicio()).isEqualTo(Instant.parse("2026-11-24T12:00:00Z"));
		assertThat(read.getFin()).isEqualTo(Instant.parse("2026-11-24T12:30:00Z"));
		String raw = jdbc.queryForObject("SELECT FORMATDATETIME(inicio, 'yyyy-MM-dd HH:mm:ss') FROM turno WHERE id = ?",
				String.class, saved.getId());
		assertThat(raw).isEqualTo("2026-11-24 12:00:00");
	}

	@Test
	void instantRoundTripsWithAPositiveOffsetJvmTimeZone() {
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
		Turno saved = newTurno(tenants.a(), a);

		Turno read = fixtures.inTenant(tenants.a(), () -> turnos.findById(saved.getId()).orElseThrow());

		assertThat(read.getInicio()).isEqualTo(INICIO);
	}

	@Test
	void turnoOfAWithRelatedRecordsOfBIsRejected() {
		Paciente pacienteOfB = b.paciente();

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> turnos.saveAndFlush(new Turno(pacientes.getReferenceById(pacienteOfB.getId()),
						profesionales.getReferenceById(a.profesional().getId()),
						sillones.getReferenceById(a.sillon().getId()),
						prestaciones.getReferenceById(a.prestacion().getId()), INICIO, FIN))))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> turnos.saveAndFlush(new Turno(pacientes.getReferenceById(a.paciente().getId()),
						profesionales.getReferenceById(b.profesional().getId()),
						sillones.getReferenceById(a.sillon().getId()),
						prestaciones.getReferenceById(a.prestacion().getId()), INICIO, FIN))))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> turnos.saveAndFlush(new Turno(pacientes.getReferenceById(a.paciente().getId()),
						profesionales.getReferenceById(a.profesional().getId()),
						sillones.getReferenceById(b.sillon().getId()),
						prestaciones.getReferenceById(a.prestacion().getId()), INICIO, FIN))))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> turnos.saveAndFlush(new Turno(pacientes.getReferenceById(a.paciente().getId()),
						profesionales.getReferenceById(a.profesional().getId()),
						sillones.getReferenceById(a.sillon().getId()),
						prestaciones.getReferenceById(b.prestacion().getId()), INICIO, FIN))))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void turnoIsolationBetweenTenants() {
		fixtures.inTenant(tenants.a(), () -> {
			assertThat(turnos.findAll()).extracting(Turno::getId).containsExactly(a.turno().getId());
			assertThat(turnos.findById(b.turno().getId())).isEmpty();
			return null;
		});
	}

	@Test
	void physicallyDeletingAPatientWithTurnosFails() {
		Long pacienteId = a.paciente().getId();

		assertThatThrownBy(() -> jdbc.update("DELETE FROM paciente WHERE id = ?", pacienteId))
				.isInstanceOf(DataIntegrityViolationException.class);

		assertThat(fixtures.inTenant(tenants.a(), () -> pacientes.findById(pacienteId))).isPresent();
	}

	@Test
	void concurrentEditWithStaleVersionFails() {
		Long id = a.turno().getId();
		Turno firstReader = fixtures.inTenant(tenants.a(), () -> turnos.findById(id).orElseThrow());
		Turno secondReader = fixtures.inTenant(tenants.a(), () -> turnos.findById(id).orElseThrow());

		firstReader.setNotas("primera edicion");
		fixtures.inTenant(tenants.a(), () -> turnos.save(firstReader));
		secondReader.setNotas("edicion con version vieja");

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(), () -> turnos.saveAndFlush(secondReader)))
				.isInstanceOf(OptimisticLockingFailureException.class);
		assertThat(fixtures.inTenant(tenants.a(), () -> turnos.findById(id).orElseThrow()).getNotas())
				.isEqualTo("primera edicion");
	}
}
