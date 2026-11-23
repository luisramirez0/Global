package ar.global.odonto.usuario.auth;

import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;

/** Usuario y consultorio en curso (design D8). Incluye el mapper desde las entidades (regla 1). */
public record MeResponse(UsuarioInfo usuario, ConsultorioInfo consultorio) {

	public record UsuarioInfo(Long id, String nombre, String email, Rol rol) {

		@Override
		public String toString() {
			return "UsuarioInfo[id=" + id + ", rol=" + rol + "]";
		}
	}

	public record ConsultorioInfo(Long id, String nombre) {
	}

	static MeResponse from(Usuario u, Consultorio c) {
		return new MeResponse(new UsuarioInfo(u.getId(), u.getNombre(), u.getEmail(), u.getRol()),
				new ConsultorioInfo(c.getId(), c.getNombre()));
	}
}
