package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import ar.global.odonto.common.web.ApiExceptionHandler;
import ar.global.odonto.common.web.ConflictoException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Codigos de negocio de C-08 en {@code ProblemDetail} (design D4, D6, D7, D12). */
class FichaErroresHandlerTest {

	private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new ThrowingController())
			.setControllerAdvice(new ApiExceptionHandler()).build();

	private final ObjectMapper mapper = new ObjectMapper();

	private JsonNode problema(String url, int status) throws Exception {
		MockHttpServletResponse r = mockMvc.perform(get(url)).andReturn().getResponse();
		assertThat(r.getStatus()).isEqualTo(status);
		assertThat(r.getContentType()).contains("application/problem+json");
		return mapper.readTree(r.getContentAsString());
	}

	@Test
	void consentimientoRequeridoIs409WithCode() throws Exception {
		JsonNode body = problema("/t/consentimiento", 409);
		assertThat(body.get("codigo").asText()).isEqualTo("CONSENTIMIENTO_REQUERIDO");
		assertThat(body.get("instance").asText()).isEqualTo("about:blank");
	}

	@Test
	void pacienteInactivoAndFichaDesactualizadaCarryTheirCodes() throws Exception {
		assertThat(problema("/t/inactivo", 409).get("codigo").asText()).isEqualTo("PACIENTE_INACTIVO");
		assertThat(problema("/t/desactualizada", 409).get("codigo").asText()).isEqualTo("FICHA_DESACTUALIZADA");
	}

	@Test
	void conflictWithoutCodeKeepsThePreviousShape() throws Exception {
		JsonNode body = problema("/t/conflicto-sin-codigo", 409);
		assertThat(body.has("codigo")).isFalse();
		assertThat(body.get("title").asText()).isEqualTo("Límite alcanzado");
	}

	@Test
	void optimisticLockFailureIsAGeneric409() throws Exception {
		JsonNode body = problema("/t/optimistic", 409);
		assertThat(body.has("codigo")).isFalse();
		assertThat(body.toString()).doesNotContain("FichaClinica");
	}

	@Test
	void profesionalNoVinculadoIs422WithCode() throws Exception {
		assertThat(problema("/t/profesional", 422).get("codigo").asText()).isEqualTo("PROFESIONAL_NO_VINCULADO");
	}

	@RestController
	static class ThrowingController {

		@GetMapping("/t/consentimiento")
		void consentimiento() {
			throw new ConsentimientoRequeridoException();
		}

		@GetMapping("/t/inactivo")
		void inactivo() {
			throw new PacienteInactivoException();
		}

		@GetMapping("/t/desactualizada")
		void desactualizada() {
			throw new FichaDesactualizadaException();
		}

		@GetMapping("/t/conflicto-sin-codigo")
		void sinCodigo() {
			throw new ConflictoException("Límite alcanzado");
		}

		@GetMapping("/t/optimistic")
		void optimistic() {
			throw new ObjectOptimisticLockingFailureException("FichaClinica", 12L);
		}

		@GetMapping("/t/profesional")
		void profesional() {
			throw new ProfesionalNoVinculadoException();
		}
	}
}
