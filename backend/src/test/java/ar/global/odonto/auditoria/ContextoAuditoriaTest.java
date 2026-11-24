package ar.global.odonto.auditoria;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Spec audit-log "IP del cliente en el registro" y usuario del token (design D5). Sin contexto Spring. */
class ContextoAuditoriaTest {

	private final ContextoAuditoria contexto = new ContextoAuditoria();

	@AfterEach
	void clean() {
		SecurityContextHolder.clearContext();
		RequestContextHolder.resetRequestAttributes();
	}

	@Test
	void userComesFromTheJwtSubject() {
		autenticar("5");

		assertThat(contexto.usuarioId()).isEqualTo(5L);
	}

	@Test
	void anotherSubjectGivesAnotherUser() {
		autenticar("42");

		assertThat(contexto.usuarioId()).isEqualTo(42L);
	}

	@Test
	void withoutAuthenticationUserIsNull() {
		assertThat(contexto.usuarioId()).isNull();
	}

	@Test
	void nonJwtAuthenticationGivesNullUser() {
		SecurityContextHolder.getContext()
				.setAuthentication(new UsernamePasswordAuthenticationToken("x", "y", List.of()));

		assertThat(contexto.usuarioId()).isNull();
	}

	@Test
	void ipIsTheSocketAddressAndForwardedHeaderIsIgnored() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr("203.0.113.7");
		request.addHeader("X-Forwarded-For", "198.51.100.9");
		request.addHeader("Forwarded", "for=198.51.100.9");
		RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

		assertThat(contexto.ip()).isEqualTo("203.0.113.7");
		assertThat(ContextoAuditoria.ip(request)).isEqualTo("203.0.113.7");
	}

	@Test
	void anotherSocketAddressIsReportedAsIs() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr("10.1.2.3");
		RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

		assertThat(contexto.ip()).isEqualTo("10.1.2.3");
	}

	@Test
	void withoutRequestIpIsNull() {
		assertThat(contexto.ip()).isNull();
	}

	@Test
	void ipLongerThan45CharactersIsTrimmed() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr("1".repeat(60));
		RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

		assertThat(contexto.ip()).hasSize(45);
	}

	private static void autenticar(String subject) {
		Instant now = Instant.parse("2026-11-23T13:00:00Z");
		Jwt jwt = new Jwt("t", now, now.plusSeconds(60), Map.of("alg", "HS256"), Map.of("sub", subject));
		SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
	}
}
