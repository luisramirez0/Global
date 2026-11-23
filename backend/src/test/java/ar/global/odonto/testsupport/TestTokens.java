package ar.global.odonto.testsupport;

import ar.global.odonto.security.JwtConfig;
import ar.global.odonto.security.TokenService;
import ar.global.odonto.usuario.Rol;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

/** Emite tokens para tests: validos (via {@link TokenService}), a medida o adulterados. */
@TestComponent
public class TestTokens {

	@Autowired
	private TokenService tokenService;

	@Autowired
	private JwtEncoder encoder;

	@Autowired
	private Clock clock;

	private final ObjectMapper mapper = new ObjectMapper();

	public String token(Long usuarioId, Long consultorioId, Rol rol) {
		return tokenService.emitir(usuarioId, consultorioId, rol).token();
	}

	public String bearer(Long usuarioId, Long consultorioId, Rol rol) {
		return "Bearer " + token(usuarioId, consultorioId, rol);
	}

	/** Token firmado con el secreto real y claims base (iss, sub=1, iat, exp) que el consumidor ajusta. */
	public String custom(Consumer<JwtClaimsSet.Builder> customizer) {
		Instant now = clock.instant();
		JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
				.issuer(JwtConfig.ISSUER)
				.subject("1")
				.issuedAt(now)
				.expiresAt(now.plusSeconds(600));
		customizer.accept(claims);
		return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims.build()))
				.getTokenValue();
	}

	/** Cambia un claim del payload conservando la firma original (debe ser rechazado). */
	public String tamper(String token, String claim, Object value) {
		String[] parts = token.split("\\.");
		try {
			ObjectNode payload = (ObjectNode) mapper.readTree(Base64.getUrlDecoder().decode(parts[1]));
			payload.set(claim, mapper.valueToTree(value));
			String encoded = Base64.getUrlEncoder().withoutPadding()
					.encodeToString(mapper.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8));
			return parts[0] + "." + encoded + "." + parts[2];
		}
		catch (java.io.IOException e) {
			throw new IllegalStateException(e);
		}
	}
}
