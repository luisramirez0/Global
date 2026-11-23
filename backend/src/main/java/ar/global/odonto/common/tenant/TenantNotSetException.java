package ar.global.odonto.common.tenant;

/**
 * Se lanza cuando se intenta acceder a datos de negocio sin tenant en curso y sin modo sistema
 * (fail closed, design D1).
 */
public class TenantNotSetException extends IllegalStateException {

	public TenantNotSetException() {
		super("No hay consultorio (tenant) en curso");
	}
}
