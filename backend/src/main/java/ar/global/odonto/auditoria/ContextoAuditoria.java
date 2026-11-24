package ar.global.odonto.auditoria;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Usuario e IP de la request en curso para la auditoria (design D5).
 *
 * <ul>
 * <li>Usuario: {@code sub} del JWT autenticado; {@code null} si no hay token (procesos internos). No se consulta
 * la base: la FK compuesta {@code (consultorio_id, usuario_id)} rechaza un usuario ajeno al tenant.</li>
 * <li>IP: solo {@code getRemoteAddr()}. {@code X-Forwarded-For}/{@code Forwarded} NO se interpretan (los
 * falsifica el cliente); con proxy de confianza (C-16) se activa {@code server.forward-headers-strategy}, que
 * reescribe {@code getRemoteAddr()} sin tocar este codigo.</li>
 * </ul>
 */
@Component
public class ContextoAuditoria {

	static final int IP_MAX = 45;

	public Long usuarioId() {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth instanceof JwtAuthenticationToken jwt && jwt.getToken().getSubject() != null) {
			return Long.valueOf(jwt.getToken().getSubject());
		}
		return null;
	}

	public String ip() {
		RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
		if (attrs instanceof ServletRequestAttributes servlet) {
			return ip(servlet.getRequest());
		}
		return null;
	}

	/** Mismo resolutor para el log de auditoria y el rate limiter del login. */
	public static String ip(HttpServletRequest request) {
		String ip = request.getRemoteAddr();
		if (ip == null) {
			return null;
		}
		return ip.length() > IP_MAX ? ip.substring(0, IP_MAX) : ip;
	}
}
