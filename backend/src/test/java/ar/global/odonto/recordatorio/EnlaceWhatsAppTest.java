package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/** Spec appointment-reminders "Enlace de WhatsApp" y "Codificación del texto del enlace" (design D4). */
class EnlaceWhatsAppTest {

	private static final String TELEFONO = "+5491122334455";

	private static String textoDe(String enlace) {
		return enlace.substring(enlace.indexOf("?text=") + "?text=".length());
	}

	@Test
	void buildsLinkWithDigitsAndEncodedSpaces() {
		assertThat(EnlaceWhatsApp.para(TELEFONO, "hola mundo"))
				.isEqualTo("https://wa.me/5491122334455?text=hola%20mundo");
	}

	@Test
	void encodesAccentsAsUtf8Bytes() {
		assertThat(textoDe(EnlaceWhatsApp.para(TELEFONO, "Pérez"))).isEqualTo("P%C3%A9rez");
	}

	@Test
	void encodesReservedCharacters() {
		assertThat(textoDe(EnlaceWhatsApp.para(TELEFONO, "Sonrisa & Co #1"))).isEqualTo("Sonrisa%20%26%20Co%20%231");
	}

	@Test
	void encodesNewline() {
		assertThat(textoDe(EnlaceWhatsApp.para(TELEFONO, "a\nb"))).isEqualTo("a%0Ab");
	}

	@Test
	void encodesLiteralPlusAsPercent2B() {
		assertThat(textoDe(EnlaceWhatsApp.para(TELEFONO, "1+1"))).isEqualTo("1%2B1");
	}

	@Test
	void linkHasNoSpacesNorPlusSigns() {
		String enlace = EnlaceWhatsApp.para(TELEFONO, "Sonrisa & Co + más #1\nfin");

		assertThat(enlace).doesNotContain(" ").doesNotContain("+");
	}

	@Test
	void decodingTextReturnsOriginal() {
		String original = "Recordatorio: tiene un turno el 26/11/2026 a las 10:00 en Sonrisa & Co con Ana Pérez.\n+ ok";

		String enlace = EnlaceWhatsApp.para(TELEFONO, original);

		assertThat(URLDecoder.decode(textoDe(enlace).replace("+", "%2B"), StandardCharsets.UTF_8)).isEqualTo(original);
	}

	@ParameterizedTest
	@NullAndEmptySource
	@ValueSource(strings = { "5491122334455", "+54911ABC4455", "+123456", "+1234567890123456", "++5491122334455",
			"+0491122334455" })
	void rejectsInvalidPhoneWithoutEchoingIt(String telefono) {
		assertThatThrownBy(() -> EnlaceWhatsApp.para(telefono, "hola"))
				.isInstanceOf(IllegalArgumentException.class)
				.satisfies(e -> {
					if (telefono != null && !telefono.isEmpty()) {
						assertThat(e.getMessage()).doesNotContain(telefono);
					}
				});
	}
}
