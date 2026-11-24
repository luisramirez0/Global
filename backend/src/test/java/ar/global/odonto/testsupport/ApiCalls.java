package ar.global.odonto.testsupport;


import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/** Llamadas HTTP JSON con token para los ITs de configuracion de agenda. */
@TestComponent
public class ApiCalls {

	public final ObjectMapper mapper = new ObjectMapper();

	@Autowired
	private MockMvc mockMvc;

	public MockHttpServletResponse get(String bearer, String url) throws Exception {
		return mockMvc.perform(MockMvcRequestBuilders.get(url).header("Authorization", bearer)).andReturn().getResponse();
	}

	public MockHttpServletResponse getSinToken(String url) throws Exception {
		return mockMvc.perform(MockMvcRequestBuilders.get(url)).andReturn().getResponse();
	}

	public MockHttpServletResponse post(String bearer, String url, String json) throws Exception {
		return mockMvc.perform(MockMvcRequestBuilders.post(url).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
				.content(json)).andReturn().getResponse();
	}

	public MockHttpServletResponse put(String bearer, String url, String json) throws Exception {
		return mockMvc.perform(MockMvcRequestBuilders.put(url).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
				.content(json)).andReturn().getResponse();
	}

	public MockHttpServletResponse patch(String bearer, String url, String json) throws Exception {
		return mockMvc.perform(MockMvcRequestBuilders.patch(url).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
				.content(json)).andReturn().getResponse();
	}

	public MockHttpServletResponse delete(String bearer, String url) throws Exception {
		return mockMvc.perform(MockMvcRequestBuilders.delete(url).header("Authorization", bearer)).andReturn().getResponse();
	}

	public JsonNode json(MockHttpServletResponse response) throws Exception {
		return mapper.readTree(response.getContentAsString());
	}

	/** Campos nombrados en {@code errores[].campo} de una respuesta 400/422. */
	public List<String> campos(MockHttpServletResponse response) throws Exception {
		return json(response).get("errores").findValuesAsText("campo");
	}

	/** Ids de un listado JSON (array de objetos con {@code id}). */
	public List<Long> ids(MockHttpServletResponse response) throws Exception {
		return json(response).findValues("id").stream().map(JsonNode::asLong).toList();
	}
}
