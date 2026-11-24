package ar.global.odonto.paciente.abm;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Parametros LIKE de la busqueda de pacientes (design D5). {@code patron}: contiene el texto en minusculas;
 * {@code dniPrefijo}: solo si el texto, sin separadores, son digitos. Ambos {@code null} = sin filtro de texto.
 * Se escapa con {@code !} y no con {@code \}: en MySQL la barra es escape dentro de literales SQL.
 */
public record CriterioBusqueda(String patron, String dniPrefijo) {

	public static final char ESCAPE = '!';

	static final int LARGO_MAXIMO = 100;

	private static final Pattern DIGITOS = Pattern.compile("\\d+");

	public static CriterioBusqueda de(String q) {
		if (q == null || q.isBlank()) {
			return new CriterioBusqueda(null, null);
		}
		String texto = q.trim();
		if (texto.length() > LARGO_MAXIMO) {
			texto = texto.substring(0, LARGO_MAXIMO);
		}
		String patron = "%" + escapar(texto.toLowerCase(Locale.ROOT)) + "%";
		String digitos = Dni.sinSeparadores(texto);
		String dniPrefijo = DIGITOS.matcher(digitos).matches() ? digitos + "%" : null;
		return new CriterioBusqueda(patron, dniPrefijo);
	}

	private static String escapar(String texto) {
		return texto.replace("!", "!!").replace("%", "!%").replace("_", "!_");
	}
}
