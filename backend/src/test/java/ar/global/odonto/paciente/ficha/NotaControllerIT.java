package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.paciente.ficha.FichaFixtures.Fila;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec clinical-record "Notas clínicas inmutables" y la auditoría de notas (design D2, D7, D8, D9, D11). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, FichaFixtures.class,
		DomainFixtures.class, TestClockConfig.class })
class NotaControllerIT {

	private static final String TEXTO = "Evolucion: caries en pieza 16 TEXTO-CLINICO-SECRETO";

	@Autowired
	private ApiCalls api;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private FichaFixtures ficha;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private MutableClock clock;

	private AuthFlows.Cuenta cuenta;

	private String profesional;

	private Long profesionalId;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		clock.set(TestClockConfig.START);
		cuenta = auth.registrar("notas@consultorio.test");
		profesional = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.PROFESIONAL);
		profesionalId = jdbc.queryForObject("SELECT id FROM profesional WHERE usuario_id = ?", Long.class,
				cuenta.usuarioId());
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
		clock.set(TestClockConfig.START);
	}

	private String url(long pacienteId) {
		return "/api/pacientes/" + pacienteId + "/notas";
	}

	private ObjectNode nota(String texto) {
		return api.mapper.createObjectNode().put("texto", texto);
	}

	private MockHttpServletResponse crear(String bearer, long pacienteId, ObjectNode body) throws Exception {
		return api.post(bearer, url(pacienteId), body.toString());
	}

	private long conConsentimiento() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);
		ficha.consentir(profesional, pacienteId);
		return pacienteId;
	}

	private List<Fila> auditoriaNotas() {
		return ficha.auditoriaClinica(cuenta.consultorioId()).stream().filter(f -> f.entidad().equals("NotaClinica"))
				.toList();
	}

	// --- 5.1 Alta ---------------------------------------------------------------------------------

	@Test
	void noteTakesTheLinkedProfessionalAndServerTimeAndIsAudited() throws Exception {
		long pacienteId = conConsentimiento();

		MockHttpServletResponse r = crear(profesional, pacienteId, nota(TEXTO));

		assertThat(r.getStatus()).isEqualTo(201);
		JsonNode json = api.json(r);
		assertThat(json.get("profesionalId").asLong()).isEqualTo(profesionalId);
		assertThat(json.get("fecha").asText()).isEqualTo(TestClockConfig.START.toString());
		assertThat(json.get("texto").asText()).isEqualTo(TEXTO);
		assertThat(json.get("turnoId").isNull()).isTrue();
		long notaId = json.get("id").asLong();
		assertThat(auditoriaNotas()).containsExactly(new Fila(cuenta.usuarioId(), "CREATE", "NotaClinica", pacienteId,
				"{\"notaId\":" + notaId + "}"));
	}

	@Test
	void noteWithATurnoOfTheConsultorioKeepsItAndAuditsIt() throws Exception {
		long pacienteId = conConsentimiento();
		Long turnoId = domain.seed(cuenta.consultorioId(), "t1").turno().getId();

		MockHttpServletResponse r = crear(profesional, pacienteId, nota(TEXTO).put("turnoId", turnoId));

		assertThat(r.getStatus()).isEqualTo(201);
		JsonNode json = api.json(r);
		assertThat(json.get("turnoId").asLong()).isEqualTo(turnoId);
		assertThat(auditoriaNotas().get(0).detalle())
				.isEqualTo("{\"notaId\":" + json.get("id").asLong() + ",\"turnoId\":" + turnoId + "}");
	}

	@Test
	void turnoOfAnotherConsultorioOrUnknownIs422AndNothingIsSaved() throws Exception {
		long pacienteId = conConsentimiento();
		AuthFlows.Cuenta otra = auth.registrar("notas-otro@consultorio.test");
		Long turnoAjeno = domain.seed(otra.consultorioId(), "t2").turno().getId();

		MockHttpServletResponse ajeno = crear(profesional, pacienteId, nota(TEXTO).put("turnoId", turnoAjeno));
		MockHttpServletResponse inexistente = crear(profesional, pacienteId, nota(TEXTO).put("turnoId", 999_999));

		assertThat(ajeno.getStatus()).isEqualTo(422);
		assertThat(api.campos(ajeno)).containsExactly("turnoId");
		assertThat(inexistente.getStatus()).isEqualTo(422);
		assertThat(ficha.contar("nota_clinica", pacienteId)).isZero();
		assertThat(auditoriaNotas()).isEmpty();
	}

	// --- 5.2 Rechazos ----------------------------------------------------------------------------

	@Test
	void adminWithoutLinkedProfessionalIs422() throws Exception {
		long pacienteId = conConsentimiento();
		Long adminId = ficha.usuarioSinProfesional(cuenta.consultorioId(), "admin2@consultorio.test", Rol.ADMIN);
		String admin = tokens.bearer(adminId, cuenta.consultorioId(), Rol.ADMIN);

		MockHttpServletResponse r = crear(admin, pacienteId, nota(TEXTO));

		assertThat(r.getStatus()).isEqualTo(422);
		assertThat(api.json(r).get("codigo").asText()).isEqualTo("PROFESIONAL_NO_VINCULADO");
		assertThat(ficha.contar("nota_clinica", pacienteId)).isZero();
		assertThat(auditoriaNotas()).isEmpty();
	}

	@Test
	void inactiveLinkedProfessionalIs422() throws Exception {
		long pacienteId = conConsentimiento();
		jdbc.update("UPDATE profesional SET activo = FALSE WHERE id = ?", profesionalId);

		MockHttpServletResponse r = crear(profesional, pacienteId, nota(TEXTO));

		assertThat(r.getStatus()).isEqualTo(422);
		assertThat(api.json(r).get("codigo").asText()).isEqualTo("PROFESIONAL_NO_VINCULADO");
	}

	@Test
	void withoutConsentCreateAndListAre409() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);

		MockHttpServletResponse alta = crear(profesional, pacienteId, nota(TEXTO));
		MockHttpServletResponse lista = api.get(profesional, url(pacienteId));

		assertThat(alta.getStatus()).isEqualTo(409);
		assertThat(api.json(alta).get("codigo").asText()).isEqualTo("CONSENTIMIENTO_REQUERIDO");
		assertThat(lista.getStatus()).isEqualTo(409);
		assertThat(api.json(lista).get("codigo").asText()).isEqualTo("CONSENTIMIENTO_REQUERIDO");
		assertThat(ficha.auditoriaClinica(cuenta.consultorioId())).isEmpty();
	}

	@Test
	void inactivePatientCannotReceiveNotesButTheyCanBeListed() throws Exception {
		long pacienteId = conConsentimiento();
		crear(profesional, pacienteId, nota(TEXTO));
		ficha.darDeBaja(profesional, pacienteId);

		MockHttpServletResponse alta = crear(profesional, pacienteId, nota("otra"));

		assertThat(alta.getStatus()).isEqualTo(409);
		assertThat(api.json(alta).get("codigo").asText()).isEqualTo("PACIENTE_INACTIVO");
		assertThat(api.get(profesional, url(pacienteId)).getStatus()).isEqualTo(200);
	}

	@Test
	void emptyOrTooLongTextIs400WithoutEcho() throws Exception {
		long pacienteId = conConsentimiento();
		String largo = "x".repeat(9990) + "-SECRETO-LARGO";

		MockHttpServletResponse vacio = crear(profesional, pacienteId, nota("   "));
		MockHttpServletResponse excedido = crear(profesional, pacienteId, nota(largo));
		MockHttpServletResponse limite = crear(profesional, pacienteId, nota("y".repeat(10_000)));

		assertThat(largo).hasSize(10_004);
		assertThat(vacio.getStatus()).isEqualTo(400);
		assertThat(excedido.getStatus()).isEqualTo(400);
		assertThat(api.campos(excedido)).containsExactly("texto");
		assertThat(excedido.getContentAsString()).doesNotContain("SECRETO-LARGO");
		assertThat(limite.getStatus()).isEqualTo(201);
		assertThat(auditoriaNotas()).hasSize(1);
	}

	// --- 5.3 Listado -----------------------------------------------------------------------------

	@Test
	void listIsPagedNewestFirstCappedAt100AndAudited() throws Exception {
		long pacienteId = conConsentimiento();
		List<Long> creadas = new ArrayList<>();
		for (int i = 0; i < 25; i++) {
			clock.advance(Duration.ofMinutes(1));
			creadas.add(api.json(crear(profesional, pacienteId, nota("nota " + i))).get("id").asLong());
		}

		MockHttpServletResponse r = api.get(profesional, url(pacienteId) + "?size=1000");

		assertThat(r.getStatus()).isEqualTo(200);
		JsonNode json = api.json(r);
		assertThat(json.get("tamanio").asInt()).isEqualTo(100);
		assertThat(json.get("totalElementos").asLong()).isEqualTo(25);
		List<Long> ids = new ArrayList<>();
		json.get("contenido").forEach(n -> ids.add(n.get("id").asLong()));
		Collections.reverse(creadas);
		assertThat(ids).containsExactlyElementsOf(creadas);
		assertThat(auditoriaNotas().get(auditoriaNotas().size() - 1))
				.isEqualTo(new Fila(cuenta.usuarioId(), "READ", "NotaClinica", pacienteId, null));
	}

	@Test
	void defaultPageSizeIs20() throws Exception {
		long pacienteId = conConsentimiento();
		for (int i = 0; i < 21; i++) {
			crear(profesional, pacienteId, nota("nota " + i));
		}

		JsonNode json = api.json(api.get(profesional, url(pacienteId) + "?size=0"));

		assertThat(json.get("tamanio").asInt()).isEqualTo(20);
		assertThat(json.get("contenido")).hasSize(20);
		assertThat(json.get("totalPaginas").asInt()).isEqualTo(2);
	}

	// --- 5.4 Inmutables --------------------------------------------------------------------------

	@Test
	void notesCannotBeEditedOrDeleted() throws Exception {
		long pacienteId = conConsentimiento();
		long notaId = api.json(crear(profesional, pacienteId, nota(TEXTO))).get("id").asLong();
		String urlNota = url(pacienteId) + "/" + notaId;

		int put = api.put(profesional, urlNota, nota("modificada").toString()).getStatus();
		int delete = api.delete(profesional, urlNota).getStatus();
		int putColeccion = api.put(profesional, url(pacienteId), nota("modificada").toString()).getStatus();

		assertThat(put).isIn(404, 405);
		assertThat(delete).isIn(404, 405);
		assertThat(putColeccion).isIn(404, 405);
		String texto = jdbc.queryForObject("SELECT texto FROM nota_clinica WHERE id = ?", String.class, notaId);
		assertThat(texto).isEqualTo(TEXTO);
		assertThat(ficha.contar("nota_clinica", pacienteId)).isEqualTo(1);
	}
}
