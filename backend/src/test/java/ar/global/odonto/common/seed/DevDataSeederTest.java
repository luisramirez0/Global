package ar.global.odonto.common.seed;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.Prestacion;
import ar.global.odonto.agenda.PrestacionRepository;
import ar.global.odonto.agenda.PrestacionSugerida;
import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.config.AppProperties;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.security.PasswordConfig;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

@PersistenceTest
@Import(PasswordConfig.class)
@ExtendWith(OutputCaptureExtension.class)
class DevDataSeederTest {

	private static final String EMAIL = "Admin@Dev.Local";
	private static final String PASSWORD = "una-clave-de-prueba-123";

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private ConsultorioRepository consultorios;

	@Autowired
	private UsuarioRepository usuarios;

	@Autowired
	private SillonRepository sillones;

	@Autowired
	private PrestacionRepository prestaciones;

	@Autowired
	private PasswordEncoder encoder;

	@Autowired
	private TransactionTemplate tx;

	@Autowired
	private JdbcTemplate jdbc;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	private DevDataSeeder seeder(String email, String password) {
		return new DevDataSeeder(new AppProperties("http://x", null, null, new AppProperties.DevAdmin(email, password)),
				consultorios, usuarios, sillones, prestaciones, encoder, tx);
	}

	private int count(String table) {
		return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
	}

	@Test
	void withPasswordItCreatesConsultorioSillonPrestacionesAndHashedAdmin() throws Exception {
		seeder(EMAIL, PASSWORD).run(new DefaultApplicationArguments());

		assertThat(count("consultorio")).isEqualTo(1);
		assertThat(count("sillon")).isEqualTo(1);
		assertThat(count("prestacion")).isEqualTo(4);
		Usuario admin = TenantContext.runAsSystem(() -> usuarios.findByEmail("admin@dev.local").orElseThrow());
		assertThat(admin.getRol()).isEqualTo(Rol.ADMIN);
		assertThat(admin.getPasswordHash()).isNotEqualTo(PASSWORD);
		assertThat(encoder.matches(PASSWORD, admin.getPasswordHash())).isTrue();
		Long consultorioId = admin.getConsultorioId();
		List<Prestacion> seeded = fixtures.inTenant(consultorioId, () -> prestaciones.findAll());
		assertThat(seeded).extracting(Prestacion::getNombre)
				.containsExactlyInAnyOrderElementsOf(PrestacionSugerida.CATALOGO.stream().map(PrestacionSugerida::nombre).toList());
		List<Sillon> sillon = fixtures.inTenant(consultorioId, () -> sillones.findAll());
		assertThat(sillon).hasSize(1);
	}

	@Test
	void aSecondRunDoesNotDuplicateAnything() throws Exception {
		DevDataSeeder seeder = seeder(EMAIL, PASSWORD);

		seeder.run(new DefaultApplicationArguments());
		seeder.run(new DefaultApplicationArguments());

		assertThat(count("consultorio")).isEqualTo(1);
		assertThat(count("usuario")).isEqualTo(1);
		assertThat(count("sillon")).isEqualTo(1);
		assertThat(count("prestacion")).isEqualTo(4);
	}

	@Test
	void withoutPasswordItCreatesNothingAndWarnsWithoutCredentials(CapturedOutput output) throws Exception {
		seeder(EMAIL, "").run(new DefaultApplicationArguments());
		seeder(EMAIL, null).run(new DefaultApplicationArguments());

		assertThat(count("consultorio")).isZero();
		assertThat(count("usuario")).isZero();
		assertThat(output.getAll()).contains("DEV_ADMIN_PASSWORD").doesNotContain("admin@dev.local")
				.doesNotContain("Admin@Dev.Local");
	}

	@Test
	void successfulSeedLogsDoNotContainCredentials(CapturedOutput output) throws Exception {
		seeder(EMAIL, PASSWORD).run(new DefaultApplicationArguments());

		assertThat(output.getAll()).doesNotContain(PASSWORD).doesNotContain("admin@dev.local");
	}

	@Test
	void seederIsOnlyActiveInTheDevProfile() {
		Profile profile = DevDataSeeder.class.getAnnotation(Profile.class);

		assertThat(profile).isNotNull();
		assertThat(profile.value()).containsExactly("dev");
	}
}
