package ar.global.odonto.usuario;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

@PersistenceTest
class UsuarioRepositoryTest {

	@Autowired
	private UsuarioRepository usuarios;

	@Autowired
	private TenantFixtures fixtures;

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

	private Usuario saveAs(Long tenant, String email) {
		return TenantContext.runAs(tenant, () -> usuarios.save(new Usuario(email, "hash", "Nombre", Rol.ADMIN)));
	}

	@Test
	void savingWithTenantAssignsItsConsultorioId() {
		Usuario saved = saveAs(tenants.a(), "ana@a.test");

		assertThat(saved.getId()).isPositive();
		assertThat(saved.getConsultorioId()).isEqualTo(tenants.a());
		assertThat(saved.isActivo()).isTrue();
		assertThat(saved.getRol()).isEqualTo(Rol.ADMIN);
	}

	@Test
	void sameEmailInAnotherConsultorioFails() {
		saveAs(tenants.a(), "ana@a.test");

		assertThatThrownBy(() -> saveAs(tenants.b(), "ana@a.test")).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void sameEmailWithDifferentCaseFailsBecauseItIsLowercased() {
		Usuario first = saveAs(tenants.a(), "ana@a.test");

		assertThatThrownBy(() -> saveAs(tenants.a(), "Ana@A.test")).isInstanceOf(DataIntegrityViolationException.class);
		assertThat(first.getEmail()).isEqualTo("ana@a.test");
	}

	@Test
	void emailIsStoredLowercase() {
		Usuario saved = saveAs(tenants.a(), "MIXED@Case.TEST");

		assertThat(saved.getEmail()).isEqualTo("mixed@case.test");
	}

	@Test
	void tenantAOnlySeesItsOwnUsers() {
		Usuario ofA = saveAs(tenants.a(), "a@a.test");
		Usuario ofB = saveAs(tenants.b(), "b@b.test");

		TenantContext.runAs(tenants.a(), () -> {
			assertThat(usuarios.findAll()).extracting(Usuario::getId).containsExactly(ofA.getId());
			assertThat(usuarios.findById(ofB.getId())).isEmpty();
			assertThat(usuarios.findByEmail("b@b.test")).isEmpty();
			assertThat(usuarios.findByEmail("a@a.test")).isPresent();
			return null;
		});
	}

	@Test
	void systemModeFindsTheUserOfAnotherConsultorioByEmail() {
		saveAs(tenants.b(), "b@b.test");

		Usuario found = TenantContext.runAsSystem(() -> usuarios.findByEmail("b@b.test").orElseThrow());

		assertThat(found.getConsultorioId()).isEqualTo(tenants.b());
	}
}
