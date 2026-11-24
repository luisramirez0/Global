package ar.global.odonto.paciente.abm;

import java.util.regex.Pattern;

/**
 * Normaliza el DNI para que la unicidad por consultorio compare valores equivalentes (RN-PA-01, design D3):
 * sin puntos, espacios ni guiones, solo 7 u 8 digitos (supuesto: DNI argentino).
 */
public final class Dni {

	private static final Pattern SEPARADORES = Pattern.compile("[.\\s-]");
	private static final Pattern VALIDO = Pattern.compile("\\d{7,8}");

	private Dni() {
	}

	public static String normalizar(String raw) {
		String dni = raw == null ? "" : sinSeparadores(raw);
		if (!VALIDO.matcher(dni).matches()) {
			throw new DatoInvalidoException("dni");
		}
		return dni;
	}

	/** Quita los separadores admitidos sin validar (para buscar por prefijo de DNI). */
	static String sinSeparadores(String raw) {
		return SEPARADORES.matcher(raw).replaceAll("");
	}
}
