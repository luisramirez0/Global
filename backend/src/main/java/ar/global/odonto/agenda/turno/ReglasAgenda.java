package ar.global.odonto.agenda.turno;

import ar.global.odonto.agenda.config.GrillaAgenda;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Reglas puras de agenda de C-07 (RN-AG-03/04, design D5): horario de atencion en la zona del consultorio,
 * alineacion a la grilla y ambito de los bloqueos. Sin Spring ni persistencia.
 */
public final class ReglasAgenda {

	/** Franja de atencion de un profesional: dia ISO (lunes = 1) y horas locales del consultorio. */
	public record FranjaAtencion(int diaSemana, LocalTime desde, LocalTime hasta) {

		public FranjaAtencion {
			Objects.requireNonNull(desde, "desde");
			Objects.requireNonNull(hasta, "hasta");
		}
	}

	/** Bloqueo de agenda: sillon y profesional nulos significan "cualquiera" (contrato de C-04). */
	public record BloqueoVigente(long id, Long sillonId, Long profesionalId, IntervaloTurno intervalo) {

		public BloqueoVigente {
			Objects.requireNonNull(intervalo, "intervalo");
		}
	}

	private ReglasAgenda() {
	}

	/**
	 * El turno cabe entero en UNA franja del dia de su inicio local. No se encadenan franjas contiguas y un
	 * turno que cruza la medianoche local nunca cabe.
	 */
	public static boolean cabeEnHorario(IntervaloTurno turno, ZoneId zona, List<FranjaAtencion> franjas) {
		ZonedDateTime inicio = turno.inicio().atZone(zona);
		ZonedDateTime fin = turno.fin().atZone(zona);
		if (!inicio.toLocalDate().equals(fin.toLocalDate())) {
			return false;
		}
		int dia = inicio.getDayOfWeek().getValue();
		LocalTime desde = inicio.toLocalTime();
		LocalTime hasta = fin.toLocalTime();
		return franjas.stream().anyMatch(f -> f.diaSemana() == dia
				&& !desde.isBefore(f.desde()) && !hasta.isAfter(f.hasta()));
	}

	/** El inicio, en hora local, cae en la grilla (provisional, PA-03). */
	public static boolean inicioAlineado(Instant inicio, ZoneId zona) {
		return GrillaAgenda.alineada(inicio.atZone(zona).toLocalTime());
	}

	public static boolean bloqueoAplica(BloqueoVigente bloqueo, IntervaloTurno turno, long sillonId,
			long profesionalId) {
		return bloqueo.intervalo().solapaCon(turno)
				&& (bloqueo.sillonId() == null || bloqueo.sillonId() == sillonId)
				&& (bloqueo.profesionalId() == null || bloqueo.profesionalId() == profesionalId);
	}

	public static Optional<BloqueoVigente> primerBloqueoAplicable(List<BloqueoVigente> bloqueos, IntervaloTurno turno,
			long sillonId, long profesionalId) {
		return bloqueos.stream().filter(b -> bloqueoAplica(b, turno, sillonId, profesionalId)).findFirst();
	}
}
