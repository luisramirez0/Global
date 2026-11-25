package ar.global.odonto.paciente.export;

import ar.global.odonto.agenda.Turno;
import ar.global.odonto.paciente.ConsentimientoDatos;
import ar.global.odonto.paciente.FichaClinica;
import ar.global.odonto.paciente.NotaClinica;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.export.PacienteExportResponse.Consentimiento;
import ar.global.odonto.paciente.export.PacienteExportResponse.DatosPaciente;
import ar.global.odonto.paciente.export.PacienteExportResponse.Ficha;
import ar.global.odonto.paciente.export.PacienteExportResponse.Nota;
import ar.global.odonto.paciente.export.PacienteExportResponse.Referencia;
import ar.global.odonto.paciente.export.PacienteExportResponse.TurnoExportado;

/** Entidad → DTO del export (regla 1). Debe usarse dentro de la transaccion (asociaciones LAZY). */
final class PacienteExportMapper {

	private PacienteExportMapper() {
	}

	static DatosPaciente paciente(Paciente p) {
		return new DatosPaciente(p.getId(), p.getNombre(), p.getApellido(), p.getDni(), p.getFechaNacimiento(),
				p.getSexo(), p.getTelefono(), p.getEmail(), p.getDireccion(), p.getObraSocialTexto(), p.isActivo());
	}

	static Consentimiento consentimiento(ConsentimientoDatos c) {
		return new Consentimiento(c.getId(), c.getVersionTexto(), c.getAceptadoEn(), c.getRegistradoPor().getId());
	}

	static Ficha ficha(FichaClinica f) {
		return new Ficha(f.getAlergias(), f.getMedicacionActual(), f.getAntecedentesMedicos(),
				f.getEnfermedadesRelevantes(), f.getEmbarazo(), f.getMotivoConsulta(), f.getObservaciones(),
				f.getUpdatedAt());
	}

	static Nota nota(NotaClinica n) {
		return new Nota(n.getId(), n.getFecha(), n.getProfesional().getId(),
				n.getTurno() == null ? null : n.getTurno().getId(), n.getTexto());
	}

	static TurnoExportado turno(Turno t) {
		return new TurnoExportado(t.getId(), t.getInicio(), t.getFin(), t.getEstado(), t.isEsSobreturno(),
				t.getMotivoCancelacion(), t.getNotas(), t.getProfesional().getId(),
				new Referencia(t.getPrestacion().getId(), t.getPrestacion().getNombre()),
				new Referencia(t.getSillon().getId(), t.getSillon().getNombre()));
	}
}
