package ar.global.odonto.usuario.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Credenciales de login. {@code toString} no expone email ni contrasena (regla 5). */
public record LoginRequest(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 200) String password) {

	@Override
	public String toString() {
		return "LoginRequest[<oculto>]";
	}
}
