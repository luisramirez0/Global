package ar.global.odonto.agenda.turno;

import static ar.global.odonto.agenda.EstadoTurno.ASISTIO;
import static ar.global.odonto.agenda.EstadoTurno.AUSENTE;
import static ar.global.odonto.agenda.EstadoTurno.CANCELADO;
import static ar.global.odonto.agenda.EstadoTurno.CONFIRMADO;
import static ar.global.odonto.agenda.EstadoTurno.PROGRAMADO;

import ar.global.odonto.agenda.EstadoTurno;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Maquina de estados del turno (RN-AG-05, C-07 design D7). {@code CANCELADO}, {@code ASISTIO} y {@code AUSENTE}
 * son finales; la reapertura queda fuera de alcance.
 */
public final class TransicionesTurno {

	private static final Map<EstadoTurno, Set<EstadoTurno>> SALIDAS = new EnumMap<>(EstadoTurno.class);

	static {
		for (EstadoTurno estado : EstadoTurno.values()) {
			SALIDAS.put(estado, EnumSet.noneOf(EstadoTurno.class));
		}
		SALIDAS.put(PROGRAMADO, EnumSet.of(CONFIRMADO, CANCELADO, ASISTIO, AUSENTE));
		SALIDAS.put(CONFIRMADO, EnumSet.of(CANCELADO, ASISTIO, AUSENTE));
	}

	private TransicionesTurno() {
	}

	public static boolean permitida(EstadoTurno desde, EstadoTurno hacia) {
		return SALIDAS.get(desde).contains(hacia);
	}

	public static boolean esFinal(EstadoTurno estado) {
		return SALIDAS.get(estado).isEmpty();
	}

	/** Solo los turnos abiertos se pueden mover (RN-AG-06). */
	public static boolean reprogramable(EstadoTurno estado) {
		return !esFinal(estado);
	}

	/** Marcar asistencia o ausencia exige que el turno ya haya empezado. */
	public static boolean requiereInicioPasado(EstadoTurno hacia) {
		return hacia == ASISTIO || hacia == AUSENTE;
	}
}
