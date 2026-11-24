package ar.global.odonto.usuario.auth;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.DetalleAuditoria;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.security.LoginRateLimiter;
import ar.global.odonto.security.TokenService;
import ar.global.odonto.security.TokenService.TokenEmitido;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * ZONA DE RIESGO (regla 12). Login con email y contrasena (design D6).
 *
 * <ul>
 * <li>Email inexistente, contrasena incorrecta y usuario inactivo dan el mismo error; con email inexistente se
 * verifica igual contra un hash de relleno para no revelar por tiempo si el email existe.</li>
 * <li>Uso de {@code runAsSystem}: solo la busqueda del usuario por email (contrato C-02). El resto corre en
 * {@code runAs(consultorio del usuario)}.</li>
 * <li>Auditoria {@code LOGIN} (detalle {@code {"resultado":"ok"|"fallido"}}) via {@link AuditService} para
 * usuarios existentes; el fallido se confirma en su propia transaccion antes del 401; con email inexistente solo un log de
 * aplicacion sin el email (decision Q3 de C-02: {@code audit_log.consultorio_id} es NOT NULL).</li>
 * </ul>
 */
@Service
public class LoginService {

	static final String ENTIDAD_AUDITADA = "Usuario";
	static final String RESULTADO_OK = "ok";
	static final String RESULTADO_FALLIDO = "fallido";

	private static final Logger log = LoggerFactory.getLogger(LoginService.class);

	private final UsuarioRepository usuarios;
	private final AuditService auditoria;
	private final PasswordEncoder passwordEncoder;
	private final TokenService tokens;
	private final LoginRateLimiter limiter;
	private final TransactionTemplate tx;
	private final Clock clock;
	private final String hashDeRelleno;

	public LoginService(UsuarioRepository usuarios, AuditService auditoria, PasswordEncoder passwordEncoder,
			TokenService tokens, LoginRateLimiter limiter, TransactionTemplate tx, Clock clock) {
		this.usuarios = usuarios;
		this.auditoria = auditoria;
		this.passwordEncoder = passwordEncoder;
		this.tokens = tokens;
		this.limiter = limiter;
		this.tx = tx;
		this.clock = clock;
		this.hashDeRelleno = passwordEncoder.encode(UUID.randomUUID().toString());
	}

	public LoginResponse login(String email, String password, String ip) {
		String normalizado = Usuario.normalizeEmail(email);
		String clave = LoginRateLimiter.clave(ip, normalizado);
		limiter.verificar(clave);

		Optional<Usuario> encontrado = TenantContext.runAsSystem(() -> usuarios.findByEmail(normalizado));
		if (encontrado.isEmpty()) {
			passwordEncoder.matches(password, hashDeRelleno);
			limiter.registrarFallo(clave);
			log.info("Login fallido: email no registrado");
			throw new CredencialesInvalidasException();
		}

		Usuario usuario = encontrado.get();
		Long usuarioId = usuario.getId();
		Long consultorioId = usuario.getConsultorioId();
		boolean passwordOk = passwordEncoder.matches(password, usuario.getPasswordHash());
		if (!passwordOk || !usuario.isActivo()) {
			limiter.registrarFallo(clave);
			auditar(consultorioId, usuarioId, RESULTADO_FALLIDO, ip);
			log.info("Login fallido usuarioId={}", usuarioId);
			throw new CredencialesInvalidasException();
		}

		limiter.reset(clave);
		TenantContext.runAs(consultorioId, () -> tx.execute(s -> {
			usuarios.findById(usuarioId).orElseThrow(CredencialesInvalidasException::new)
					.setUltimoLogin(clock.instant());
			registrarLogin(usuarioId, RESULTADO_OK, ip);
			return null;
		}));
		TokenEmitido token = tokens.emitir(usuarioId, consultorioId, usuario.getRol());
		return new LoginResponse(token.token(), "Bearer", token.expiresInSeconds(),
				new LoginResponse.UsuarioResumen(usuarioId, usuario.getNombre(), usuario.getRol()), consultorioId);
	}

	private void auditar(Long consultorioId, Long usuarioId, String resultado, String ip) {
		// Transaccion propia y ya confirmada cuando se lanza el 401: la excepcion no revierte esta fila. Si el
		// registro falla, el login responde 500 en lugar de 401 (fail-closed, design D2).
		TenantContext.runAs(consultorioId, () -> tx.execute(s -> {
			registrarLogin(usuarioId, resultado, ip);
			return null;
		}));
	}

	private void registrarLogin(Long usuarioId, String resultado, String ip) {
		auditoria.registrarComo(usuarioId, ip, AccionAuditoria.LOGIN, ENTIDAD_AUDITADA, usuarioId,
				DetalleAuditoria.codigo("resultado", resultado));
	}
}
