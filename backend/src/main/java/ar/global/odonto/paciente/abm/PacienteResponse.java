package ar.global.odonto.paciente.abm;

import java.time.LocalDate;

/** Paciente expuesto por la API (regla 1). Sin {@code consultorioId}: va implicito en el token. */
public record PacienteResponse(
		Long id,
		String nombre,
		String apellido,
		String dni,
		LocalDate fechaNacimiento,
		String sexo,
		String telefono,
		String email,
		String direccion,
		String obraSocialTexto,
		boolean activo) {

	@Override
	public String toString() {
		return "PacienteResponse[id=" + id + "]";
	}
}
