package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.paciente.ConsentimientoDatos;
import ar.global.odonto.paciente.ConsentimientoDatosRepository;
import ar.global.odonto.paciente.ConsentimientoTexto;
import ar.global.odonto.paciente.ConsentimientoTextoRepository;
import ar.global.odonto.paciente.NotaClinica;
import ar.global.odonto.paciente.NotaClinicaRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

/** Consultas de lectura nuevas de C-08 (design D12), con aislamiento A/B; H2 MODE=MySQL con Flyway real. */
@PersistenceTest
class FichaRepositoriesTest {

	private static final Instant AHORA = Instant.parse("2026-11-24T12:00:00Z");

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private PacienteRepository pacientes;

	@Autowired
	private UsuarioRepository usuarios;

	@Autowired
	private ProfesionalRepository profesionales;

	@Autowired
	private ConsentimientoDatosRepository consentimientos;

	@Autowired
	private ConsentimientoTextoRepository textos;

	@Autowired
	private NotaClinicaRepository notas;

	@Autowired
	private ProfesionalVinculadoRepository vinculados;

	@Autowired
	private JdbcTemplate jdbc;

	private Tenants tenants;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
		jdbc.update("DELETE FROM consentimiento_texto WHERE version LIKE 'test-%'");
	}

	private Paciente paciente(Long tenant, String dni) {
		return fixtures.inTenant(tenant, () -> pacientes.save(new Paciente("Ana", "Perez", dni)));
	}

	private Usuario usuario(Long tenant, String email) {
		return fixtures.inTenant(tenant, () -> usuarios.save(new Usuario(email, "h", "U", Rol.PROFESIONAL)));
	}

	private Profesional profesional(Long tenant, Usuario usuario, boolean activo) {
		return fixtures.inTenant(tenant, () -> {
			Profesional p = new Profesional("Prof", "Uno");
			p.setUsuario(usuarios.getReferenceById(usuario.getId()));
			p.setActivo(activo);
			return profesionales.save(p);
		});
	}

	private void consentimiento(Long tenant, Paciente p, Usuario u, Instant aceptadoEn) {
		fixtures.inTenant(tenant, () -> consentimientos.save(new ConsentimientoDatos(
				pacientes.getReferenceById(p.getId()), "v1", aceptadoEn, usuarios.getReferenceById(u.getId()))));
	}

	private void texto(String version, Instant vigenteDesde) {
		jdbc.update("INSERT INTO consentimiento_texto (version, contenido, vigente_desde) VALUES (?, ?, ?)", version,
				"Texto " + version, LocalDateTime.ofInstant(vigenteDesde, ZoneOffset.UTC));
	}

	// --- 2.1 ConsentimientoDatos -----------------------------------------------------------------

	@Test
	void existsByPacienteIdIsFalseWithoutConsentAndTrueWithOne() {
		Paciente p = paciente(tenants.a(), "1");
		Paciente otro = paciente(tenants.a(), "2");
		Usuario u = usuario(tenants.a(), "u@a.test");

		assertThat(fixtures.inTenant(tenants.a(), () -> consentimientos.existsByPacienteId(p.getId()))).isFalse();
		consentimiento(tenants.a(), p, u, AHORA);

		assertThat(fixtures.inTenant(tenants.a(), () -> consentimientos.existsByPacienteId(p.getId()))).isTrue();
		assertThat(fixtures.inTenant(tenants.a(), () -> consentimientos.existsByPacienteId(otro.getId()))).isFalse();
	}

	@Test
	void consentsAreListedMostRecentFirst() {
		Paciente p = paciente(tenants.a(), "1");
		Usuario u = usuario(tenants.a(), "u@a.test");
		consentimiento(tenants.a(), p, u, AHORA.minusSeconds(60));
		consentimiento(tenants.a(), p, u, AHORA);

		List<ConsentimientoDatos> lista = fixtures.inTenant(tenants.a(),
				() -> consentimientos.findByPacienteIdOrderByAceptadoEnDescIdDesc(p.getId()));

		assertThat(lista).extracting(ConsentimientoDatos::getAceptadoEn).containsExactly(AHORA,
				AHORA.minusSeconds(60));
	}

	@Test
	void consentOfAPatientOfBIsInvisibleFromA() {
		Paciente ofB = paciente(tenants.b(), "1");
		consentimiento(tenants.b(), ofB, usuario(tenants.b(), "u@b.test"), AHORA);

		assertThat(fixtures.inTenant(tenants.a(), () -> consentimientos.existsByPacienteId(ofB.getId()))).isFalse();
		assertThat(fixtures.inTenant(tenants.a(),
				() -> consentimientos.findByPacienteIdOrderByAceptadoEnDescIdDesc(ofB.getId()))).isEmpty();
	}

	// --- 2.2 ConsentimientoTexto -----------------------------------------------------------------

	@Test
	void currentTextIsV1WhenTheOtherVersionIsInTheFuture() {
		texto("test-futuro", AHORA.plusSeconds(3600));

		assertThat(fixtures.inTenant(tenants.a(),
				() -> textos.findFirstByVigenteDesdeLessThanEqualOrderByVigenteDesdeDescVersionDesc(AHORA)))
				.map(ConsentimientoTexto::getVersion).contains("v1");
	}

	@Test
	void currentTextIsTheLatestAlreadyInForce() {
		texto("test-nuevo", AHORA.minusSeconds(3600));
		texto("test-futuro", AHORA.plusSeconds(3600));

		assertThat(fixtures.inTenant(tenants.a(),
				() -> textos.findFirstByVigenteDesdeLessThanEqualOrderByVigenteDesdeDescVersionDesc(AHORA)))
				.map(ConsentimientoTexto::getVersion).contains("test-nuevo");
	}

	// --- 2.3 NotaClinica -------------------------------------------------------------------------

	@Test
	void notesArePagedNewestFirstAndOnlyForThePatient() {
		Paciente p = paciente(tenants.a(), "1");
		Paciente otro = paciente(tenants.a(), "2");
		Profesional prof = profesional(tenants.a(), usuario(tenants.a(), "u@a.test"), true);
		for (int i = 0; i < 3; i++) {
			Instant fecha = AHORA.plusSeconds(i);
			fixtures.inTenant(tenants.a(), () -> notas.save(new NotaClinica(pacientes.getReferenceById(p.getId()),
					profesionales.getReferenceById(prof.getId()), fecha, "n")));
		}
		fixtures.inTenant(tenants.a(), () -> notas.save(new NotaClinica(pacientes.getReferenceById(otro.getId()),
				profesionales.getReferenceById(prof.getId()), AHORA.plusSeconds(99), "otra")));

		Page<NotaClinica> pagina = fixtures.inTenant(tenants.a(),
				() -> notas.findByPacienteId(p.getId(), PageRequest.of(0, 2, NotaService.ORDEN)));

		assertThat(pagina.getTotalElements()).isEqualTo(3);
		assertThat(pagina.getContent()).extracting(NotaClinica::getFecha).containsExactly(AHORA.plusSeconds(2),
				AHORA.plusSeconds(1));
	}

	@Test
	void notesOfBAreInvisibleFromA() {
		Paciente ofB = paciente(tenants.b(), "1");
		Profesional prof = profesional(tenants.b(), usuario(tenants.b(), "u@b.test"), true);
		fixtures.inTenant(tenants.b(), () -> notas.save(new NotaClinica(pacientes.getReferenceById(ofB.getId()),
				profesionales.getReferenceById(prof.getId()), AHORA, "n")));

		assertThat(fixtures.inTenant(tenants.a(),
				() -> notas.findByPacienteId(ofB.getId(), PageRequest.of(0, 20)).getTotalElements())).isZero();
	}

	// --- 2.4 ProfesionalVinculadoRepository ------------------------------------------------------

	@Test
	void linkedActiveProfessionalIsFoundAndInactiveOneIsExcluded() {
		Usuario u = usuario(tenants.a(), "u@a.test");
		Usuario conInactivo = usuario(tenants.a(), "i@a.test");
		Profesional activo = profesional(tenants.a(), u, true);
		profesional(tenants.a(), conInactivo, false);

		assertThat(fixtures.inTenant(tenants.a(), () -> vinculados.findByUsuarioIdAndActivoTrue(u.getId())))
				.extracting(Profesional::getId).containsExactly(activo.getId());
		assertThat(fixtures.inTenant(tenants.a(),
				() -> vinculados.findByUsuarioIdAndActivoTrue(conInactivo.getId()))).isEmpty();
	}

	@Test
	void professionalOfBIsNotFoundFromA() {
		Usuario ofB = usuario(tenants.b(), "u@b.test");
		profesional(tenants.b(), ofB, true);

		assertThat(fixtures.inTenant(tenants.a(), () -> vinculados.findByUsuarioIdAndActivoTrue(ofB.getId())))
				.isEmpty();
	}
}
