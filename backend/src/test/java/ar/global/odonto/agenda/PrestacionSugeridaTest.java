package ar.global.odonto.agenda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.usuario.Rol;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

class PrestacionSugeridaTest {

	@Test
	void catalogContainsExactlyTheFourSuggestedPrestaciones() {
		assertThat(PrestacionSugerida.CATALOGO).extracting(PrestacionSugerida::nombre, PrestacionSugerida::duracionMinutos)
				.containsExactly(org.assertj.core.groups.Tuple.tuple("Consulta", 30),
						org.assertj.core.groups.Tuple.tuple("Limpieza", 45),
						org.assertj.core.groups.Tuple.tuple("Arreglo/obturación", 60),
						org.assertj.core.groups.Tuple.tuple("Control", 15));
	}

	@Test
	void everySuggestedDurationIsPositive() {
		assertThat(PrestacionSugerida.CATALOGO).allSatisfy(p -> assertThat(p.duracionMinutos()).isPositive());
	}

	@Test
	void catalogIsNotModifiable() {
		assertThatThrownBy(() -> PrestacionSugerida.CATALOGO.add(new PrestacionSugerida("X", 5)))
				.isInstanceOf(UnsupportedOperationException.class);
	}

	@Test
	void toPrestacionCopiesNameAndDuration() {
		Prestacion p = PrestacionSugerida.CATALOGO.get(1).toPrestacion();

		assertThat(p.getNombre()).isEqualTo("Limpieza");
		assertThat(p.getDuracionMinutos()).isEqualTo(45);
		assertThat(p.isActivo()).isTrue();
	}

	@Test
	void rolesAreExactlyAdminProfesionalRecepcion() {
		assertThat(Arrays.stream(Rol.values()).map(Enum::name)).containsExactly("ADMIN", "PROFESIONAL", "RECEPCION");
	}
}
