package ar.global.odonto.paciente.ficha;

import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.paciente.ConsentimientoDatosRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import org.springframework.stereotype.Component;

/**
 * Precondiciones de todo acceso clinico, en el orden de design D9: paciente del consultorio en curso
 * ({@code 404}; el filtro de tenant oculta los ajenos), paciente activo (solo escrituras, {@code 409}) y
 * consentimiento registrado ({@code 409}, design D3/D4). Debe llamarse dentro de la transaccion de la operacion.
 */
@Component
class PacienteClinico {

	private final PacienteRepository pacientes;
	private final ConsentimientoDatosRepository consentimientos;

	PacienteClinico(PacienteRepository pacientes, ConsentimientoDatosRepository consentimientos) {
		this.pacientes = pacientes;
		this.consentimientos = consentimientos;
	}

	/** Paciente del consultorio, activo o no. */
	Paciente buscar(Long pacienteId) {
		return pacientes.findById(pacienteId).orElseThrow(RecursoNoEncontradoException::new);
	}

	/** Lectura de ficha o notas: admite pacientes dados de baja (conservacion de la HC, RN-PA-03). */
	Paciente paraLeer(Long pacienteId) {
		Paciente paciente = buscar(pacienteId);
		exigirConsentimiento(pacienteId);
		return paciente;
	}

	/** Escritura de ficha o notas. */
	Paciente paraEscribir(Long pacienteId) {
		Paciente paciente = paraConsentir(pacienteId);
		exigirConsentimiento(pacienteId);
		return paciente;
	}

	/** Registro de consentimiento: solo exige paciente activo. */
	Paciente paraConsentir(Long pacienteId) {
		Paciente paciente = buscar(pacienteId);
		if (!paciente.isActivo()) {
			throw new PacienteInactivoException();
		}
		return paciente;
	}

	private void exigirConsentimiento(Long pacienteId) {
		if (!consentimientos.existsByPacienteId(pacienteId)) {
			throw new ConsentimientoRequeridoException();
		}
	}
}
