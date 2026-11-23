package ar.global.odonto.agenda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import java.time.Instant;
import java.time.LocalTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

@PersistenceTest
class AgendaConfigRepositoriesTest {

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private SillonRepository sillones;

	@Autowired
	private PrestacionRepository prestaciones;

	@Autowired
	private ProfesionalRepository profesionales;

	@Autowired
	private HorarioAtencionRepository horarios;

	@Autowired
	private BloqueoAgendaRepository bloqueos;

	@Autowired
	private UsuarioRepository usuarios;

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

	// --- Sillon ---------------------------------------------------------------------------------

	@Test
	void sillonIsAssignedToTheCurrentTenantAndIsActiveByDefault() {
		Sillon saved = fixtures.inTenant(tenants.a(), () -> sillones.save(new Sillon("Sillon 1")));

		assertThat(saved.getConsultorioId()).isEqualTo(tenants.a());
		assertThat(saved.isActivo()).isTrue();
	}

	@Test
	void sillonIsolationBetweenTenants() {
		Sillon ofA = fixtures.inTenant(tenants.a(), () -> sillones.save(new Sillon("A1")));
		Sillon ofB = fixtures.inTenant(tenants.b(), () -> sillones.save(new Sillon("B1")));

		fixtures.inTenant(tenants.a(), () -> {
			assertThat(sillones.findAll()).extracting(Sillon::getId).containsExactly(ofA.getId());
			assertThat(sillones.findById(ofB.getId())).isEmpty();
			return null;
		});
		fixtures.inTenant(tenants.b(), () -> {
			assertThat(sillones.findAll()).extracting(Sillon::getId).containsExactly(ofB.getId());
			assertThat(sillones.findById(ofA.getId())).isEmpty();
			return null;
		});
	}

	// --- Prestacion -----------------------------------------------------------------------------

	@Test
	void prestacionKeepsItsDurationAndIsolatesByTenant() {
		Prestacion ofA = fixtures.inTenant(tenants.a(), () -> prestaciones.save(new Prestacion("Limpieza", 45)));
		Prestacion ofB = fixtures.inTenant(tenants.b(), () -> prestaciones.save(new Prestacion("Control", 15)));

		fixtures.inTenant(tenants.a(), () -> {
			assertThat(prestaciones.findAll()).extracting(Prestacion::getDuracionMinutos).containsExactly(45);
			assertThat(prestaciones.findById(ofB.getId())).isEmpty();
			assertThat(prestaciones.findById(ofA.getId())).isPresent();
			return null;
		});
		assertThat(ofA.getConsultorioId()).isEqualTo(tenants.a());
	}

	// --- Profesional ----------------------------------------------------------------------------

	@Test
	void profesionalWithOwnUsuarioIsSavedAndIsolated() {
		Profesional ofA = fixtures.inTenant(tenants.a(), () -> {
			Usuario u = usuarios.save(new Usuario("dr@a.test", "h", "Dr", Rol.PROFESIONAL));
			Profesional p = new Profesional("Ana", "Perez");
			p.setUsuario(u);
			return profesionales.save(p);
		});
		Profesional ofB = fixtures.inTenant(tenants.b(), () -> profesionales.save(new Profesional("Beto", "Gomez")));

		assertThat(ofA.getConsultorioId()).isEqualTo(tenants.a());
		fixtures.inTenant(tenants.a(), () -> {
			assertThat(profesionales.findAll()).extracting(Profesional::getId).containsExactly(ofA.getId());
			assertThat(profesionales.findById(ofB.getId())).isEmpty();
			return null;
		});
	}

	@Test
	void profesionalOfAWithUsuarioOfBIsRejectedByTheDatabase() {
		Usuario userOfB = fixtures.inTenant(tenants.b(),
				() -> usuarios.save(new Usuario("dr@b.test", "h", "Dr", Rol.PROFESIONAL)));

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(), () -> {
			Profesional p = new Profesional("Ana", "Perez");
			p.setUsuario(usuarios.getReferenceById(userOfB.getId()));
			return profesionales.saveAndFlush(p);
		})).isInstanceOf(DataIntegrityViolationException.class);

		assertThat(fixtures.inTenant(tenants.a(), () -> profesionales.findAll())).isEmpty();
	}

	// --- HorarioAtencion ------------------------------------------------------------------------

	@Test
	void horarioKeepsDayAndTimesAsStored() {
		HorarioAtencion saved = fixtures.inTenant(tenants.a(), () -> {
			Profesional p = profesionales.save(new Profesional("Ana", "Perez"));
			return horarios.save(new HorarioAtencion(p, 3, LocalTime.of(8, 30), LocalTime.of(12, 45)));
		});

		HorarioAtencion read = fixtures.inTenant(tenants.a(), () -> horarios.findById(saved.getId()).orElseThrow());

		assertThat(read.getConsultorioId()).isEqualTo(tenants.a());
		assertThat(read.getDiaSemana()).isEqualTo(3);
		assertThat(read.getHoraDesde()).isEqualTo(LocalTime.of(8, 30));
		assertThat(read.getHoraHasta()).isEqualTo(LocalTime.of(12, 45));
	}

	@Test
	void horarioIsolationBetweenTenants() {
		HorarioAtencion ofB = fixtures.inTenant(tenants.b(), () -> {
			Profesional p = profesionales.save(new Profesional("Beto", "Gomez"));
			return horarios.save(new HorarioAtencion(p, 1, LocalTime.of(9, 0), LocalTime.of(13, 0)));
		});

		fixtures.inTenant(tenants.a(), () -> {
			assertThat(horarios.findAll()).isEmpty();
			assertThat(horarios.findById(ofB.getId())).isEmpty();
			return null;
		});
	}

	// --- BloqueoAgenda --------------------------------------------------------------------------

	@Test
	void bloqueoKeepsInstantsAndIsolatesByTenant() {
		Instant inicio = Instant.parse("2026-12-01T12:00:00Z");
		Instant fin = Instant.parse("2026-12-01T15:30:00Z");
		BloqueoAgenda saved = fixtures.inTenant(tenants.a(), () -> {
			Sillon s = sillones.save(new Sillon("S1"));
			BloqueoAgenda b = new BloqueoAgenda(inicio, fin);
			b.setSillon(s);
			b.setMotivo("Mantenimiento");
			return bloqueos.save(b);
		});

		fixtures.inTenant(tenants.b(), () -> {
			assertThat(bloqueos.findAll()).isEmpty();
			assertThat(bloqueos.findById(saved.getId())).isEmpty();
			return null;
		});
		BloqueoAgenda read = fixtures.inTenant(tenants.a(), () -> bloqueos.findById(saved.getId()).orElseThrow());
		assertThat(read.getInicio()).isEqualTo(inicio);
		assertThat(read.getFin()).isEqualTo(fin);
		assertThat(read.getMotivo()).isEqualTo("Mantenimiento");
	}

	@Test
	void bloqueoOfAWithSillonOfBIsRejectedByTheDatabase() {
		Sillon sillonOfB = fixtures.inTenant(tenants.b(), () -> sillones.save(new Sillon("B1")));

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(), () -> {
			BloqueoAgenda b = new BloqueoAgenda(Instant.parse("2026-12-01T12:00:00Z"),
					Instant.parse("2026-12-01T13:00:00Z"));
			b.setSillon(sillones.getReferenceById(sillonOfB.getId()));
			return bloqueos.saveAndFlush(b);
		})).isInstanceOf(DataIntegrityViolationException.class);

		assertThat(fixtures.inTenant(tenants.a(), () -> bloqueos.findAll())).isEmpty();
	}
}
