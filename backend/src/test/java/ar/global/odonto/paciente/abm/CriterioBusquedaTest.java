package ar.global.odonto.paciente.abm;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/** Armado de los patrones LIKE de la busqueda (design D5). Escape con {@code !}: portable H2/MySQL. */
class CriterioBusquedaTest {

	@ParameterizedTest
	@NullAndEmptySource
	@ValueSource(strings = { "   " })
	void blankQueryMeansNoTextFilter(String q) {
		CriterioBusqueda c = CriterioBusqueda.de(q);

		assertThat(c.patron()).isNull();
		assertThat(c.dniPrefijo()).isNull();
	}

	@Test
	void textQueryIsTrimmedLowercasedContainsPattern() {
		CriterioBusqueda c = CriterioBusqueda.de("  Ana PÉR ");

		assertThat(c.patron()).isEqualTo("%ana pér%");
		assertThat(c.dniPrefijo()).isNull();
	}

	@Test
	void digitsWithSeparatorsAlsoSearchDniPrefix() {
		CriterioBusqueda c = CriterioBusqueda.de("30.111");

		assertThat(c.patron()).isEqualTo("%30.111%");
		assertThat(c.dniPrefijo()).isEqualTo("30111%");
	}

	@Test
	void wildcardsAndEscapeCharAreEscaped() {
		assertThat(CriterioBusqueda.de("%").patron()).isEqualTo("%!%%");
		assertThat(CriterioBusqueda.de("a_b!").patron()).isEqualTo("%a!_b!!%");
	}

	@Test
	void queryIsCappedAt100Characters() {
		CriterioBusqueda c = CriterioBusqueda.de("x".repeat(150));

		assertThat(c.patron()).hasSize(102);
	}
}
