package ar.global.odonto.agenda.turno;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Spec appointment-scheduling por HTTP (C-07 tareas 5.1-5.3). Datos creados por la API: el registro da un
 * profesional y "Sillon 1"; se agregan una prestacion de 30 min, una franja lunes 09-13 local y un paciente.
 * Lunes 2026-12-07: 10:00 hora de Buenos Aires = 13:00Z.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class })
class TurnoControllerIT {

	private static final String URL = "/api/turnos";
	private static final String APELLIDO = "Apellidosecreto";
	private static final String DNI = "30111222";

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private JdbcTemplate jdbc;

	private String bearer;
	private long sillonId;
	private long profesionalId;
	private long prestacionId;
	private long pacienteId;

	/** Hora local de Buenos Aires (UTC-3) del lunes 2026-12-07 como instante UTC. */
	private static String lunes(String horaLocal) {
		int h = Integer.parseInt(horaLocal.substring(0, 2)) + 3;
		return "2026-12-07T" + String.format("%02d", h) + horaLocal.substring(2) + ":00Z";
	}

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		AuthFlows.Cuenta cuenta = auth.registrar("turnos@a.test");
		bearer = auth.bearer(cuenta.email());
		sillonId = api.ids(api.get(bearer, "/api/sillones")).get(0);
		prestacionId = id(api.post(bearer, "/api/prestaciones", "{\"nombre\":\"Consulta\",\"duracionMinutos\":30}"));
		MockHttpServletResponse horario = api.post(bearer, "/api/horarios-atencion",
				"{\"diaSemana\":1,\"horaDesde\":\"09:00\",\"horaHasta\":\"13:00\"}");
		assertThat(horario.getStatus()).isEqualTo(201);
		profesionalId = api.json(horario).get("profesionalId").asLong();
		pacienteId = id(api.post(bearer, "/api/pacientes",
				"{\"nombre\":\"Ana\",\"apellido\":\"" + APELLIDO + "\",\"dni\":\"" + DNI + "\"}"));
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private long id(MockHttpServletResponse r) throws Exception {
		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(201);
		return api.json(r).get("id").asLong();
	}

	private String alta(String horaLocal, String extra) {
		return "{\"pacienteId\":" + pacienteId + ",\"prestacionId\":" + prestacionId + ",\"sillonId\":" + sillonId
				+ ",\"inicio\":\"" + lunes(horaLocal) + "\"" + (extra == null ? "" : "," + extra) + "}";
	}

	private MockHttpServletResponse crear(String horaLocal) throws Exception {
		return api.post(bearer, URL, alta(horaLocal, null));
	}

	/** Ids de primer nivel del listado ({@code ApiCalls.ids} tambien levantaria {@code paciente.id}/{@code prestacion.id}). */
	private java.util.List<Long> idsTurnos(MockHttpServletResponse r) throws Exception {
		java.util.List<Long> ids = new java.util.ArrayList<>();
		api.json(r).forEach(t -> ids.add(t.get("id").asLong()));
		return ids;
	}

