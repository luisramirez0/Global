package ar.global.odonto.agenda.config;

import java.time.LocalTime;

/**
 * Grilla de la agenda: UNICO punto de configuracion (C-04 design D3). 15 minutos es un valor PROVISIONAL
 * (SU-03); su validacion con un odontologo esta pendiente (PA-03, prioridad Alta). C-07 debe leerla de aca.
 */
public final class GrillaAgenda {

	/** Minutos de la grilla. Provisional (PA-03). */
	public static final int MINUTOS = 15;

	private GrillaAgenda() {
	}

	/** Positiva y multiplo de la grilla (RN-AG-03). Sin tope superior. */
	public static boolean esDuracionValida(int minutos) {
		return minutos > 0 && minutos % MINUTOS == 0;
	}

	/** Minutos del dia multiplo de la grilla y sin segundos ni nanos. */
	public static boolean alineada(LocalTime hora) {
		return hora.getSecond() == 0 && hora.getNano() == 0
				&& (hora.getHour() * 60 + hora.getMinute()) % MINUTOS == 0;
	}
}
