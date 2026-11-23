package ar.global.odonto.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

class CorsPolicyIT {

	private static final String ALLOW_ORIGIN = "Access-Control-Allow-Origin";

	@SpringBootTest
	@AutoConfigureMockMvc
	abstract static class Base {

		@Autowired
		MockMvc mockMvc;

		MockHttpServletResponse preflight(String origin, String requestHeaders) throws Exception {
			var req = options("/api/health")
					.header("Origin", origin)
					.header("Access-Control-Request-Method", "GET");
			if (requestHeaders != null) {
				req.header("Access-Control-Request-Headers", requestHeaders);
			}
			return mockMvc.perform(req).andReturn().getResponse();
		}
	}

	@Nested
	class DefaultOrigin extends Base {

		@Test
		void allowedOriginPreflightIsAcceptedAndEchoed() throws Exception {
			var res = preflight("http://localhost:5173", null);
			assertThat(res.getStatus()).isBetween(200, 299);
			assertThat(res.getHeader(ALLOW_ORIGIN)).isEqualTo("http://localhost:5173");
		}

		@Test
		void foreignOriginPreflightIsRejectedWithoutAllowHeader() throws Exception {
			var res = preflight("http://evil.example", null);
			assertThat(res.getStatus()).isEqualTo(403);
			assertThat(res.getHeader(ALLOW_ORIGIN)).isNull();
		}

		@Test
		void authorizationAndContentTypeHeadersAreAllowed() throws Exception {
			var res = preflight("http://localhost:5173", "authorization,content-type");
			assertThat(res.getStatus()).isBetween(200, 299);
			assertThat(res.getHeader("Access-Control-Allow-Headers")).containsIgnoringCase("authorization")
					.containsIgnoringCase("content-type");
		}
	}

	@Nested
	@TestPropertySource(properties = "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173")
	class TwoOrigins extends Base {

		@Test
		void secondConfiguredOriginIsAccepted() throws Exception {
			var res = preflight("http://127.0.0.1:5173", null);
			assertThat(res.getStatus()).isBetween(200, 299);
			assertThat(res.getHeader(ALLOW_ORIGIN)).isEqualTo("http://127.0.0.1:5173");
		}

		@Test
		void unlistedOriginIsStillRejected() throws Exception {
			assertThat(preflight("http://evil.example", null).getStatus()).isEqualTo(403);
		}
	}
}
