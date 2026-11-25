package ar.global.odonto.paciente.abm;

import java.util.regex.Pattern;

/**
 * Normaliza el telefono a E.164 para los enlaces {@code wa.me} (RN-PA-02, design D3). Solo quita espacios,
 * guiones, puntos y parentesis: no adivina el pais ni convierte numeros locales ({@code 011 15...}).
 */
public final class TelefonoE164 {

	private static final Pattern SEPARADORES = Pattern.compile("[\\s.()-]");
	private static final Pattern VALIDO = Pattern.compile("\\+[1-9]\\d{7,14}");

	private TelefonoE164() {
	}

	/** Indica si el valor ya esta en E.164 estricto ({@code +} y 8 a 15 digitos, sin separadores). */
	public static boolean esValido(String telefono) {
		return telefono != null && VALIDO.matcher(telefono).matches();
	}

	/** Devuelve el telefono en E.164, o {@code null} si viene vacio. */
	public static String normalizar(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		String telefono = SEPARADORES.matcher(raw).replaceAll("");
		if (!esValido(telefono)) {
			throw new DatoInvalidoException("telefono");
		}
		return telefono;
	}
}
