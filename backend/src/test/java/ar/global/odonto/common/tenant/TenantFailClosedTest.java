package ar.global.odonto.common.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

@PersistenceTest
class TenantFailClosedTest {

	@Autowired
	private UsuarioRepository usuarios;

	@Autowired
	private TenantFixtures fixtures;

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
	}

	private int usuarioCount() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM usuario", Integer.class);
	}

	@Test
	void readingWithoutTenantFailsClosed() {
		assertThatThrownBy(() -> usuarios.findAll()).hasRootCauseInstanceOf(TenantNotSetException.class);
	}

	@Test
	void findByIdWithoutTenantFailsClosed() {
		assertThatThrownBy(() -> usuarios.findById(1L)).hasRootCauseInstanceOf(TenantNotSetException.class);
	}

	@Test
	void writingWithoutTenantFailsAndPersistsNothing() {
		assertThatThrownBy(() -> usuarios.save(new Usuario("x@a.test", "h", "N", Rol.ADMIN)))
				.hasRootCauseInstanceOf(TenantNotSetException.class);

		assertThat(usuarioCount()).isZero();
	}

	@Test
	void savingWithAnotherTenantsConsultorioIdAssignedByHandFails() {
		Usuario intruder = new Usuario("x@a.test", "h", "N", Rol.ADMIN);
		ReflectionTestUtils.setField(intruder, "consultorioId", tenants.b());

		assertThatThrownBy(() -> TenantContext.runAs(tenants.a(), () -> usuarios.save(intruder)))
				.isInstanceOf(RuntimeException.class);

		assertThat(usuarioCount()).isZero();
	}

	@Test
	void afterASystemBlockTheAccessIsClosedAgain() {
		TenantContext.runAsSystem(() -> usuarios.findAll());

		assertThatThrownBy(() -> usuarios.findAll()).hasRootCauseInstanceOf(TenantNotSetException.class);
	}
}
