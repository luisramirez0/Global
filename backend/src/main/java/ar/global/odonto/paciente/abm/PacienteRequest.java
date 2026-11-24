package ar.global.odonto.paciente.abm;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Alta y edicion de paciente (design D2). El formato de DNI y telefono lo valida el servicio tras normalizar
 * (design D3). {@code toString} oculta los datos personales (regla 5).
 */
public record PacienteRequest(
		@NotBlank @Size(max = 100) String nombre,
		@NotBlank @Size(max = 100) String apellido,
		@NotBlank @Size(max = 20) String dni,
		@PastOrPresent LocalDate fechaNacimiento,
		@Size(max = 20) String sexo,
		@Size(max = 30) String telefono,
		@Email @Size(max = 254) String email,
		@Size(max = 255) String direccion,
		@Size(max = 150) String obraSocialTexto) {

	@Override
	public String toString() {
		return "PacienteRequest[<oculto>]";
	}
}
