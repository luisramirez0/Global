package ar.global.odonto.agenda.horario;

import java.time.LocalTime;

/** Regla pura de solapamiento de franjas (extremos adyacentes no se solapan). */
public final class SolapamientoHorario {

	private SolapamientoHorario() {
	}

	public static boolean seSolapan(LocalTime desdeA, LocalTime hastaA, LocalTime desdeB, LocalTime hastaB) {
		return desdeA.isBefore(hastaB) && desdeB.isBefore(hastaA);
	}
}
