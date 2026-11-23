package ar.global.odonto.common.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.BloqueoAgendaRepository;
import ar.global.odonto.agenda.HorarioAtencionRepository;
import ar.global.odonto.agenda.PrestacionRepository;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.auditoria.AuditLogRepository;
import ar.global.odonto.common.persistence.AbstractEntity;
import ar.global.odonto.paciente.ConsentimientoDatosRepository;
import ar.global.odonto.paciente.FichaClinicaRepository;
import ar.global.odonto.paciente.NotaClinicaRepository;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.recordatorio.RecordatorioRepository;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.usuario.UsuarioRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;

/** Regla 2: el aislamiento por consultorio se prueba sobre TODOS los repositorios tenant-scoped. */
@PersistenceTest
class TenantIsolationSuiteTest {

	private record Case(Supplier<List<? extends AbstractEntity>> findAll,
			Function<Long, Optional<? extends AbstractEntity>> findById, Function<Graph, Long> idInGraph) {
	}

	private static final List<String> ENTITIES = List.of("usuario", "profesional", "sillon", "prestacion",
			"horario", "bloqueo", "paciente", "ficha", "nota", "consentimiento", "turno", "recordatorio",
			"auditoria");

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private UsuarioRepository usuarios;
	@Autowired
	private ProfesionalRepository profesionales;
	@Autowired
	private SillonRepository sillones;
	@Autowired
	private PrestacionRepository prestaciones;
	@Autowired
	private HorarioAtencionRepository horarios;
	@Autowired
	private BloqueoAgendaRepository bloqueos;
	@Autowired
	private PacienteRepository pacientes;
	@Autowired
	private FichaClinicaRepository fichas;
	@Autowired
	private NotaClinicaRepository notas;
	@Autowired
	private ConsentimientoDatosRepository consentimientos;
	@Autowired
	private TurnoRepository turnos;
	@Autowired
	private RecordatorioRepository recordatorios;
	@Autowired
	private AuditLogRepository auditLogs;

	private final Map<String, Case> cases = new LinkedHashMap<>();
	private Tenants tenants;
	private Graph a;
	private Graph b;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
		cases.put("usuario", jpa(usuarios, Graph::usuario));
		cases.put("profesional", jpa(profesionales, Graph::profesional));
		cases.put("sillon", jpa(sillones, Graph::sillon));
		cases.put("prestacion", jpa(prestaciones, Graph::prestacion));
		cases.put("horario", jpa(horarios, Graph::horario));
		cases.put("bloqueo", jpa(bloqueos, Graph::bloqueo));
		cases.put("paciente", jpa(pacientes, Graph::paciente));
		cases.put("ficha", jpa(fichas, Graph::ficha));
		cases.put("nota", jpa(notas, Graph::nota));
		cases.put("consentimiento", jpa(consentimientos, Graph::consentimiento));
		cases.put("turno", jpa(turnos, Graph::turno));
		cases.put("recordatorio", jpa(recordatorios, Graph::recordatorio));
		cases.put("auditoria", new Case(() -> auditLogs.findAll(PageRequest.of(0, 100)).getContent(),
				auditLogs::findById, g -> g.audit().getId()));
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	private static <T extends AbstractEntity> Case jpa(JpaRepository<T, Long> repo, Function<Graph, T> pick) {
		return new Case(repo::findAll, repo::findById, g -> pick.apply(g).getId());
	}

	@ParameterizedTest
	@ValueSource(strings = { "usuario", "profesional", "sillon", "prestacion", "horario", "bloqueo", "paciente",
			"ficha", "nota", "consentimiento", "turno", "recordatorio", "auditoria" })
	void tenantANeverSeesRowsOfTenantB(String entity) {
		Case c = cases.get(entity);
		Long idOfA = c.idInGraph().apply(a);
		Long idOfB = c.idInGraph().apply(b);

		List<Long> listedByA = fixtures.inTenant(tenants.a(), () -> c.findAll().get()).stream()
				.map(AbstractEntity::getId).toList();
		List<Long> listedByB = fixtures.inTenant(tenants.b(), () -> c.findAll().get()).stream()
				.map(AbstractEntity::getId).toList();

		assertThat(listedByA).as(entity + " findAll de A").containsExactly(idOfA);
		assertThat(listedByB).as(entity + " findAll de B").containsExactly(idOfB);
		assertThat(fixtures.inTenant(tenants.a(), () -> c.findById().apply(idOfB))).as(entity + " findById cruzado A->B")
				.isEmpty();
		assertThat(fixtures.inTenant(tenants.b(), () -> c.findById().apply(idOfA))).as(entity + " findById cruzado B->A")
				.isEmpty();
		assertThat(fixtures.inTenant(tenants.a(), () -> c.findById().apply(idOfA))).as(entity + " findById propio")
				.isPresent();
	}

	@ParameterizedTest
	@ValueSource(strings = { "usuario", "profesional", "sillon", "prestacion", "horario", "bloqueo", "paciente",
			"ficha", "nota", "consentimiento", "turno", "recordatorio", "auditoria" })
	void withoutTenantEveryRepositoryFailsClosed(String entity) {
		Case c = cases.get(entity);
		Long idOfA = c.idInGraph().apply(a);

		assertThatThrownBy(() -> c.findAll().get()).as(entity + " findAll")
				.hasRootCauseInstanceOf(TenantNotSetException.class);
		assertThatThrownBy(() -> c.findById().apply(idOfA)).as(entity + " findById")
				.hasRootCauseInstanceOf(TenantNotSetException.class);
	}

	@org.junit.jupiter.api.Test
	void theSuiteCoversAllThirteenTenantScopedEntities() {
		assertThat(cases.keySet()).containsExactlyInAnyOrderElementsOf(ENTITIES);
	}
}
