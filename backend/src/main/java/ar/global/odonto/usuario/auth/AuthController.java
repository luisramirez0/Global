package ar.global.odonto.usuario.auth;

import ar.global.odonto.consultorio.registro.RegistroRequest;
import ar.global.odonto.consultorio.registro.RegistroResponse;
import ar.global.odonto.consultorio.registro.RegistroService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * ZONA DE RIESGO (regla 12). Endpoints de autenticacion (Flujo 1). {@code register} y {@code login} son
 * publicos ({@code SecurityConfig}); {@code me} exige token. Solo DTOs (regla 1).
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final RegistroService registro;
	private final LoginService login;
	private final UsuarioActualService usuarioActual;

	public AuthController(RegistroService registro, LoginService login, UsuarioActualService usuarioActual) {
		this.registro = registro;
		this.login = login;
		this.usuarioActual = usuarioActual;
	}

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public RegistroResponse register(@Valid @RequestBody RegistroRequest request) {
		return registro.registrar(request);
	}

	/** La IP es la del socket: sin proxy configurado no se confia en {@code X-Forwarded-For} (design D6). */
	@PostMapping("/login")
	public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
		return login.login(request.email(), request.password(), http.getRemoteAddr());
	}

	@GetMapping("/me")
	public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
		return usuarioActual.actual(Long.valueOf(jwt.getSubject()));
	}
}
