package ar.global.odonto.paciente;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

@PersistenceTest
class ClinicalRepositoriesTest {

	private static final Instant NOW = Instant.parse("2026-12-02T12:00:00Z");

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private PacienteRepository pacientes;

	@Autowired
	private FichaClinicaRepository fichas;

	@Autowired
	private NotaClinicaRepository notas;

	@Autowired
	private ConsentimientoDatosRepository consentimientos;

	@Autowired
	private ConsentimientoTextoRepository textos;

	@Autowired
	private ProfesionalRepository profesionales;

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

	private Paciente paciente(Long tenant, String dni) {
		return fixtures.inTenant(tenant, () -> pacientes.save(new Paciente("Ana", "Perez", dni)));
	}

	private Usuario usuario(Long tenant, String email) {
		return fixtures.inTenant(tenant, () -> usuarios.save(new Usuario(email, "h", "U", Rol.ADMIN)));
	}

	// --- FichaClinica ---------------------------------------------------------------------------

	@Test
	void fichaIsSavedWithTenantAndIsolatedFromOtherConsultorios() {
		Paciente p = paciente(tenants.a(), "1");
		FichaClinica ficha = fixtures.inTenant(tenants.a(), () -> {
			FichaClinica f = new FichaClinica(pacientes.getReferenceById(p.getId()));
			f.setAlergias("Penicilina");
			return fichas.save(f);
		});

		assertThat(ficha.getConsultorioId()).isEqualTo(tenants.a());
		assertThat(fixtures.inTenant(tenants.b(), () -> fichas.findAll())).isEmpty();
		assertThat(fixtures.inTenant(tenants.b(), () -> fichas.findById(ficha.getId()))).isEmpty();
		assertThat(fixtures.inTenant(tenants.a(), () -> fichas.findByPacienteId(p.getId())).orElseThrow()
				.getAlergias()).isEqualTo("Penicilina");
	}

	@Test
	void aSecondFichaForTheSamePatientFails() {
		Paciente p = paciente(tenants.a(), "1");
		fixtures.inTenant(tenants.a(), () -> fichas.save(new FichaClinica(pacientes.getReferenceById(p.getId()))));

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> fichas.saveAndFlush(new FichaClinica(pacientes.getReferenceById(p.getId())))))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void longClinicalTextIsStoredAndReadCompletely() {
		String longText = "a".repeat(5000) + "FIN";
		Paciente p = paciente(tenants.a(), "1");
		FichaClinica saved = fixtures.inTenant(tenants.a(), () -> {
			FichaClinica f = new FichaClinica(pacientes.getReferenceById(p.getId()));
			f.setObservaciones(longText);
			f.setAlergias(longText + "2");
			return fichas.save(f);
		});

		FichaClinica read = fixtures.inTenant(tenants.a(), () -> fichas.findById(saved.getId()).orElseThrow());

		assertThat(read.getObservaciones()).hasSize(5003).endsWith("FIN");
		assertThat(read.getAlergias()).hasSize(5004).endsWith("FIN2");
	}

	@Test
	void fichaOfAWithPacienteOfBIsRejectedByTheDatabase() {
		Paciente ofB = paciente(tenants.b(), "2");

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> fichas.saveAndFlush(new FichaClinica(pacientes.getReferenceById(ofB.getId())))))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void fichaToStringDoesNotPrintClinicalContent() {
		Paciente p = paciente(tenants.a(), "1");
		FichaClinica saved = fixtures.inTenant(tenants.a(), () -> {
			FichaClinica f = new FichaClinica(pacientes.getReferenceById(p.getId()));
			f.setAlergias("Penicilina");
			return fichas.save(f);
		});

		assertThat(saved.toString()).contains(String.valueOf(saved.getId())).doesNotContain("Penicilina");
	}

	// --- NotaClinica ----------------------------------------------------------------------------

	@Test
	void notaIsSavedIsolatedAndItsToStringHidesTheText() {
		Paciente p = paciente(tenants.a(), "1");
		Profesional prof = fixtures.inTenant(tenants.a(), () -> profesionales.save(new Profesional("Dr", "X")));
		NotaClinica nota = fixtures.inTenant(tenants.a(),
				() -> notas.save(new NotaClinica(pacientes.getReferenceById(p.getId()),
						profesionales.getReferenceById(prof.getId()), NOW, "Caries en pieza 16")));

		assertThat(nota.getConsultorioId()).isEqualTo(tenants.a());
		assertThat(fixtures.inTenant(tenants.b(), () -> notas.findAll())).isEmpty();
		assertThat(fixtures.inTenant(tenants.b(), () -> notas.findById(nota.getId()))).isEmpty();
		assertThat(fixtures.inTenant(tenants.a(), () -> notas.findById(nota.getId())).orElseThrow().getTexto())
				.isEqualTo("Caries en pieza 16");
		assertThat(nota.toString()).doesNotContain("Caries");
	}

	// --- Consentimiento -------------------------------------------------------------------------

	@Test
	void consentTextV1IsReadableAndImmutable() {
		// El catalogo es global, pero abrir la sesion exige tenant (fail closed): se lee dentro de un consultorio.
		ConsentimientoTexto v1 = fixtures.inTenant(tenants.a(), () -> textos.findById("v1").orElseThrow());

		assertThat(v1.getContenido()).isNotBlank();
		assertThat(fixtures.inTenant(tenants.b(), () -> textos.findAll())).extracting(ConsentimientoTexto::getVersion)
				.contains("v1");
	}

	@Test
	void consentimientoIsSavedAndIsolated() {
		Paciente p = paciente(tenants.a(), "1");
		Usuario u = usuario(tenants.a(), "u@a.test");
		ConsentimientoDatos c = fixtures.inTenant(tenants.a(),
				() -> consentimientos.save(new ConsentimientoDatos(pacientes.getReferenceById(p.getId()), "v1", NOW,
						usuarios.getReferenceById(u.getId()))));

		assertThat(c.getConsultorioId()).isEqualTo(tenants.a());
		assertThat(fixtures.inTenant(tenants.b(), () -> consentimientos.findAll())).isEmpty();
		assertThat(fixtures.inTenant(tenants.b(), () -> consentimientos.findById(c.getId()))).isEmpty();
	}

	@Test
	void consentimientoWithUnknownTextVersionIsRejected() {
		Paciente p = paciente(tenants.a(), "1");
		Usuario u = usuario(tenants.a(), "u@a.test");

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> consentimientos.saveAndFlush(new ConsentimientoDatos(pacientes.getReferenceById(p.getId()),
						"v99", NOW, usuarios.getReferenceById(u.getId())))))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void consentimientoOfAWithPacienteOfBIsRejected() {
		Paciente ofB = paciente(tenants.b(), "2");
		Usuario u = usuario(tenants.a(), "u@a.test");

		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(),
				() -> consentimientos.saveAndFlush(new ConsentimientoDatos(pacientes.getReferenceById(ofB.getId()),
						"v1", NOW, usuarios.getReferenceById(u.getId())))))
				.isInstanceOf(DataIntegrityViolationException.class);
	}
}
