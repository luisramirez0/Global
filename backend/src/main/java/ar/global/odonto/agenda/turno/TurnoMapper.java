package ar.global.odonto.agenda.turno;

import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.turno.TurnoResponse.PacienteResumen;
import ar.global.odonto.agenda.turno.TurnoResponse.PrestacionResumen;

/** Entidad → DTO (regla 1). Debe llamarse con la sesion abierta o con paciente y prestacion ya cargados. */
public final class TurnoMapper {

	private TurnoMapper() {
	}

	public static TurnoResponse toResponse(Turno t) {
		return new TurnoResponse(t.getId(), t.getInicio(), t.getFin(), t.getEstado(), t.isEsSobreturno(),
				t.getMotivoCancelacion(), t.getNotas(), t.getSillon().getId(), t.getProfesional().getId(),
				new PacienteResumen(t.getPaciente().getId(), t.getPaciente().getNombre(), t.getPaciente().getApellido()),
				new PrestacionResumen(t.getPrestacion().getId(), t.getPrestacion().getNombre()));
	}
}
