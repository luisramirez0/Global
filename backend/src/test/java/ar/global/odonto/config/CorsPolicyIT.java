package ar.global.odonto.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

class CorsPolicyIT {

	private static final String ALLOW_ORIGIN = "Access-Control-Allow-Origin";
	private static final String EXPOSE_HEADERS = "Access-Control-Expose-Headers";

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

		/** C-16: sin exponerlo, el navegador oculta {@code Retry-After} del 429 a la SPA (otro origen). */
		@Test
		void retryAfterIsExposedToAnAllowedOrigin() throws Exception {
			var res = mockMvc.perform(get("/api/health").header("Origin", "http://localhost:5173"))
					.andReturn().getResponse();
			assertThat(res.getStatus()).isEqualTo(200);
			assertThat(res.getHeader(EXPOSE_HEADERS)).isNotNull().containsIgnoringCase("Retry-After");
		}

		@Test
		void onlyRetryAfterIsExposed() throws Exception {
			var res = mockMvc.perform(get("/api/health").header("Origin", "http://localhost:5173"))
					.andReturn().getResponse();
			assertThat(res.getHeader(EXPOSE_HEADERS)).isEqualToIgnoringCase("Retry-After");
		}

		@Test
		void crossOrigin429CarriesRetryAfterReadableByTheBrowser() throws Exception {
			String body = "{\"email\":\"cors-429@consultorio.test\",\"password\":\"incorrecta\"}";
			MockHttpServletResponse res = null;
			for (int i = 0; i < 6; i++) {
				res = mockMvc.perform(post("/api/auth/login").header("Origin", "http://localhost:5173")
						.contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse();
			}
			assertThat(res.getStatus()).isEqualTo(429);
			assertThat(res.getHeader("Retry-After")).isNotBlank();
			assertThat(res.getHeader(ALLOW_ORIGIN)).isEqualTo("http://localhost:5173");
			assertThat(res.getHeader(EXPOSE_HEADERS)).containsIgnoringCase("Retry-After");
		}

		@Test
		void foreignOriginGetsNoExposedHeaders() throws Exception {
			var res = mockMvc.perform(get("/api/health").header("Origin", "http://evil.example"))
					.andReturn().getResponse();
			assertThat(res.getHeader(EXPOSE_HEADERS)).isNull();
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
