package ar.global.odonto.agenda.turno;

/**
 * Turno fuera del horario de atencion, fuera de la grilla o dentro de un bloqueo (RN-AG-04) → {@code 422} sobre
 * el campo indicado. {@code bloqueoId} solo cuando la causa es un bloqueo; nunca su motivo (C-07 design D9).
 */
public class FueraDeAgendaException extends RuntimeException {

	private final String campo;
	private final Long bloqueoId;

	private FueraDeAgendaException(String campo, Long bloqueoId) {
		super("Turno fuera de agenda", null, false, false);
		this.campo = campo;
		this.bloqueoId = bloqueoId;
	}

	public static FueraDeAgendaException fueraDeHorario() {
		return new FueraDeAgendaException("inicio", null);
	}

	public static FueraDeAgendaException enBloqueo(long bloqueoId) {
		return new FueraDeAgendaException("inicio", bloqueoId);
	}

	public String getCampo() {
		return campo;
	}

	public Long getBloqueoId() {
		return bloqueoId;
	}
}
