package ar.global.odonto.usuario.auth;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Usuario en curso a partir del token (design D8). Corre con el tenant que fijo {@code TenantContextFilter}: el
 * usuario de otro consultorio no se ve aunque el {@code sub} lo nombre. Usuario inexistente o inactivo: 401.
 */
@Service
public class UsuarioActualService {

	private final UsuarioRepository usuarios;
	private final ConsultorioRepository consultorios;

	public UsuarioActualService(UsuarioRepository usuarios, ConsultorioRepository consultorios) {
		this.usuarios = usuarios;
		this.consultorios = consultorios;
	}

	@Transactional(readOnly = true)
	public MeResponse actual(Long usuarioId) {
		Usuario usuario = usuarios.findById(usuarioId).filter(Usuario::isActivo)
				.orElseThrow(CredencialesInvalidasException::new);
		Consultorio consultorio = consultorios.findById(TenantContext.require())
				.orElseThrow(CredencialesInvalidasException::new);
		return MeResponse.from(usuario, consultorio);
	}
}
