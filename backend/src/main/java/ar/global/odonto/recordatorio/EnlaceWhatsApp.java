package ar.global.odonto.recordatorio;

import ar.global.odonto.paciente.abm.TelefonoE164;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Arma el enlace {@code wa.me} con el texto precodificado (design D4). Funcion pura: el mensaje de error nunca
 * incluye el telefono (regla 5).
 */
public final class EnlaceWhatsApp {

	private static final String BASE = "https://wa.me/";

	private EnlaceWhatsApp() {
	}

	public static String para(String telefonoE164, String texto) {
		if (!TelefonoE164.esValido(telefonoE164)) {
			throw new IllegalArgumentException("Telefono no esta en formato E.164");
		}
		// URLEncoder deja '+' para el espacio; un '+' literal ya sale como %2B, asi que el reemplazo es seguro.
		String codificado = URLEncoder.encode(texto, StandardCharsets.UTF_8).replace("+", "%20");
		return BASE + telefonoE164.substring(1) + "?text=" + codificado;
	}
}
