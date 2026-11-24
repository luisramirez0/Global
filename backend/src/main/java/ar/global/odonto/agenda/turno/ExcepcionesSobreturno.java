package ar.global.odonto.agenda.turno;

/**
 * Que controles aplican segun el pedido sea o no sobreturno explicito (RN-AG-02/04, C-07 design D3). El
 * solapamiento por sillon se verifica SIEMPRE (RN-AG-01 no tiene excepcion).
 */
public enum ExcepcionesSobreturno {

	NINGUNA(true, true, true),
	SOBRETURNO(false, false, false);

	private final boolean profesional;
	private final boolean horarioYGrilla;
	private final boolean bloqueos;

	ExcepcionesSobreturno(boolean profesional, boolean horarioYGrilla, boolean bloqueos) {
		this.profesional = profesional;
		this.horarioYGrilla = horarioYGrilla;
		this.bloqueos = bloqueos;
	}

	public static ExcepcionesSobreturno para(boolean sobreturno) {
		return sobreturno ? SOBRETURNO : NINGUNA;
	}

	public boolean verificaSillon() {
		return true;
	}

	public boolean verificaProfesional() {
		return profesional;
	}

	public boolean verificaHorarioYGrilla() {
		return horarioYGrilla;
	}

	public boolean verificaBloqueos() {
		return bloqueos;
	}
}
