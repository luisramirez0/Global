package ar.global.odonto.agenda.config;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** Spec agenda-configuration "Aislamiento de la configuracion entre consultorios" (design D10). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class })
class AgendaConfigTenantIsolationIT {

	private static final String BLOQUEO = "{\"inicio\":\"2026-12-24T12:00:00Z\",\"fin\":\"2026-12-24T13:00:00Z\"}";
	private static final String PRESTACION = "{\"nombre\":\"Consulta\",\"duracionMinutos\":30}";
	private static final String HORARIO = "{\"diaSemana\":1,\"horaDesde\":\"09:00\",\"horaHasta\":\"13:00\"}";

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TenantFixtures fixtures;

	private String a;
	private String b;
	private long sillonB;
	private long profesionalB;
	private long prestacionB;
	private long horarioB;
	private long bloqueoB;
	private long sillonA;
	private long profesionalA;
	private long horarioA;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		a = auth.bearer(auth.registrar("iso-a@a.test").email());
		b = auth.bearer(auth.registrar("iso-b@b.test").email());
		sillonA = api.ids(api.get(a, "/api/sillones")).get(0);
		sillonB = api.ids(api.get(b, "/api/sillones")).get(0);
		prestacionB = api.json(api.post(b, "/api/prestaciones", PRESTACION)).get("id").asLong();
		horarioB = api.json(api.post(b, "/api/horarios-atencion", HORARIO)).get("id").asLong();
		profesionalB = api.json(api.get(b, "/api/horarios-atencion/" + horarioB)).get("profesionalId").asLong();
		bloqueoB = api.json(api.post(b, "/api/bloqueos", BLOQUEO)).get("id").asLong();
		api.post(a, "/api/prestaciones", PRESTACION);
		horarioA = api.json(api.post(a, "/api/horarios-atencion", HORARIO)).get("id").asLong();
		profesionalA = api.json(api.get(a, "/api/horarios-atencion/" + horarioA)).get("profesionalId").asLong();
		api.post(a, "/api/bloqueos", BLOQUEO);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void listingsReturnOnlyTheOwnRecords() throws Exception {
		assertThat(api.ids(api.get(a, "/api/sillones"))).doesNotContain(sillonB).hasSize(1);
		assertThat(api.ids(api.get(a, "/api/prestaciones"))).doesNotContain(prestacionB).hasSize(1);
		assertThat(api.ids(api.get(a, "/api/horarios-atencion"))).doesNotContain(horarioB).hasSize(1);
		assertThat(api.ids(api.get(a, "/api/bloqueos"))).doesNotContain(bloqueoB).hasSize(1);
		assertThat(api.ids(api.get(b, "/api/bloqueos"))).containsExactly(bloqueoB);
	}

	@Test
	void getPutAndDeleteOfAForeignIdAre404AndTheResourceDoesNotChange() throws Exception {
		List<String[]> recursos = List.of(
				new String[] { "/api/sillones/" + sillonB, "{\"nombre\":\"Hack\",\"activo\":true}" },
				new String[] { "/api/prestaciones/" + prestacionB, "{\"nombre\":\"Hack\",\"duracionMinutos\":15}" },
				new String[] { "/api/horarios-atencion/" + horarioB,
						"{\"diaSemana\":2,\"horaDesde\":\"10:00\",\"horaHasta\":\"11:00\"}" },
				new String[] { "/api/bloqueos/" + bloqueoB, BLOQUEO });
		for (String[] r : recursos) {
			assertThat(api.get(a, r[0]).getStatus()).as("GET " + r[0]).isEqualTo(404);
			assertThat(api.put(a, r[0], r[1]).getStatus()).as("PUT " + r[0]).isEqualTo(404);
			assertThat(api.delete(a, r[0]).getStatus()).as("DELETE " + r[0]).isEqualTo(404);
			assertThat(api.get(b, r[0]).getStatus()).as("B sigue viendo " + r[0]).isEqualTo(200);
		}
		assertThat(api.json(api.get(b, "/api/sillones/" + sillonB)).get("activo").asBoolean()).isTrue();
		assertThat(api.json(api.get(b, "/api/prestaciones/" + prestacionB)).get("nombre").asText())
				.isEqualTo("Consulta");
		assertThat(api.json(api.get(b, "/api/horarios-atencion/" + horarioB)).get("diaSemana").asInt()).isEqualTo(1);
	}

	@Test
	void foreignReferencesInTheBodyAre422AndNothingIsCreated() throws Exception {
		var bloqueoConSillonAjeno = api.post(a, "/api/bloqueos",
				"{\"sillonId\":" + sillonB + ",\"inicio\":\"2026-12-24T12:00:00Z\",\"fin\":\"2026-12-24T13:00:00Z\"}");
		var bloqueoConProfAjeno = api.post(a, "/api/bloqueos", "{\"profesionalId\":" + profesionalB
				+ ",\"inicio\":\"2026-12-24T12:00:00Z\",\"fin\":\"2026-12-24T13:00:00Z\"}");
		var horarioConProfAjeno = api.post(a, "/api/horarios-atencion", "{\"profesionalId\":" + profesionalB
				+ ",\"diaSemana\":3,\"horaDesde\":\"09:00\",\"horaHasta\":\"12:00\"}");

		assertThat(bloqueoConSillonAjeno.getStatus()).isEqualTo(422);
		assertThat(bloqueoConProfAjeno.getStatus()).isEqualTo(422);
		assertThat(horarioConProfAjeno.getStatus()).isEqualTo(422);
		assertThat(api.ids(api.get(a, "/api/bloqueos"))).hasSize(1);
		assertThat(api.ids(api.get(a, "/api/horarios-atencion"))).hasSize(1);
		assertThat(sillonA).isNotEqualTo(sillonB);
		assertThat(profesionalA).isNotEqualTo(profesionalB);
	}

