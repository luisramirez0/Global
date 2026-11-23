package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.config.AppProperties;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import ar.global.odonto.usuario.Rol;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;

/** Spec authentication: "Contenido y vigencia del token" (unitario, sin Spring). */
class TokenServiceTest {

	private static final String SECRET = "test-only-jwt-secret-not-for-production-0123456789";
	private static final String OTHER_SECRET = "otro-secreto-de-prueba-distinto-0123456789-abcdef";

	private final MutableClock clock = new MutableClock(TestClockConfig.START);
	private final AppProperties props = props(SECRET);
	private final JwtEncoder encoder = new JwtConfig().jwtEncoder(props);
	private final JwtDecoder decoder = new JwtConfig().jwtDecoder(props, clock);
	private final TokenService tokens = new TokenService(encoder, props, clock);

	@Test
	void emitsMinimalClaimsWithConfiguredExpiration() {
		TokenService.TokenEmitido emitido = tokens.emitir(5L, 7L, Rol.ADMIN);

		Jwt jwt = decoder.decode(emitido.token());
		assertThat(jwt.getClaimAsString("iss")).isEqualTo(JwtConfig.ISSUER);
		assertThat(jwt.getSubject()).isEqualTo("5");
		assertThat(((Number) jwt.getClaim(TokenService.CLAIM_CONSULTORIO)).longValue()).isEqualTo(7L);
		assertThat(jwt.getClaimAsString(TokenService.CLAIM_ROL)).isEqualTo("ADMIN");
		assertThat(jwt.getIssuedAt()).isEqualTo(TestClockConfig.START);
		assertThat(jwt.getExpiresAt()).isEqualTo(TestClockConfig.START.plus(Duration.ofMinutes(30)));
		assertThat(jwt.getClaims().keySet()).containsExactlyInAnyOrder("iss", "sub", "cid", "rol", "iat", "exp");
		assertThat(emitido.expiresInSeconds()).isEqualTo(1800);
	}

	@Test
	void rejectsExpiredToken() {
		String token = tokens.emitir(5L, 7L, Rol.PROFESIONAL).token();
		clock.advance(Duration.ofMinutes(31));

		assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
	}

	@Test
	void acceptsTokenJustBeforeExpiration() {
		String token = tokens.emitir(5L, 7L, Rol.PROFESIONAL).token();
		clock.advance(Duration.ofMinutes(29));

		assertThat(decoder.decode(token).getSubject()).isEqualTo("5");
	}

	@Test
	void rejectsTokenSignedWithAnotherSecret() {
		String foreign = new TokenService(new JwtConfig().jwtEncoder(props(OTHER_SECRET)), props, clock)
				.emitir(5L, 7L, Rol.ADMIN).token();

		assertThatThrownBy(() -> decoder.decode(foreign)).isInstanceOf(JwtException.class);
	}

	@Test
	void rejectsTokenFromAnotherIssuer() {
		String token = encode(JwtClaimsSet.builder().issuer("otro-emisor").subject("5").claim("cid", 7L)
				.claim("rol", "ADMIN").issuedAt(clock.instant()).expiresAt(clock.instant().plusSeconds(600)));

		assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
	}

	@Test
	void rejectsTokenWithoutExpiration() {
		String token = encode(JwtClaimsSet.builder().issuer(JwtConfig.ISSUER).subject("5").claim("cid", 7L)
				.claim("rol", "ADMIN").issuedAt(clock.instant()));

		assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
	}

	private String encode(JwtClaimsSet.Builder claims) {
		return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims.build()))
				.getTokenValue();
	}

	private static AppProperties props(String secret) {
		return new AppProperties("http://localhost:5173", new AppProperties.Cors(List.of("http://localhost:5173")),
				new AppProperties.Jwt(secret, 30), null);
	}
}
