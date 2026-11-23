package ar.global.odonto.config;

import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/** Politica CORS: solo origenes configurados (nunca {@code *}), sin credenciales (DD-04). */
@Configuration(proxyBeanMethods = false)
public class CorsConfig {

	private static final List<String> METHODS = List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
	private static final List<String> HEADERS = List.of("Authorization", "Content-Type");
	private static final long MAX_AGE_SECONDS = 3600;

	@Bean
	CorsConfigurationSource corsConfigurationSource(AppProperties props) {
		CorsConfiguration cfg = new CorsConfiguration();
		cfg.setAllowedOrigins(props.cors().allowedOrigins());
		cfg.setAllowedMethods(METHODS);
		cfg.setAllowedHeaders(HEADERS);
		cfg.setAllowCredentials(false);
		cfg.setMaxAge(MAX_AGE_SECONDS);
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", cfg);
		return source;
	}
}
