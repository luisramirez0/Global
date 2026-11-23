package ar.global.odonto.security;

import ar.global.odonto.config.AppProperties;
import ar.global.odonto.usuario.Rol;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * ZONA DE RIESGO (regla 12). Emite access tokens HS256 con claims minimos (design D1): {@code iss},
 * {@code sub} (usuario), {@code cid} (consultorio), {@code rol}, {@code iat}, {@code exp}. Nunca email,
 * nombre ni datos de salud (regla 5). Sin refresh en el MVP (decision 2026-11-23).
 */
@Service
public class TokenService {

	public static final String CLAIM_CONSULTORIO = "cid";
	public static final String CLAIM_ROL = "rol";

	private final JwtEncoder encoder;
	private final Duration expiration;
	private final Clock clock;

	public TokenService(JwtEncoder encoder, AppProperties props, Clock clock) {
		this.encoder = encoder;
		this.expiration = Duration.ofMinutes(props.jwt().expirationMin());
		this.clock = clock;
	}

	public TokenEmitido emitir(Long usuarioId, Long consultorioId, Rol rol) {
		Instant now = clock.instant();
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.issuer(JwtConfig.ISSUER)
				.subject(String.valueOf(usuarioId))
				.claim(CLAIM_CONSULTORIO, consultorioId)
				.claim(CLAIM_ROL, rol.name())
				.issuedAt(now)
				.expiresAt(now.plus(expiration))
				.build();
		String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
				.getTokenValue();
		return new TokenEmitido(token, expiration.toSeconds());
	}

	/** Token firmado y su vigencia en segundos. {@code toString} no expone el token (regla 5). */
	public record TokenEmitido(String token, long expiresInSeconds) {

		@Override
		public String toString() {
			return "TokenEmitido[token=<oculto>, expiresInSeconds=" + expiresInSeconds + "]";
		}
	}
}
