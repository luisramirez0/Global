package ar.global.odonto.agenda.turno;

import java.time.Instant;

/**
 * Solapamiento con otro turno no cancelado (RN-AG-01/02) → {@code 409}. Solo lleva ids e instantes del turno en
 * conflicto: nunca datos del paciente (C-07 design D9).
 */
public class TurnoEnConflictoException extends RuntimeException {

	private final long turnoId;
	private final Instant inicio;
	private final Instant fin;
	private final long sillonId;
	private final long profesionalId;
	private final MotivoConflicto motivo;

	public TurnoEnConflictoException(long turnoId, Instant inicio, Instant fin, long sillonId, long profesionalId,
			MotivoConflicto motivo) {
		super("Turno en conflicto", null, false, false);
		this.turnoId = turnoId;
		this.inicio = inicio;
		this.fin = fin;
		this.sillonId = sillonId;
		this.profesionalId = profesionalId;
		this.motivo = motivo;
	}

	public long getTurnoId() {
		return turnoId;
	}

	public Instant getInicio() {
		return inicio;
	}

	public Instant getFin() {
		return fin;
	}

	public long getSillonId() {
		return sillonId;
	}

	public long getProfesionalId() {
		return profesionalId;
	}

	public MotivoConflicto getMotivo() {
		return motivo;
	}
}
