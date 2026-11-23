package ar.global.odonto.consultorio.registro;

import ar.global.odonto.common.web.MaxUtf8Bytes;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Alta de consultorio + odontologo (Flujo 1, design D5). {@code toString} oculta email y contrasena (regla 5).
 */
public record RegistroRequest(
		@NotBlank @Size(max = 150) String consultorioNombre,
		@NotBlank @Size(max = 100) String nombre,
		@NotBlank @Size(max = 100) String apellido,
		@NotBlank @Email @Size(max = 254) String email,
		@NotBlank @Size(min = 8) @MaxUtf8Bytes(72) String password,
		@Size(max = 50) String matricula) {

	@Override
	public String toString() {
		return "RegistroRequest[<oculto>]";
	}
}
