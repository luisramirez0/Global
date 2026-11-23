package ar.global.odonto.security;

import ar.global.odonto.common.tenant.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * ZONA DE RIESGO (regla 12). Fija {@link TenantContext} con el claim {@code cid} del JWT ya autenticado y lo
 * limpia SIEMPRE al terminar la request (design D2, contrato C-02). Va despues de
 * {@code BearerTokenAuthenticationFilter}, antes de cualquier {@code @Transactional}.
 *
 * <p>
 * NO es {@code @Component}: Boot lo registraria ademas como filtro de servlet fuera de la cadena de seguridad.
 * Lo instancia {@link SecurityConfig}.
 */
public class TenantContextFilter extends OncePerRequestFilter {

	private final AuthenticationEntryPoint entryPoint;

	public TenantContextFilter(AuthenticationEntryPoint entryPoint) {
		this.entryPoint = entryPoint;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		try {
			Authentication auth = SecurityContextHolder.getContext().getAuthentication();
			if (auth instanceof JwtAuthenticationToken jwtAuth) {
				Object cid = jwtAuth.getToken().getClaim(TokenService.CLAIM_CONSULTORIO);
				if (!(cid instanceof Number number) || number.longValue() <= 0) {
					// El decoder ya lo exige (JwtConfig); defensa en profundidad.
					SecurityContextHolder.clearContext();
					entryPoint.commence(request, response, new BadCredentialsException("token sin consultorio"));
					return;
				}
				TenantContext.set(number.longValue());
			}
			chain.doFilter(request, response);
		}
		finally {
			TenantContext.clear();
		}
	}
}
