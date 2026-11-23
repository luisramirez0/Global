package ar.global.odonto.usuario.auth;

import ar.global.odonto.usuario.Rol;

/** Resultado del login (design D6). {@code toString} no expone el token (regla 5). */
public record LoginResponse(String accessToken, String tokenType, long expiresIn, UsuarioResumen usuario,
		Long consultorioId) {

	public record UsuarioResumen(Long id, String nombre, Rol rol) {
	}

	@Override
	public String toString() {
		return "LoginResponse[accessToken=<oculto>, usuarioId=" + (usuario == null ? null : usuario.id())
				+ ", consultorioId=" + consultorioId + "]";
	}
}
