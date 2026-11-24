package ar.global.odonto.paciente.abm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import com.fasterxml.jackson.databind.ObjectMapper;
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

/** Spec patient-management "Permisos por rol sobre pacientes" (matriz KB 03, design D1). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class })
class PacienteRbacIT {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	private final ObjectMapper mapper = new ObjectMapper();

	private AuthFlows.Cuenta cuenta;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("rbac-pacientes@consultorio.test");
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private MockHttpServletResponse as(Rol rol, MockHttpServletRequestBuilder request) throws Exception {
		return mockMvc.perform(request.header("Authorization", tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), rol)))
				.andReturn().getResponse();
	}

	private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String dni) {
		String body = mapper.createObjectNode().put("nombre", "Ana").put("apellido", "Perez").put("dni", dni)
				.toString();
		return request.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private long crear(Rol rol, String dni) throws Exception {
		MockHttpServletResponse r = as(rol, json(post("/api/pacientes"), dni));
		assertThat(r.getStatus()).isEqualTo(201);
		return mapper.readTree(r.getContentAsString()).get("id").asLong();
	}

	private boolean activo(long id) throws Exception {
		return mapper.readTree(as(Rol.ADMIN, get("/api/pacientes/" + id)).getContentAsString()).get("activo")
				.asBoolean();
	}

	@ParameterizedTest
	@EnumSource(Rol.class)
	void everyRoleCreatesReadsAndUpdates(Rol rol) throws Exception {
		long id = crear(rol, "30111222");

		assertThat(as(rol, get("/api/pacientes/" + id)).getStatus()).isEqualTo(200);
		assertThat(as(rol, get("/api/pacientes")).getStatus()).isEqualTo(200);
		assertThat(as(rol, json(put("/api/pacientes/" + id), "30111222")).getStatus()).isEqualTo(200);
	}

	@Test
	void recepcionCannotDeactivateNorReactivate() throws Exception {
		long activoId = crear(Rol.RECEPCION, "30111222");
		long inactivoId = crear(Rol.ADMIN, "27000111");
		as(Rol.ADMIN, delete("/api/pacientes/" + inactivoId));

		MockHttpServletResponse baja = as(Rol.RECEPCION, delete("/api/pacientes/" + activoId));
		MockHttpServletResponse reactivar = as(Rol.RECEPCION, post("/api/pacientes/" + inactivoId + "/reactivar"));

		assertThat(baja.getStatus()).isEqualTo(403);
		assertThat(reactivar.getStatus()).isEqualTo(403);
		assertThat(activo(activoId)).isTrue();
		assertThat(activo(inactivoId)).isFalse();
	}

	@ParameterizedTest
	@EnumSource(value = Rol.class, names = { "ADMIN", "PROFESIONAL" })
	void gestionRolesDeactivateAndReactivate(Rol rol) throws Exception {
		long id = crear(rol, "30111222");

		assertThat(as(rol, delete("/api/pacientes/" + id)).getStatus()).isEqualTo(204);
		assertThat(activo(id)).isFalse();
		assertThat(as(rol, post("/api/pacientes/" + id + "/reactivar")).getStatus()).isEqualTo(204);
		assertThat(activo(id)).isTrue();
	}
}
