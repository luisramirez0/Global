package ar.global.odonto.consultorio.registro;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.security.PasswordConfig;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Spec authentication "Alta de consultorio y usuario" y "Contraseñas con hash fuerte" (design D5). */
@PersistenceTest
@Import({ RegistroService.class, PasswordConfig.class })
class RegistroServiceTest {

	@Autowired
	private RegistroService registro;

	@Autowired
	private UsuarioRepository usuarios;

	@Autowired
	private ProfesionalRepository profesionales;

	@Autowired
	private SillonRepository sillones;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private JdbcTemplate jdbc;

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void createsConsultorioAdminProfesionalAndSillonInTheNewTenant() {
		RegistroResponse r = registro.registrar(request("Ana@Consultorio.TEST", null));

		assertThat(r.consultorioId()).isNotNull();
		assertThat(r.usuarioId()).isNotNull();
		assertThat(TenantContext.get()).isEmpty();
		assertThat(TenantContext.isSystem()).isFalse();
		fixtures.inTenant(r.consultorioId(), () -> {
			Usuario u = usuarios.findById(r.usuarioId()).orElseThrow();
			assertThat(u.getEmail()).isEqualTo("ana@consultorio.test");
			assertThat(u.getRol()).isEqualTo(Rol.ADMIN);
			assertThat(u.getConsultorioId()).isEqualTo(r.consultorioId());
			assertThat(u.getPasswordHash()).doesNotContain("Segura123!").startsWith("$2a$12$");
			assertThat(passwordEncoder.matches("Segura123!", u.getPasswordHash())).isTrue();
			var profesional = profesionales.findAll();
			assertThat(profesional).singleElement().satisfies(p -> {
				assertThat(p.getUsuario().getId()).isEqualTo(r.usuarioId());
				assertThat(p.getApellido()).isEqualTo("Pérez");
			});
			assertThat(sillones.findAll()).hasSize(1);
			return null;
		});
	}

	@Test
	void duplicateEmailWithDifferentCasingIsRejectedWithoutCreatingAConsultorio() {
		registro.registrar(request("ana@consultorio.test", null));
		int before = count("consultorio");

		assertThatThrownBy(() -> registro.registrar(request("  ANA@Consultorio.test ", null)))
				.isInstanceOf(EmailYaRegistradoException.class);
		assertThat(count("consultorio")).isEqualTo(before);
	}

	@Test
	void failureAfterCreatingTheConsultorioLeavesNothingBehind() {
		// La matricula excede la columna (50): falla la insercion del profesional, despues del consultorio y el
		// usuario. Se invoca el servicio directo, salteando la validacion del controller.
		assertThatThrownBy(() -> registro.registrar(request("ana@consultorio.test", "M".repeat(60))))
				.isNotInstanceOf(EmailYaRegistradoException.class);

		assertThat(count("consultorio")).isZero();
		assertThat(count("usuario")).isZero();
		assertThat(count("profesional")).isZero();
		assertThat(count("sillon")).isZero();
		assertThat(TenantContext.get()).isEmpty();
		assertThat(TenantContext.isSystem()).isFalse();
	}

	@Test
	void twoRegistrationsGetIsolatedConsultorios() {
		RegistroResponse a = registro.registrar(request("a@a.test", null));
		RegistroResponse b = registro.registrar(request("b@b.test", null));

		assertThat(a.consultorioId()).isNotEqualTo(b.consultorioId());
		fixtures.inTenant(a.consultorioId(), () -> {
			assertThat(usuarios.findAll()).extracting(Usuario::getId).containsExactly(a.usuarioId());
			assertThat(sillones.findAll()).hasSize(1);
			return null;
		});
	}

	private int count(String table) {
		Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
		return n == null ? 0 : n;
	}

	static RegistroRequest request(String email, String matricula) {
		return new RegistroRequest("Consultorio Pérez", "Ana", "Pérez", email, "Segura123!", matricula);
	}
}
