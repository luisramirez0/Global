package ar.global.odonto.security;

import static org.springframework.security.config.Customizer.withDefaults;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

/**
 * Linea base de seguridad (ZONA DE RIESGO, regla 12): API stateless, deny-by-default.
 * C-03 extiende esta clase con autenticacion JWT/RBAC.
 */
@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

	static final String HEALTH_PATH = "/api/health";

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
				// CSRF deshabilitado: API stateless sin cookies de sesion (DD-04).
				// Si C-03 adopta cookie HttpOnly, debe reactivarse.
				.cors(withDefaults())
				.csrf(AbstractHttpConfigurer::disable)
				.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
				.authorizeHttpRequests(a -> a
						.requestMatchers(HttpMethod.GET, HEALTH_PATH).permitAll()
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.anyRequest().authenticated());
		return http.build();
	}
}