	private long auditoriaTurnos() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM audit_log WHERE entidad = 'Turno'", Long.class);
	}

	private static void sinDatosDelPaciente(MockHttpServletResponse r) throws Exception {
		assertThat(r.getContentAsString()).doesNotContain(APELLIDO, DNI, "Ana");
	}

	private static void instanceNeutro(MockHttpServletResponse r, ApiCalls api) throws Exception {
		assertThat(api.json(r).get("instance").asText()).isEqualTo("about:blank");
	}

	// --- 5.1 alta -----------------------------------------------------------------------------

	@Nested
	class Alta {

		@Test
		void createdTurnoIs201WithLocationAndDto() throws Exception {
			MockHttpServletResponse r = crear("10:00");

			assertThat(r.getStatus()).isEqualTo(201);
			JsonNode body = api.json(r);
			assertThat(r.getHeader("Location")).isEqualTo(URL + "/" + body.get("id").asLong());
			assertThat(body.get("inicio").asText()).isEqualTo("2026-12-07T13:00:00Z");
			assertThat(body.get("fin").asText()).isEqualTo("2026-12-07T13:30:00Z");
			assertThat(body.get("estado").asText()).isEqualTo("PROGRAMADO");
			assertThat(body.get("sobreturno").asBoolean()).isFalse();
			assertThat(body.get("sillonId").asLong()).isEqualTo(sillonId);
			assertThat(body.get("profesionalId").asLong()).isEqualTo(profesionalId);
			assertThat(body.get("paciente").get("id").asLong()).isEqualTo(pacienteId);
			assertThat(body.get("paciente").get("apellido").asText()).isEqualTo(APELLIDO);
			assertThat(body.get("prestacion").get("id").asLong()).isEqualTo(prestacionId);
			assertThat(body.has("consultorioId")).isFalse();
			assertThat(body.has("version")).isFalse();
		}

		@Test
		void finSentByTheClientIsIgnored() throws Exception {
			MockHttpServletResponse r = api.post(bearer, URL, alta("10:00", "\"fin\":\"" + lunes("12:00") + "\""));

			assertThat(r.getStatus()).isEqualTo(201);
			assertThat(api.json(r).get("fin").asText()).isEqualTo(lunes("10:30"));
		}

		@Test
		void missingFieldsAndLongNotesAre400NamingTheField() throws Exception {
			MockHttpServletResponse sinInicio = api.post(bearer, URL,
					"{\"pacienteId\":" + pacienteId + ",\"prestacionId\":" + prestacionId + ",\"sillonId\":" + sillonId
							+ "}");
			assertThat(sinInicio.getStatus()).isEqualTo(400);
			assertThat(api.campos(sinInicio)).containsExactly("inicio");

			MockHttpServletResponse notasLargas = api.post(bearer, URL,
					alta("10:00", "\"notas\":\"" + "n".repeat(1001) + "\""));
			assertThat(notasLargas.getStatus()).isEqualTo(400);
			assertThat(api.campos(notasLargas)).containsExactly("notas");

			assertThat(api.post(bearer, URL, alta("10:00", "\"notas\":\"" + "n".repeat(1000) + "\"")).getStatus())
					.isEqualTo(201);
		}

		@Test
		void malformedInstantIs400WithoutEcho() throws Exception {
			MockHttpServletResponse r = api.post(bearer, URL, "{\"pacienteId\":" + pacienteId + ",\"prestacionId\":"
					+ prestacionId + ",\"sillonId\":" + sillonId + ",\"inicio\":\"ayer-secreto\"}");

			assertThat(r.getStatus()).isEqualTo(400);
			assertThat(r.getContentAsString()).doesNotContain("ayer-secreto");
		}

		@Test
		void overlapIs409WithTheConflictingTurnoAndWithoutPatientData() throws Exception {
			long existente = id(crear("10:00"));

			MockHttpServletResponse r = crear("10:15");

			assertThat(r.getStatus()).isEqualTo(409);
			JsonNode conflicto = api.json(r).get("conflicto");
			assertThat(conflicto.get("turnoId").asLong()).isEqualTo(existente);
			assertThat(conflicto.get("inicio").asText()).isEqualTo(lunes("10:00"));
			assertThat(conflicto.get("fin").asText()).isEqualTo(lunes("10:30"));
			assertThat(conflicto.get("sillonId").asLong()).isEqualTo(sillonId);
			assertThat(conflicto.get("profesionalId").asLong()).isEqualTo(profesionalId);
			assertThat(conflicto.get("motivo").asText()).isEqualTo("SILLON");
			sinDatosDelPaciente(r);
			instanceNeutro(r, api);
		}

		@Test
		void outsideScheduleIs422OnInicio() throws Exception {
			MockHttpServletResponse r = crear("08:30");

			assertThat(r.getStatus()).isEqualTo(422);
			assertThat(api.campos(r)).containsExactly("inicio");
			assertThat(api.json(r).has("bloqueoId")).isFalse();
			sinDatosDelPaciente(r);
		}

		@Test
		void blockedSlotIs422WithTheBlockIdButNotItsReason() throws Exception {
			long bloqueo = id(api.post(bearer, "/api/bloqueos", "{\"sillonId\":" + sillonId + ",\"inicio\":\""
					+ lunes("11:00") + "\",\"fin\":\"" + lunes("12:00") + "\",\"motivo\":\"motivo-reservado\"}"));

			MockHttpServletResponse r = crear("11:00");

			assertThat(r.getStatus()).isEqualTo(422);
			assertThat(api.campos(r)).containsExactly("inicio");
			assertThat(api.json(r).get("bloqueoId").asLong()).isEqualTo(bloqueo);
			assertThat(r.getContentAsString()).doesNotContain("motivo-reservado");
		}

		@Test
		void sobreturnoFlagIsHonouredAndReturned() throws Exception {
			MockHttpServletResponse r = api.post(bearer, URL, alta("08:30", "\"sobreturno\":true"));

			assertThat(r.getStatus()).isEqualTo(201);
			assertThat(api.json(r).get("sobreturno").asBoolean()).isTrue();
		}

		@Test
		void invalidReferenceIs422NamingTheField() throws Exception {
			MockHttpServletResponse r = api.post(bearer, URL, "{\"pacienteId\":987654,\"prestacionId\":"
					+ prestacionId + ",\"sillonId\":" + sillonId + ",\"inicio\":\"" + lunes("10:00") + "\"}");

			assertThat(r.getStatus()).isEqualTo(422);
			assertThat(api.campos(r)).containsExactly("pacienteId");
			assertThat(r.getContentAsString()).doesNotContain("987654");
		}
	}

	// --- 5.2 estado y reprogramacion ----------------------------------------------------------

	@Nested
	class EstadoYReprogramacion {

		private MockHttpServletResponse estado(long id, String json) throws Exception {
			return api.patch(bearer, URL + "/" + id + "/estado", json);
		}

		@Test
		void validTransitionIs200() throws Exception {
			long id = id(crear("10:00"));

			MockHttpServletResponse r = estado(id, "{\"estado\":\"CONFIRMADO\"}");

			assertThat(r.getStatus()).isEqualTo(200);
			assertThat(api.json(r).get("estado").asText()).isEqualTo("CONFIRMADO");
		}

		@Test
		void invalidTransitionIs409AndFutureAttendanceToo() throws Exception {
			long id = id(crear("10:00"));
			estado(id, "{\"estado\":\"CONFIRMADO\"}");

			MockHttpServletResponse volver = estado(id, "{\"estado\":\"PROGRAMADO\"}");
			assertThat(volver.getStatus()).isEqualTo(409);
			instanceNeutro(volver, api);
			assertThat(estado(id, "{\"estado\":\"ASISTIO\"}").getStatus()).isEqualTo(409);
		}

		@Test
		void unknownOrMissingStateIs400WithoutEcho() throws Exception {
			long id = id(crear("10:00"));

			MockHttpServletResponse desconocido = estado(id, "{\"estado\":\"BORRADO-SECRETO\"}");
			assertThat(desconocido.getStatus()).isEqualTo(400);
			assertThat(desconocido.getContentAsString()).doesNotContain("BORRADO-SECRETO");

			MockHttpServletResponse faltante = estado(id, "{}");
			assertThat(faltante.getStatus()).isEqualTo(400);
			assertThat(api.campos(faltante)).containsExactly("estado");
		}

		@Test
		void reasonWithAnotherStateIs400AndIsStoredWhenCancelling() throws Exception {
			long id = id(crear("10:00"));

			MockHttpServletResponse mal = estado(id, "{\"estado\":\"CONFIRMADO\",\"motivoCancelacion\":\"x\"}");
			assertThat(mal.getStatus()).isEqualTo(400);
			assertThat(api.campos(mal)).containsExactly("motivoCancelacion");

			MockHttpServletResponse largo = estado(id,
					"{\"estado\":\"CANCELADO\",\"motivoCancelacion\":\"" + "m".repeat(256) + "\"}");
			assertThat(largo.getStatus()).isEqualTo(400);
			assertThat(api.campos(largo)).containsExactly("motivoCancelacion");

			MockHttpServletResponse ok = estado(id, "{\"estado\":\"CANCELADO\",\"motivoCancelacion\":\"viaja\"}");
			assertThat(ok.getStatus()).isEqualTo(200);
			assertThat(api.json(ok).get("motivoCancelacion").asText()).isEqualTo("viaja");
		}

		@Test
		void unknownTurnoIs404WithoutEchoingTheId() throws Exception {
			MockHttpServletResponse patch = estado(987654, "{\"estado\":\"CONFIRMADO\"}");
			MockHttpServletResponse put = api.put(bearer, URL + "/987654", "{\"inicio\":\"" + lunes("11:00") + "\"}");

			for (MockHttpServletResponse r : new MockHttpServletResponse[] { patch, put }) {
				assertThat(r.getStatus()).isEqualTo(404);
				assertThat(r.getContentAsString()).doesNotContain("987654");
			}
		}

		@Test
		void reschedulingIs200409And422() throws Exception {
			long id = id(crear("10:00"));
			id(crear("11:00"));

			MockHttpServletResponse movido = api.put(bearer, URL + "/" + id, "{\"inicio\":\"" + lunes("11:30") + "\"}");
			assertThat(movido.getStatus()).isEqualTo(200);
			assertThat(api.json(movido).get("inicio").asText()).isEqualTo(lunes("11:30"));
			assertThat(api.json(movido).get("fin").asText()).isEqualTo(lunes("12:00"));

			MockHttpServletResponse ocupado = api.put(bearer, URL + "/" + id, "{\"inicio\":\"" + lunes("11:00") + "\"}");
			assertThat(ocupado.getStatus()).isEqualTo(409);

			MockHttpServletResponse fuera = api.put(bearer, URL + "/" + id, "{\"inicio\":\"" + lunes("08:00") + "\"}");
			assertThat(fuera.getStatus()).isEqualTo(422);

			MockHttpServletResponse sinInicio = api.put(bearer, URL + "/" + id, "{}");
			assertThat(sinInicio.getStatus()).isEqualTo(400);
			assertThat(api.campos(sinInicio)).containsExactly("inicio");

			MockHttpServletResponse sillonAjeno = api.put(bearer, URL + "/" + id,
					"{\"inicio\":\"" + lunes("12:00") + "\",\"sillonId\":987654}");
			assertThat(sillonAjeno.getStatus()).isEqualTo(422);
			assertThat(api.campos(sillonAjeno)).containsExactly("sillonId");
		}
	}

	// --- 5.3 consulta -------------------------------------------------------------------------

	@Nested
	class Consulta {

		private String rango(String desde, String hasta) {
			return URL + "?desde=" + desde + "&hasta=" + hasta;
		}

		@Test
		void listIsOrderedAndCarriesPatientAndPrestacionSummaries() throws Exception {
			long tarde = id(crear("11:00"));
			long temprano = id(crear("09:30"));

			MockHttpServletResponse r = api.get(bearer, rango("2026-12-07T00:00:00Z", "2026-12-08T00:00:00Z"));

			assertThat(r.getStatus()).isEqualTo(200);
			JsonNode lista = api.json(r);
			assertThat(lista.size()).isEqualTo(2);
			assertThat(lista.get(0).get("id").asLong()).isEqualTo(temprano);
			assertThat(lista.get(1).get("id").asLong()).isEqualTo(tarde);
			assertThat(lista.get(0).get("paciente").get("nombre").asText()).isEqualTo("Ana");
			assertThat(lista.get(0).get("paciente").get("apellido").asText()).isEqualTo(APELLIDO);
			assertThat(lista.get(0).get("prestacion").get("nombre").asText()).isEqualTo("Consulta");
			assertThat(lista.get(0).has("consultorioId")).isFalse();
		}

		@Test
		void filtersAndCancelledOnRequest() throws Exception {
			long vigente = id(crear("10:00"));
			long cancelado = id(crear("11:00"));
			api.patch(bearer, URL + "/" + cancelado + "/estado", "{\"estado\":\"CANCELADO\"}");
			String dia = rango("2026-12-07T00:00:00Z", "2026-12-08T00:00:00Z");

			assertThat(idsTurnos(api.get(bearer, dia))).containsExactly(vigente);
			assertThat(idsTurnos(api.get(bearer, dia + "&incluirCancelados=true"))).containsExactly(vigente, cancelado);
			assertThat(idsTurnos(api.get(bearer, dia + "&sillonId=" + sillonId))).containsExactly(vigente);
			assertThat(idsTurnos(api.get(bearer, dia + "&sillonId=987654"))).isEmpty();
			assertThat(idsTurnos(api.get(bearer, dia + "&profesionalId=" + profesionalId))).containsExactly(vigente);
		}

		@Test
		void invalidRangesAre400WithoutEcho() throws Exception {
			assertThat(api.get(bearer, URL + "?desde=2026-12-07T00:00:00Z").getStatus()).isEqualTo(400);
			assertThat(api.get(bearer, URL).getStatus()).isEqualTo(400);

			MockHttpServletResponse invertido = api.get(bearer, rango("2026-12-08T00:00:00Z", "2026-12-07T00:00:00Z"));
			assertThat(invertido.getStatus()).isEqualTo(400);
			assertThat(api.campos(invertido)).containsExactly("hasta");

			assertThat(api.get(bearer, rango("2026-12-07T00:00:00Z", "2026-12-07T00:00:00Z")).getStatus())
					.isEqualTo(400);
			assertThat(api.get(bearer, rango("2026-12-01T00:00:00Z", "2027-01-12T00:00:01Z")).getStatus())
					.isEqualTo(400);
			assertThat(api.get(bearer, rango("2026-12-01T00:00:00Z", "2027-01-12T00:00:00Z")).getStatus())
					.isEqualTo(200);

			MockHttpServletResponse malformado = api.get(bearer, rango("fecha-secreta", "2026-12-08T00:00:00Z"));
			assertThat(malformado.getStatus()).isEqualTo(400);
			assertThat(malformado.getContentAsString()).doesNotContain("fecha-secreta");
		}

		@Test
		void getByIdIs200Or404() throws Exception {
			long id = id(crear("10:00"));

			MockHttpServletResponse r = api.get(bearer, URL + "/" + id);
			assertThat(r.getStatus()).isEqualTo(200);
			assertThat(api.json(r).get("id").asLong()).isEqualTo(id);

			MockHttpServletResponse inexistente = api.get(bearer, URL + "/987654");
			assertThat(inexistente.getStatus()).isEqualTo(404);
			assertThat(inexistente.getContentAsString()).doesNotContain("987654");
		}

		@Test
		void readsDoNotAddAuditRows() throws Exception {
			long id = id(crear("10:00"));
			long antes = auditoriaTurnos();

			api.get(bearer, URL + "/" + id);
			api.get(bearer, rango("2026-12-07T00:00:00Z", "2026-12-08T00:00:00Z"));

			assertThat(antes).isEqualTo(1);
			assertThat(auditoriaTurnos()).isEqualTo(antes);
		}
	}
}
