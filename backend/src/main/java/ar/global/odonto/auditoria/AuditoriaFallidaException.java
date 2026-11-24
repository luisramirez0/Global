package ar.global.odonto.auditoria;

/**
 * El registro de auditoria de una operacion no pudo guardarse (design D2): la operacion falla y se revierte, y la
 * API responde el {@code 500} generico. Sin mensaje ni causa: no debe filtrar datos (regla 5); el detalle (solo
 * ids y tipo de error) queda en el log.
 */
public class AuditoriaFallidaException extends RuntimeException {

	public AuditoriaFallidaException() {
		super("Fallo de auditoria", null, false, false);
	}
}
