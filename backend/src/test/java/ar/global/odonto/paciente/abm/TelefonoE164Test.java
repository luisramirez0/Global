package ar.global.odonto.paciente.abm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/** Spec patient-management "Teléfono en formato E.164" (design D3). */
class TelefonoE164Test {

	@ParameterizedTest
	@ValueSource(strings = { "+54 9 11 2345-6789", "+54 (9) 11 2345.6789", "+5491123456789", " +54 9 11 23456789 " })
	void normalizesSeparators(String raw) {
		assertThat(TelefonoE164.normalizar(raw)).isEqualTo("+5491123456789");
	}

	@Test
	void acceptsOtherCountriesAndLengthLimits() {
		assertThat(TelefonoE164.normalizar("+1 202 555 0123")).isEqualTo("+12025550123");
		assertThat(TelefonoE164.normalizar("+12345678")).isEqualTo("+12345678");
		assertThat(TelefonoE164.normalizar("+123456789012345")).isEqualTo("+123456789012345");
	}

	@ParameterizedTest
	@NullAndEmptySource
	@ValueSource(strings = { "   " })
	void blankIsAbsent(String raw) {
		assertThat(TelefonoE164.normalizar(raw)).isNull();
	}

	@ParameterizedTest
	@ValueSource(strings = { "011 15 2345 6789", "5491123456789", "+0 11 2345 6789", "+1234567", "+1234567890123456",
			"+54 9 11 ABCD-6789", "++5491123456789" })
	void rejectsInvalidNumbersNamingTheFieldWithoutTheValue(String raw) {
		assertThatThrownBy(() -> TelefonoE164.normalizar(raw)).isInstanceOfSatisfying(DatoInvalidoException.class,
				ex -> {
					assertThat(ex.getCampos()).containsExactly("telefono");
					assertThat(ex.getMessage()).doesNotContain(raw);
				});
	}
}
