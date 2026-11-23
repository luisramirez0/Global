package ar.global.odonto.agenda;

import java.util.List;

/**
 * Catalogo de prestaciones sugeridas para un consultorio nuevo (constante de codigo, no datos globales).
 * Las duraciones son un supuesto a validar con un odontologo (PA-03); C-04 las copia por consultorio.
 */
public record PrestacionSugerida(String nombre, int duracionMinutos) {

	public static final List<PrestacionSugerida> CATALOGO = List.of(new PrestacionSugerida("Consulta", 30),
			new PrestacionSugerida("Limpieza", 45), new PrestacionSugerida("Arreglo/obturación", 60),
			new PrestacionSugerida("Control", 15));

	/** Crea una {@link Prestacion} nueva (sin guardar) a partir de la sugerencia. */
	public Prestacion toPrestacion() {
		return new Prestacion(nombre, duracionMinutos);
	}
}
