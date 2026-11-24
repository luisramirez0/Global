package ar.global.odonto.agenda.sillon;

/** Regla pura: entre 1 y 2 sillones activos por consultorio (DD-01, RN-MT-02). */
public final class LimiteSillones {

	public static final int MAXIMO_ACTIVOS = 2;
	public static final int MINIMO_ACTIVOS = 1;

	private LimiteSillones() {
	}

	/** Se puede sumar un activo (alta o reactivacion) si hoy hay menos del maximo. */
	public static boolean permiteActivar(long activosActuales) {
		return activosActuales < MAXIMO_ACTIVOS;
	}

	/** Se puede restar un activo (baja o desactivacion) si quedaria al menos el minimo. */
	public static boolean permiteDesactivar(long activosActuales) {
		return activosActuales - 1 >= MINIMO_ACTIVOS;
	}
}
