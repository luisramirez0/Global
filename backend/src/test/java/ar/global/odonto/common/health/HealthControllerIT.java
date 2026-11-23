package ar.global.odonto.common.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class HealthControllerIT {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void healthIsPublicAndReturnsExactlyStatusUp() throws Exception {
		mockMvc.perform(get("/api/health"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(content().json("{\"status\":\"UP\"}", true));
	}

	@Test
	void healthRejectsNonGetMethodsWithoutCreatingASession() throws Exception {
		var result = mockMvc.perform(post("/api/health")).andReturn();
		assertThat(result.getResponse().getStatus()).isBetween(400, 499);
		assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
				.noneMatch(c -> c.contains("JSESSIONID"));
	}
}
