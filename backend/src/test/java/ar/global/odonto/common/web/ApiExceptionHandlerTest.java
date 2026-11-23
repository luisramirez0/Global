package ar.global.odonto.common.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import ar.global.odonto.common.tenant.TenantNotSetException;
import ar.global.odonto.consultorio.registro.EmailYaRegistradoException;
import ar.global.odonto.security.DemasiadosIntentosException;
import ar.global.odonto.usuario.auth.CredencialesInvalidasException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Spec access-control "Errores homogéneos sin datos personales" (design D3). */
class ApiExceptionHandlerTest {

	private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new ThrowingController())
			.setControllerAdvice(new ApiExceptionHandler())
			.build();

	private final ObjectMapper mapper = new ObjectMapper();

	@Test
	void validationErrorNamesFieldsWithoutValues() throws Exception {
		var response = mockMvc.perform(post("/t/validacion").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"x@\",\"nombre\":\"\"}")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(400);
		assertProblem(response);
		JsonNode body = mapper.readTree(response.getContentAsString());
		assertThat(body.get("errores").findValuesAsText("campo")).containsExactlyInAnyOrder("email", "nombre");
		assertThat(response.getContentAsString()).doesNotContain("x@");
	}

	@Test
	void malformedJsonIs400WithoutEcho() throws Exception {
		var response = mockMvc.perform(post("/t/validacion").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\": secreto-sin-comillas")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(400);
		assertThat(response.getContentAsString()).doesNotContain("secreto-sin-comillas");
	}

	@Test
	void duplicateEmailIs409() throws Exception {
		var response = mockMvc.perform(get("/t/409")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(409);
		assertProblem(response);
	}

	@Test
	void invalidCredentialsIs401WithBearerChallenge() throws Exception {
		var response = mockMvc.perform(get("/t/401")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(response.getHeader("WWW-Authenticate")).isEqualTo("Bearer");
		assertProblem(response);
	}

	@Test
	void accessDeniedIs403() throws Exception {
		var response = mockMvc.perform(get("/t/403")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(403);
		assertProblem(response);
	}

	@Test
	void tooManyAttemptsIs429WithRetryAfter() throws Exception {
		var response = mockMvc.perform(get("/t/429")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(429);
		assertThat(response.getHeader("Retry-After")).isEqualTo("120");
		assertProblem(response);
	}

	@Test
	void missingTenantIsGeneric500WithoutTrace() throws Exception {
		var response = mockMvc.perform(get("/t/sin-tenant")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(500);
		assertProblem(response);
		assertThat(response.getContentAsString()).doesNotContain("Tenant").doesNotContain("Exception")
				.doesNotContain("at ar.global");
	}

	@Test
	void unexpectedErrorIs500WithoutMessage() throws Exception {
		var response = mockMvc.perform(get("/t/500")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(500);
		assertThat(response.getContentAsString()).doesNotContain("ana@consultorio.test");
	}

	private static void assertProblem(MockHttpServletResponse response) {
		assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
	}

	record Body(@NotBlank @Email String email, @NotBlank String nombre) {
	}

	@RestController
	static class ThrowingController {

		@PostMapping("/t/validacion")
		void validacion(@Valid @RequestBody Body body) {
		}

		@GetMapping("/t/409")
		void conflict() {
			throw new EmailYaRegistradoException();
		}

		@GetMapping("/t/401")
		void unauthorized() {
			throw new CredencialesInvalidasException();
		}

		@GetMapping("/t/403")
		void forbidden() {
			throw new AccessDeniedException("denegado");
		}

		@GetMapping("/t/429")
		void tooMany() {
			throw new DemasiadosIntentosException(120);
		}

		@GetMapping("/t/sin-tenant")
		void noTenant() {
			throw new CannotCreateTransactionException("no tx", new TenantNotSetException());
		}

		@GetMapping("/t/500")
		void boom() {
			throw new IllegalStateException("fallo con ana@consultorio.test");
		}
	}
}
