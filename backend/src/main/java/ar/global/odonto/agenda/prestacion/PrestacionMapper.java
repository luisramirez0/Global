package ar.global.odonto.agenda.prestacion;

import ar.global.odonto.agenda.Prestacion;

final class PrestacionMapper {

	private PrestacionMapper() {
	}

	static PrestacionResponse toResponse(Prestacion p) {
		return new PrestacionResponse(p.getId(), p.getNombre(), p.getDuracionMinutos(), p.isActivo());
	}

	static void apply(PrestacionRequest request, Prestacion p) {
		p.setNombre(request.nombre().trim());
		p.setDuracionMinutos(request.duracionMinutos());
		if (request.activo() != null) {
			p.setActivo(request.activo());
		}
	}
}
