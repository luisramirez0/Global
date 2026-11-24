package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/** Spec clinical-record "Historia clínica restringida por rol y consultorio": roles (design D1). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, FichaFixtures.class })
class FichaRbacIT {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private FichaFixtures ficha;

	private AuthFlows.Cuenta cuenta;

	private long pacienteId;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("rbac-ficha@consultorio.test");
		String admin = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.ADMIN);
		pacienteId = ficha.crearPaciente(admin);
		ficha.consentir(admin, pacienteId);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	/** Los siete endpoints de C-08. */
	private List<MockHttpServletRequestBuilder> endpoints() {
		String base = "/api/pacientes/" + pacienteId;
		return List.of(MockMvcRequestBuilders.get(base + "/ficha"),
				json(MockMvcRequestBuilders.put(base + "/ficha"), "{\"alergias\":\"x\",\"version\":null}"),
				json(MockMvcRequestBuilders.post(base + "/notas"), "{\"texto\":\"nota\"}"),
				MockMvcRequestBuilders.get(base + "/notas"),
				json(MockMvcRequestBuilders.post(base + "/consentimientos"), "{\"versionTexto\":\"v1\"}"),
				MockMvcRequestBuilders.get(base + "/consentimientos"),
				MockMvcRequestBuilders.get("/api/consentimientos/texto-vigente"));
	}

	private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, String body) {
		return b.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private int status(MockHttpServletRequestBuilder request, String bearer) throws Exception {
		if (bearer != null) {
			request.header("Authorization", bearer);
		}
		MockHttpServletResponse r = mockMvc.perform(request).andReturn().getResponse();
		return r.getStatus();
	}

	@Test
	void recepcionGets403OnEveryEndpointAndNothingIsAudited() throws Exception {
		int antes = ficha.totalAuditoriaClinica();
		String recepcion = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.RECEPCION);

		for (MockHttpServletRequestBuilder endpoint : endpoints()) {
			assertThat(status(endpoint, recepcion)).isEqualTo(403);
		}
		assertThat(ficha.totalAuditoriaClinica()).isEqualTo(antes);
		assertThat(ficha.contar("ficha_clinica", pacienteId)).isZero();
		assertThat(ficha.contar("nota_clinica", pacienteId)).isZero();
	}

	@Test
	void withoutTokenEveryEndpointIs401() throws Exception {
		for (MockHttpServletRequestBuilder endpoint : endpoints()) {
			assertThat(status(endpoint, null)).isEqualTo(401);
		}
	}

	@ParameterizedTest
	@EnumSource(value = Rol.class, names = { "ADMIN", "PROFESIONAL" })
	void adminAndProfesionalReachEveryEndpoint(Rol rol) throws Exception {
		String bearer = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), rol);

		for (MockHttpServletRequestBuilder endpoint : endpoints()) {
			assertThat(status(endpoint, bearer)).isIn(200, 201);
		}
	}
}
