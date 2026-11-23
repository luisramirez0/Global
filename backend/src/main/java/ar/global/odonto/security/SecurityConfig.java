package ar.global.odonto.security;

import static org.springframework.security.config.Customizer.withDefaults;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * ZONA DE RIESGO (regla 12). API stateless, deny-by-default, autenticada con JWT Bearer (C-03, design D1-D4).
 *
 * <ul>
 * <li>Publicas: {@code GET /api/health}, {@code POST /api/auth/register}, {@code POST /api/auth/login} y
 * preflight {@code OPTIONS}. Todo lo demas exige token.</li>
 * <li>Rol del claim {@code rol} -> authority {@code ROLE_<rol>}; permisos con {@code @PreAuthorize} y
 * {@link Permisos}.</li>
 * <li>{@link TenantContextFilter} fija el consultorio del token despues de autenticar y lo limpia al final.</li>
 * <li>CSRF deshabilitado: el token viaja en el header {@code Authorization}, no en cookies (DD-04, decision
 * 2026-11-23). Si algun dia se usa cookie, debe reactivarse.</li>
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfig {

	static final String HEALTH_PATH = "/api/health";
	static final String REGISTER_PATH = "/api/auth/register";
	static final String LOGIN_PATH = "/api/auth/login";

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper) throws Exception {
		ProblemDetailSecurityHandler handler = new ProblemDetailSecurityHandler(mapper);
		http
				.cors(withDefaults())
				.csrf(AbstractHttpConfigurer::disable)
				.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.logout(AbstractHttpConfigurer::disable)
				.requestCache(AbstractHttpConfigurer::disable)
				.oauth2ResourceServer(o -> o
						.jwt(j -> j.jwtAuthenticationConverter(jwtAuthenticationConverter()))
						.authenticationEntryPoint(handler)
						.accessDeniedHandler(handler))
				.exceptionHandling(e -> e.authenticationEntryPoint(handler).accessDeniedHandler(handler))
				.addFilterAfter(new TenantContextFilter(handler), BearerTokenAuthenticationFilter.class)
				.authorizeHttpRequests(a -> a
						.requestMatchers(HttpMethod.GET, HEALTH_PATH).permitAll()
						.requestMatchers(HttpMethod.POST, REGISTER_PATH, LOGIN_PATH).permitAll()
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.anyRequest().authenticated());
		return http.build();
	}

	static JwtAuthenticationConverter jwtAuthenticationConverter() {
		JwtGrantedAuthoritiesConverter roles = new JwtGrantedAuthoritiesConverter();
		roles.setAuthoritiesClaimName(TokenService.CLAIM_ROL);
		roles.setAuthorityPrefix("ROLE_");
		JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
		converter.setJwtGrantedAuthoritiesConverter(roles);
		converter.setPrincipalClaimName("sub");
		return converter;
	}
}
