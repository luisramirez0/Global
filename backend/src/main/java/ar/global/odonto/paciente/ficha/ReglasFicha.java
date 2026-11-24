package ar.global.odonto.paciente.ficha;

import java.util.Objects;

/**
 * Regla pura del guardado de la ficha (design D6): el cliente manda la {@code version} que leyo, {@code null} si la
 * ficha no existia. Solo dos combinaciones son validas; cualquier otra es una ficha desactualizada.
 */
final class ReglasFicha {

	private ReglasFicha() {
	}

	/**
	 * @param versionGuardada version de la ficha en la base, o {@code null} si todavia no existe
	 * @param versionPedido version enviada por el cliente, o {@code null}
	 */
	static OperacionFicha decidir(Long versionGuardada, Long versionPedido) {
		if (versionGuardada == null && versionPedido == null) {
			return OperacionFicha.CREAR;
		}
		if (versionGuardada != null && Objects.equals(versionGuardada, versionPedido)) {
			return OperacionFicha.ACTUALIZAR;
		}
		throw new FichaDesactualizadaException();
	}
}
