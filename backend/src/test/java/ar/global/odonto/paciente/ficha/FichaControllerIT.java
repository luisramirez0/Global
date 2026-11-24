package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.paciente.ficha.FichaFixtures.Fila;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Spec clinical-record "Ficha y notas solo con consentimiento", "Lectura y carga de la ficha clínica", "Edición
 * concurrente de la ficha" (secuencial), "Historia clínica de pacientes dados de baja" y la auditoría de la ficha
 * (design D4, D5, D6, D8, D9, D11).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, FichaFixtures.class })
class FichaControllerIT {

	private static final String ALERGIA = "Penicilina-ALERGIA-SECRETA";

	@Autowired
	private ApiCalls api;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private FichaFixtures ficha;

	private AuthFlows.Cuenta cuenta;

	private String profesional;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("ficha@consultorio.test");
		profesional = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.PROFESIONAL);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private String url(long pacienteId) {
		return "/api/pacientes/" + pacienteId + "/ficha";
	}

	private ObjectNode body(Long version) {
		ObjectNode body = api.mapper.createObjectNode().put("alergias", ALERGIA).put("medicacionActual", "Ibuprofeno")
				.put("antecedentesMedicos", "Ninguno").put("enfermedadesRelevantes", "Hipertension")
				.put("embarazo", false).put("motivoConsulta", "Control").put("observaciones", "Sin observaciones");
		if (version == null) {
			body.putNull("version");
		}
		else {
			body.put("version", version);
		}
		return body;
	}

	private MockHttpServletResponse put(long pacienteId, ObjectNode body) throws Exception {
		return api.put(profesional, url(pacienteId), body.toString());
	}

	private long conConsentimiento() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);
		ficha.consentir(profesional, pacienteId);
		return pacienteId;
	}

	private List<Fila> auditoriaFicha() {
		return ficha.auditoriaClinica(cuenta.consultorioId()).stream().filter(f -> f.entidad().equals("FichaClinica"))
				.toList();
	}

	// --- 4.1 Sin consentimiento -------------------------------------------------------------------

	@Test
	void withoutConsentReadIs409AndNotAudited() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);

		MockHttpServletResponse r = api.get(profesional, url(pacienteId));

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(api.json(r).get("codigo").asText()).isEqualTo("CONSENTIMIENTO_REQUERIDO");
		assertThat(r.getContentAsString()).doesNotContain("Ana").doesNotContain("Perez");
		assertThat(ficha.auditoriaClinica(cuenta.consultorioId())).isEmpty();
	}

	@Test
	void withoutConsentWriteIs409AndNothingIsSaved() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);
		long otro = ficha.crearPaciente(profesional);

		MockHttpServletResponse r = put(pacienteId, body(null));

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(api.json(r).get("codigo").asText()).isEqualTo("CONSENTIMIENTO_REQUERIDO");
		assertThat(put(otro, body(null)).getStatus()).isEqualTo(409);
		assertThat(ficha.contar("ficha_clinica", pacienteId)).isZero();
		assertThat(ficha.auditoriaClinica(cuenta.consultorioId())).isEmpty();
	}

	@Test
	void consentOfAnotherPatientDoesNotEnableThisOne() throws Exception {
		conConsentimiento();
		long sinConsentimiento = ficha.crearPaciente(profesional);

		assertThat(api.get(profesional, url(sinConsentimiento)).getStatus()).isEqualTo(409);
	}

	// --- 4.2 Lectura -----------------------------------------------------------------------------

	@Test
	void fichaNotYetLoadedIs200EmptyAndTheReadIsAudited() throws Exception {
		long pacienteId = conConsentimiento();

		MockHttpServletResponse r = api.get(profesional, url(pacienteId));

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode json = api.json(r);
		assertThat(json.get("pacienteId").asLong()).isEqualTo(pacienteId);
		for (String campo : List.of("alergias", "medicacionActual", "antecedentesMedicos", "enfermedadesRelevantes",
				"embarazo", "motivoConsulta", "observaciones", "version", "actualizadaEn")) {
			assertThat(json.get(campo).isNull()).as(campo).isTrue();
		}
		assertThat(auditoriaFicha())
				.containsExactly(new Fila(cuenta.usuarioId(), "READ", "FichaClinica", pacienteId, null));
	}

	@Test
	void loadedFichaIsReturnedAndEachReadIsAudited() throws Exception {
		long pacienteId = conConsentimiento();
		put(pacienteId, body(null));

		JsonNode json = api.json(api.get(profesional, url(pacienteId)));
		api.get(profesional, url(pacienteId));

		assertThat(json.get("alergias").asText()).isEqualTo(ALERGIA);
		assertThat(json.get("embarazo").asBoolean()).isFalse();
		assertThat(json.get("version").asLong()).isZero();
		assertThat(auditoriaFicha()).extracting(Fila::accion).containsExactly("CREATE", "READ", "READ");
	}

	@Test
	void inactivePatientFichaCanStillBeRead() throws Exception {
		long pacienteId = conConsentimiento();
		put(pacienteId, body(null));
		ficha.darDeBaja(profesional, pacienteId);

		MockHttpServletResponse r = api.get(profesional, url(pacienteId));

		assertThat(r.getStatus()).isEqualTo(200);
		assertThat(api.json(r).get("alergias").asText()).isEqualTo(ALERGIA);
	}

	// --- 4.3 Carga y modificacion ----------------------------------------------------------------

	@Test
	void firstLoadCreatesVersion0AndIsAuditedAsCreate() throws Exception {
		long pacienteId = conConsentimiento();

		MockHttpServletResponse r = put(pacienteId, body(null));

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode json = api.json(r);
		assertThat(json.get("version").asLong()).isZero();
		assertThat(json.get("alergias").asText()).isEqualTo(ALERGIA);
		long fichaId = ((Number) ficha.filaFicha(pacienteId).get("ID")).longValue();
		assertThat(auditoriaFicha()).containsExactly(new Fila(cuenta.usuarioId(), "CREATE", "FichaClinica",
				pacienteId, "{\"fichaId\":" + fichaId + ",\"version\":0}"));
		assertThat(auditoriaFicha().get(0).detalle()).doesNotContain(ALERGIA);
	}

	@Test
	void updateReplacesAllFieldsBumpsVersionAndIsAuditedAsUpdate() throws Exception {
		long pacienteId = conConsentimiento();
		put(pacienteId, body(null));
		ObjectNode cambio = body(0L);
		cambio.putNull("medicacionActual");
		cambio.put("observaciones", "   ");

		MockHttpServletResponse r = put(pacienteId, cambio);

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode json = api.json(r);
		assertThat(json.get("version").asLong()).isEqualTo(1);
		assertThat(json.get("medicacionActual").isNull()).isTrue();
		assertThat(json.get("observaciones").isNull()).isTrue();
		assertThat(json.get("alergias").asText()).isEqualTo(ALERGIA);
		assertThat(auditoriaFicha()).extracting(Fila::accion).containsExactly("CREATE", "UPDATE");
		assertThat(auditoriaFicha().get(1).detalle()).endsWith("\"version\":1}");
	}

	@Test
	void staleVersionIs409AndTheFichaDoesNotChange() throws Exception {
		long pacienteId = conConsentimiento();
		put(pacienteId, body(null));
		// Cambia un campo: sin cambios Hibernate no actualiza la fila y la version no avanza.
		assertThat(api.json(put(pacienteId, body(0L).put("motivoConsulta", "Dolor"))).get("version").asLong())
				.isEqualTo(1);

		MockHttpServletResponse r = put(pacienteId, body(0L).put("alergias", "otra"));

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(api.json(r).get("codigo").asText()).isEqualTo("FICHA_DESACTUALIZADA");
		assertThat(api.json(api.get(profesional, url(pacienteId))).get("alergias").asText()).isEqualTo(ALERGIA);
		assertThat(auditoriaFicha()).extracting(Fila::accion).containsExactly("CREATE", "UPDATE", "READ");
	}

	@Test
	void nullVersionWhenTheFichaExistsIs409() throws Exception {
		long pacienteId = conConsentimiento();
		put(pacienteId, body(null));

		MockHttpServletResponse r = put(pacienteId, body(null));

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(api.json(r).get("codigo").asText()).isEqualTo("FICHA_DESACTUALIZADA");
	}

	@Test
	void versionWhenThereIsNoFichaIs409AndNothingIsCreated() throws Exception {
		long pacienteId = conConsentimiento();

		MockHttpServletResponse r = put(pacienteId, body(0L));

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(ficha.contar("ficha_clinica", pacienteId)).isZero();
		assertThat(auditoriaFicha()).isEmpty();
	}

	// --- 4.5 Validacion y paciente inactivo ------------------------------------------------------

	@Test
	void fieldOf4001CharactersIs400WithoutEcho() throws Exception {
		long pacienteId = conConsentimiento();
		String largo = "Z".repeat(3990) + "-FIN-SECRETO";

		MockHttpServletResponse r = put(pacienteId, body(null).put("antecedentesMedicos", largo));

		assertThat(largo).hasSize(4002);
		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(api.campos(r)).containsExactly("antecedentesMedicos");
		assertThat(r.getContentAsString()).doesNotContain("FIN-SECRETO");
		assertThat(ficha.contar("ficha_clinica", pacienteId)).isZero();
	}

	@Test
	void fieldOfExactly4000CharactersIsAccepted() throws Exception {
		long pacienteId = conConsentimiento();

		MockHttpServletResponse r = put(pacienteId, body(null).put("observaciones", "ñ".repeat(4000)));

		assertThat(r.getStatus()).isEqualTo(200);
		assertThat(api.json(r).get("observaciones").asText()).hasSize(4000);
	}

	@Test
	void inactivePatientFichaCannotBeWritten() throws Exception {
		long pacienteId = conConsentimiento();
		ficha.darDeBaja(profesional, pacienteId);

		MockHttpServletResponse r = put(pacienteId, body(null));

		assertThat(r.getStatus()).isEqualTo(409);
		assertThat(api.json(r).get("codigo").asText()).isEqualTo("PACIENTE_INACTIVO");
		assertThat(ficha.contar("ficha_clinica", pacienteId)).isZero();
	}

	@Test
	void unknownPatientIs404() throws Exception {
		assertThat(api.get(profesional, url(999_999)).getStatus()).isEqualTo(404);
		assertThat(put(999_999, body(null)).getStatus()).isEqualTo(404);
		assertThat(ficha.auditoriaClinica(cuenta.consultorioId())).isEmpty();
	}
}
