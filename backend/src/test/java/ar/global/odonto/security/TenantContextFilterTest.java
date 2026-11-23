package ar.global.odonto.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.common.tenant.TenantContext;
import jakarta.servlet.ServletException;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Unitario del filtro de tenant (design D2). */
class TenantContextFilterTest {

	private final AtomicReference<Long> seen = new AtomicReference<>();
	private final TenantContextFilter filter = new TenantContextFilter((req, res, ex) -> res.setStatus(401));

	@AfterEach
	void clear() {
		SecurityContextHolder.clearContext();
		TenantContext.clear();
	}

	@Test
	void setsTenantFromJwtDuringTheChainAndClearsIt() throws Exception {
		authenticate(7L);
		var response = new MockHttpServletResponse();

		filter.doFilter(new MockHttpServletRequest(), response, (req, res) -> seen.set(TenantContext.require()));

		assertThat(seen.get()).isEqualTo(7L);
		assertThat(TenantContext.get()).isEmpty();
	}

	@Test
	void clearsTenantWhenTheChainThrows() {
		authenticate(7L);

		assertThatThrownBy(() -> filter.doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(),
				(req, res) -> {
					throw new ServletException("boom");
				})).isInstanceOf(ServletException.class);
		assertThat(TenantContext.get()).isEmpty();
	}

	@Test
	void anonymousRequestPassesWithoutTenant() throws Exception {
		filter.doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(),
				(req, res) -> seen.set(TenantContext.get().orElse(null)));

		assertThat(seen.get()).isNull();
	}

	@Test
	void jwtWithoutNumericConsultorioIsRejectedWithoutCallingTheChain() throws Exception {
		Jwt jwt = Jwt.withTokenValue("t").header("alg", "HS256").subject("1").claim("cid", "siete")
				.issuedAt(Instant.now()).build();
		SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
		var response = new MockHttpServletResponse();

		filter.doFilter(new MockHttpServletRequest(), response, (req, res) -> seen.set(-1L));

		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(seen.get()).isNull();
		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
	}

	private static void authenticate(Long cid) {
		Jwt jwt = Jwt.withTokenValue("t").header("alg", "HS256").subject("1").claim("cid", cid)
				.issuedAt(Instant.now()).build();
		SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
	}
}
