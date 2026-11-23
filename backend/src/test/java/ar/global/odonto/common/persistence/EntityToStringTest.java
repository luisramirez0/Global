package ar.global.odonto.common.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** Regla 5: la representacion textual de las entidades solo lleva clase e id. */
class EntityToStringTest {

	@Test
	void usuarioToStringHasIdButNeitherEmailNorName() {
		Usuario u = new Usuario("ana.perez@clinica.test", "hash-secreto", "Ana Perez", Rol.ADMIN);
		ReflectionTestUtils.setField(u, "id", 42L);

		String text = u.toString();

		assertThat(text).contains("42").contains("Usuario");
		assertThat(text).doesNotContain("ana.perez@clinica.test").doesNotContain("Ana").doesNotContain("Perez")
				.doesNotContain("hash-secreto");
	}

	@Test
	void profesionalToStringHasIdButNeitherNameNorMatricula() {
		Profesional p = new Profesional("Carlos", "Gutierrez");
		p.setMatricula("MP-123456");
		ReflectionTestUtils.setField(p, "id", 7L);

		String text = p.toString();

		assertThat(text).contains("7").contains("Profesional");
		assertThat(text).doesNotContain("Carlos").doesNotContain("Gutierrez").doesNotContain("MP-123456");
	}

	@Test
	void unsavedEntityPrintsNullId() {
		assertThat(new Usuario("x@a.test", "h", "N", Rol.ADMIN).toString()).isEqualTo("Usuario#null");
	}
}
