package ar.global.odonto.agenda.bloqueo;

import ar.global.odonto.agenda.BloqueoAgenda;
import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.Sillon;

final class BloqueoMapper {

	private BloqueoMapper() {
	}

	/** Solo lee ids de las referencias perezosas (sin inicializarlas). */
	static BloqueoResponse toResponse(BloqueoAgenda b) {
		return new BloqueoResponse(b.getId(), b.getSillon() == null ? null : b.getSillon().getId(),
				b.getProfesional() == null ? null : b.getProfesional().getId(), b.getInicio(), b.getFin(),
				b.getMotivo());
	}

	static void apply(BloqueoRequest request, Sillon sillon, Profesional profesional, BloqueoAgenda b) {
		b.setSillon(sillon);
		b.setProfesional(profesional);
		b.setInicio(request.inicio());
		b.setFin(request.fin());
		b.setMotivo(request.motivo());
	}
}
