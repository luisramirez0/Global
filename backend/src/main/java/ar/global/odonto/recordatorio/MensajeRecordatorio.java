package ar.global.odonto.recordatorio;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Plantilla fija del recordatorio (RN-CO-04, design D3). Funcion pura: la firma no recibe paciente, prestacion ni
 * notas, por lo que el mensaje no puede filtrarlos.
 */
public final class MensajeRecordatorio {

	private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
	private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");

	private MensajeRecordatorio() {
	}

	public static String de(Instant inicio, ZoneId zona, String consultorio, String profesional) {
		var local = inicio.atZone(zona);
		return "Recordatorio: tiene un turno el " + FECHA.format(local) + " a las " + HORA.format(local) + " en "
				+ consultorio + " con " + profesional + ".";
	}
}
