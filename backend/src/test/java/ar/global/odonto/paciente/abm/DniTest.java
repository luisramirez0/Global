package ar.global.odonto.paciente.abm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/** Spec patient-management "DNI válido y único por consultorio" (design D3). */
class DniTest {

	@ParameterizedTest
	@ValueSource(strings = { "30.111.222", "30 111 222", "30-111-222", " 30111222 " })
	void removesSeparators(String raw) {
		assertThat(Dni.normalizar(raw)).isEqualTo("30111222");
	}

	@Test
	void acceptsSevenDigits() {
		assertThat(Dni.normalizar("1.234.567")).isEqualTo("1234567");
	}

	@ParameterizedTest
	@NullAndEmptySource
	@ValueSource(strings = { "123456", "123456789", "12AB", "   ", "30.111.22X" })
	void rejectsInvalidFormatsNamingTheFieldWithoutTheValue(String raw) {
		assertThatThrownBy(() -> Dni.normalizar(raw)).isInstanceOfSatisfying(DatoInvalidoException.class, ex -> {
			assertThat(ex.getCampos()).containsExactly("dni");
			if (raw != null && !raw.isBlank()) {
				assertThat(ex.getMessage()).doesNotContain(raw.trim());
			}
		});
	}
}
