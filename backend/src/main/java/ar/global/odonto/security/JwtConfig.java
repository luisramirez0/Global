package ar.global.odonto.security;

import ar.global.odonto.config.AppProperties;
import ar.global.odonto.usuario.Rol;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * ZONA DE RIESGO (regla 12). Firma y validacion de JWT HS256 sobre {@code JWT_SECRET} (design D1).
 * Falla al arrancar si el secreto falta o tiene menos de 32 bytes; el mensaje nunca incluye el valor.
 */
@Configuration(proxyBeanMethods = false)
public class JwtConfig {

	public static final String ISSUER = "global-odonto";
	static final int MIN_SECRET_BYTES = 32;
	static final Duration CLOCK_SKEW = Duration.ofSeconds(30);

	@Bean
	JwtEncoder jwtEncoder(AppProperties props) {
		return new NimbusJwtEncoder(new ImmutableSecret<>(secretKey(props)));
	}

	@Bean
	JwtDecoder jwtDecoder(AppProperties props, Clock clock) {
		NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey(props))
				.macAlgorithm(MacAlgorithm.HS256)
				.build();
		JwtTimestampValidator timestamps = new JwtTimestampValidator(CLOCK_SKEW);
		timestamps.setClock(clock);
		decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(timestamps, new JwtIssuerValidator(ISSUER),
				// JwtTimestampValidator acepta tokens sin exp: se exige explicitamente.
				new JwtClaimValidator<Instant>(JwtClaimNames.EXP, Objects::nonNull),
				new JwtClaimValidator<Object>(JwtClaimNames.SUB, JwtConfig::isPositiveId),
				new JwtClaimValidator<Object>(TokenService.CLAIM_CONSULTORIO, JwtConfig::isPositiveId),
				new JwtClaimValidator<Object>(TokenService.CLAIM_ROL, JwtConfig::isKnownRole)));
		return decoder;
	}

	static boolean isPositiveId(Object value) {
		if (value instanceof Number n) {
			return n.longValue() > 0;
		}
		if (value instanceof String s && s.matches("[1-9][0-9]{0,18}")) {
			return true;
		}
		return false;
	}

	static boolean isKnownRole(Object value) {
		return value instanceof String s && Arrays.stream(Rol.values()).anyMatch(r -> r.name().equals(s));
	}

	static SecretKey secretKey(AppProperties props) {
		String secret = props.jwt() == null ? null : props.jwt().secret();
		if (secret == null || secret.isBlank()) {
			throw new IllegalStateException("JWT_SECRET no esta definida: el backend no arranca sin secreto JWT.");
		}
		byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
		if (bytes.length < MIN_SECRET_BYTES) {
			throw new IllegalStateException(
					"JWT_SECRET debe tener al menos " + MIN_SECRET_BYTES + " bytes (HS256).");
		}
		return new SecretKeySpec(bytes, "HmacSHA256");
	}
}
