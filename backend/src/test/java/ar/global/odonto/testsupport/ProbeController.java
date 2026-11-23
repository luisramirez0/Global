package ar.global.odonto.testsupport;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.security.Permisos;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import java.util.List;
import java.util.Map;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controlador SOLO de tests (no se escanea: {@code @TestComponent}; se activa con {@code @Import}). Expone el
 * tenant en curso, endpoints con cada permiso RBAC y un listado de usuarios para probar el aislamiento.
 */
@TestComponent
@RestController
@RequestMapping("/api/test")
public class ProbeController {

	private final UsuarioRepository usuarios;

	public ProbeController(UsuarioRepository usuarios) {
		this.usuarios = usuarios;
	}

	@GetMapping("/tenant")
	public Map<String, Long> tenant() {
		return Map.of("consultorioId", TenantContext.require());
	}

	@GetMapping("/falla")
	public void falla() {
		throw new IllegalStateException("falla de prueba");
	}

	@GetMapping("/gestion")
	@PreAuthorize(Permisos.GESTION)
	public Map<String, String> gestion() {
		return Map.of("permiso", "GESTION");
	}

	@GetMapping("/operacion")
	@PreAuthorize(Permisos.OPERACION)
	public Map<String, String> operacion() {
		return Map.of("permiso", "OPERACION");
	}

	@GetMapping("/usuarios")
	public List<Long> usuarios() {
		return usuarios.findAll().stream().map(Usuario::getId).toList();
	}
}
