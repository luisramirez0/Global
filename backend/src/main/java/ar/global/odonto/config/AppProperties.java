package ar.global.odonto.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Propiedades tipadas del prefijo {@code app.*} (design D3). */
@ConfigurationProperties("app")
public record AppProperties(String baseUrl, Cors cors, Jwt jwt, DevAdmin devAdmin) {

	public record Cors(List<String> allowedOrigins) {
	}

	public record Jwt(String secret, int expirationMin) {
	}

	/**
	 * Admin del seed de desarrollo. La contrasena no tiene default y su valor nunca debe loguearse ni
	 * imprimirse: se redefine {@code toString}.
	 */
	public record DevAdmin(String email, String password) {

		@Override
		public String toString() {
			return "DevAdmin[email=<oculto>, password=<oculto>]";
		}
	}
}
