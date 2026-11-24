package ar.global.odonto.agenda.horario;

import ar.global.odonto.agenda.HorarioAtencion;
import ar.global.odonto.agenda.Profesional;

final class HorarioMapper {

	private HorarioMapper() {
	}

	/** Solo lee el id del profesional (referencia perezosa, sin inicializarla). */
	static HorarioResponse toResponse(HorarioAtencion h) {
		return new HorarioResponse(h.getId(), h.getProfesional().getId(), h.getDiaSemana(), h.getHoraDesde(),
				h.getHoraHasta());
	}

	static void apply(HorarioRequest request, Profesional profesional, HorarioAtencion h) {
		h.setProfesional(profesional);
		h.setDiaSemana(request.diaSemana());
		h.setHoraDesde(request.horaDesde());
		h.setHoraHasta(request.horaHasta());
	}
}