	@Test
	void foreignReferencesOnPutAre422() throws Exception {
		long bloqueoA = api.ids(api.get(a, "/api/bloqueos")).get(0);

		var r = api.put(a, "/api/bloqueos/" + bloqueoA,
				"{\"sillonId\":" + sillonB + ",\"inicio\":\"2026-12-24T12:00:00Z\",\"fin\":\"2026-12-24T13:00:00Z\"}");

		assertThat(r.getStatus()).isEqualTo(422);
		assertThat(api.json(api.get(a, "/api/bloqueos/" + bloqueoA)).get("sillonId").isNull()).isTrue();
	}

	@Test
	void putHorarioWithAForeignProfessionalIs422AndTheFranjaIsUnchanged() throws Exception {
		var r = api.put(a, "/api/horarios-atencion/" + horarioA, "{\"profesionalId\":" + profesionalB
				+ ",\"diaSemana\":3,\"horaDesde\":\"10:00\",\"horaHasta\":\"11:00\"}");

		assertThat(r.getStatus()).isEqualTo(422);
		assertThat(api.campos(r)).containsExactly("profesionalId");
		var intacto = api.json(api.get(a, "/api/horarios-atencion/" + horarioA));
		assertThat(intacto.get("profesionalId").asLong()).isEqualTo(profesionalA);
		assertThat(intacto.get("diaSemana").asInt()).isEqualTo(1);
		assertThat(intacto.get("horaDesde").asText()).isEqualTo("09:00");
		assertThat(intacto.get("horaHasta").asText()).isEqualTo("13:00");
	}

	@Test
	void bloqueoListFiltersByForeignIdsNeverReturnTheOtherConsultoriosData() throws Exception {
		String rango = "\"inicio\":\"2026-12-24T12:00:00Z\",\"fin\":\"2026-12-24T13:00:00Z\"";
		long deSillonB = api.json(api.post(b, "/api/bloqueos", "{\"sillonId\":" + sillonB + "," + rango + "}"))
				.get("id").asLong();
		long deProfB = api.json(api.post(b, "/api/bloqueos", "{\"profesionalId\":" + profesionalB + "," + rango + "}"))
				.get("id").asLong();
		long deSillonA = api.json(api.post(a, "/api/bloqueos", "{\"sillonId\":" + sillonA + "," + rango + "}"))
				.get("id").asLong();
		long deProfA = api.json(api.post(a, "/api/bloqueos", "{\"profesionalId\":" + profesionalA + "," + rango + "}"))
				.get("id").asLong();

		// Filtro con id de B desde A: 200 y lista vacia (el spec exige que los listados no incluyan datos ajenos).
		var porSillonAjeno = api.get(a, "/api/bloqueos?sillonId=" + sillonB);
		var porProfAjeno = api.get(a, "/api/bloqueos?profesionalId=" + profesionalB);
		assertThat(porSillonAjeno.getStatus()).isEqualTo(200);
		assertThat(api.ids(porSillonAjeno)).isEmpty();
		assertThat(porProfAjeno.getStatus()).isEqualTo(200);
		assertThat(api.ids(porProfAjeno)).isEmpty();

		// El filtrado propio sigue funcionando y no mezcla consultorios.
		assertThat(api.ids(api.get(a, "/api/bloqueos?sillonId=" + sillonA))).containsExactly(deSillonA);
		assertThat(api.ids(api.get(a, "/api/bloqueos?profesionalId=" + profesionalA))).containsExactly(deProfA);
		assertThat(api.ids(api.get(b, "/api/bloqueos?sillonId=" + sillonB))).containsExactly(deSillonB);
		assertThat(api.ids(api.get(b, "/api/bloqueos?profesionalId=" + profesionalB))).containsExactly(deProfB);
		assertThat(api.ids(api.get(a, "/api/bloqueos"))).doesNotContain(deSillonB, deProfB, bloqueoB);
	}

	@Test
	void sillonLimitIsPerConsultorio() throws Exception {
		assertThat(api.post(a, "/api/sillones", "{\"nombre\":\"A2\"}").getStatus()).isEqualTo(201);
		// B sigue con un sillon activo: su alta no es afectada por los dos activos de A.
		assertThat(api.post(b, "/api/sillones", "{\"nombre\":\"B2\"}").getStatus()).isEqualTo(201);
		assertThat(api.post(a, "/api/sillones", "{\"nombre\":\"A3\"}").getStatus()).isEqualTo(409);
	}
}
