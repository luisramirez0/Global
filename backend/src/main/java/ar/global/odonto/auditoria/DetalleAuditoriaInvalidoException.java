package ar.global.odonto.auditoria;

/**
 * Detalle de auditoria que no cumple el formato restringido (design D4). El mensaje nunca incluye el valor
 * rechazado (regla 5): puede ser dato personal.
 */
public class DetalleAuditoriaInvalidoException extends RuntimeException {

	public DetalleAuditoriaInvalidoException(String motivo) {
		super(motivo, null, false, false);
	}
}
