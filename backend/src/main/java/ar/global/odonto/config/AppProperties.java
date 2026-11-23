package ar.global.odonto.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Propiedades tipadas del prefijo {@code app.*} (design D3). */
@ConfigurationProperties("app")
public record AppProperties(String baseUrl, Cors cors, Jwt jwt) {

	public record Cors(List<String> allowedOrigins) {
	}

	public record Jwt(String secret, int expirationMin) {
	}
}
