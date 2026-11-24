package ar.global.odonto.agenda.sillon;

import ar.global.odonto.agenda.Sillon;

final class SillonMapper {

	private SillonMapper() {
	}

	static SillonResponse toResponse(Sillon sillon) {
		return new SillonResponse(sillon.getId(), sillon.getNombre(), sillon.isActivo());
	}

	/** Aplica el nombre; {@code activo} lo decide el servicio (invariantes entre filas). */
	static void apply(SillonRequest request, Sillon sillon) {
		sillon.setNombre(request.nombre().trim());
	}
}
