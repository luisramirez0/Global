package ar.global.odonto.paciente.abm;

/**
 * Ya existe un paciente con ese DNI en el consultorio (RN-PA-01): {@code 409} con el id existente para que la
 * UI ofrezca verlo o reactivarlo. El mensaje no incluye el DNI (regla 5).
 */
public class DniDuplicadoException extends RuntimeException {

	private final Long pacienteId;

	public DniDuplicadoException(Long pacienteId) {
		super("Ya existe un paciente con ese DNI.");
		this.pacienteId = pacienteId;
	}

	public Long getPacienteId() {
		return pacienteId;
	}
}
