package ar.global.odonto.paciente.ficha;

import ar.global.odonto.paciente.FichaClinica;

/** Entidad {@link FichaClinica} a DTO y viceversa (regla 1). Sin logs: maneja contenido clinico. */
final class FichaMapper {

	private FichaMapper() {
	}

	static FichaResponse aResponse(Long pacienteId, FichaClinica f) {
		return new FichaResponse(pacienteId, f.getAlergias(), f.getMedicacionActual(), f.getAntecedentesMedicos(),
				f.getEnfermedadesRelevantes(), f.getEmbarazo(), f.getMotivoConsulta(), f.getObservaciones(),
				f.getVersion(), f.getUpdatedAt());
	}

	/** Reemplazo completo (design D6): en blanco o {@code null} queda vacio; el texto no se recorta por dentro. */
	static void aplicar(FichaRequest req, FichaClinica f) {
		f.setAlergias(texto(req.alergias()));
		f.setMedicacionActual(texto(req.medicacionActual()));
		f.setAntecedentesMedicos(texto(req.antecedentesMedicos()));
		f.setEnfermedadesRelevantes(texto(req.enfermedadesRelevantes()));
		f.setEmbarazo(req.embarazo());
		f.setMotivoConsulta(texto(req.motivoConsulta()));
		f.setObservaciones(texto(req.observaciones()));
	}

	private static String texto(String valor) {
		return valor == null || valor.isBlank() ? null : valor;
	}
}
