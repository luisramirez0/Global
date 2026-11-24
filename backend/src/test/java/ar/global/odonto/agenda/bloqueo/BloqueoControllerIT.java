package ar.global.odonto.agenda.bloqueo;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

/** Spec agenda-configuration: bloqueos de agenda. El registro crea un profesional activo y un sillon. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, ApiCalls.class })
class BloqueoControllerIT {

	private static final String URL = "/api/bloqueos";
	private static final String INI = "2026-12-24T12:00:00Z";
	private static final String FIN = "2026-12-24T23:00:00Z";

	@Autowired
	private AuthFlows auth;

	@Autowired
	private ApiCalls api;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private ProfesionalRepository profesionales;

	private String bearer;
	private Long consultorioId;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		AuthFlows.Cuenta cuenta = auth.registrar("bloqueos@a.test");
		consultorioId = cuenta.consultorioId();
		bearer = auth.bearer(cuenta.email());
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private long sillonId() throws Exception {
		return api.ids(api.get(bearer, "/api/sillones")).get(0);
	}

	private Long profesionalExtra(boolean activo) {
		return fixtures.inTenant(consultorioId, () -> {
			Profesional p = new Profesional("Dr", "Extra");
			p.setActivo(activo);
			return profesionales.save(p).getId();
		});
	}

	private String json(Object sillonId, Object profesionalId, String inicio, String fin, String motivo) {
		StringBuilder sb = new StringBuilder("{");
		if (sillonId != null) {
			sb.append("\"sillonId\":").append(sillonId).append(',');
		}
		if (profesionalId != null) {
			sb.append("\"profesionalId\":").append(profesionalId).append(',');
		}
		if (motivo != null) {
			sb.append("\"motivo\":\"").append(motivo).append("\",");
		}
		return sb.append("\"inicio\":\"").append(inicio).append("\",\"fin\":\"").append(fin).append("\"}").toString();
	}

	private MockHttpServletResponse crear(Object sillonId, Object profesionalId, String inicio, String fin)
			throws Exception {
		return api.post(bearer, URL, json(sillonId, profesionalId, inicio, fin, null));
	}

	@Test
	void blockBySillonIs201WithSillonIdAndNullProfessional() throws Exception {
		long sillon = sillonId();

		MockHttpServletResponse r = crear(sillon, null, INI, FIN);

		assertThat(r.getStatus()).isEqualTo(201);
		JsonNode b = api.json(r);
		assertThat(b.get("sillonId").asLong()).isEqualTo(sillon);
		assertThat(b.get("profesionalId").isNull()).isTrue();
		assertThat(b.get("inicio").asText()).isEqualTo(INI);
		assertThat(b.has("consultorioId")).isFalse();
		assertThat(b.has("sillon")).isFalse();
		assertThat(r.getHeader("Location")).endsWith(URL + "/" + b.get("id").asLong());
	}

	@Test
	void blockByProfessionalIs201WithProfessionalAndNullSillon() throws Exception {
		Long prof = profesionalExtra(true);

		JsonNode b = api.json(crear(null, prof, INI, FIN));

		assertThat(b.get("profesionalId").asLong()).isEqualTo(prof);
		assertThat(b.get("sillonId").isNull()).isTrue();
	}

	@Test
	void blockWithoutScopeAppliesToTheWholeConsultorio() throws Exception {
		MockHttpServletResponse r = crear(null, null, INI, FIN);

		assertThat(r.getStatus()).isEqualTo(201);
		assertThat(api.json(r).get("sillonId").isNull()).isTrue();
		assertThat(api.json(r).get("profesionalId").isNull()).isTrue();
	}

	@Test
	void omittedProfessionalIsNeverDefaultedWhateverTheNumberOfActiveOnes() throws Exception {
		// 1 activo (el del registro)
		assertThat(api.json(crear(null, null, INI, FIN)).get("profesionalId").isNull()).isTrue();
		// 2 activos
		Long extra = profesionalExtra(true);
		assertThat(api.json(crear(null, null, INI, FIN)).get("profesionalId").isNull()).isTrue();
		// 0 activos
		fixtures.inTenant(consultorioId, () -> {
			profesionales.findAll().forEach(p -> p.setActivo(false));
			return null;
		});
		MockHttpServletResponse r = crear(null, null, INI, FIN);
		assertThat(r.getStatus()).isEqualTo(201);
		assertThat(api.json(r).get("profesionalId").isNull()).isTrue();
		assertThat(extra).isNotNull();
	}

	@Test
	void unknownProfessionalOrSillonIs422NamingTheField() throws Exception {
		MockHttpServletResponse p = crear(null, 999999, INI, FIN);
		MockHttpServletResponse s = crear(999999, null, INI, FIN);

		assertThat(p.getStatus()).isEqualTo(422);
		assertThat(api.campos(p)).containsExactly("profesionalId");
		assertThat(s.getStatus()).isEqualTo(422);
		assertThat(api.campos(s)).containsExactly("sillonId");
	}

	@Test
	void inactiveProfessionalIsAllowed() throws Exception {
		Long inactivo = profesionalExtra(false);

		assertThat(crear(null, inactivo, INI, FIN).getStatus()).isEqualTo(201);
	}

	@Test
	void inactiveSillonIsAllowed() throws Exception {
		long segundo = api.json(api.post(bearer, "/api/sillones", "{\"nombre\":\"Reparacion\"}")).get("id").asLong();
		api.delete(bearer, "/api/sillones/" + segundo);

		assertThat(crear(segundo, null, INI, FIN).getStatus()).isEqualTo(201);
	}

	@Test
	void finEqualToInicioIs400NamingFinOnCreateAndOnPut() throws Exception {
		MockHttpServletResponse r = crear(null, null, INI, INI);
		assertThat(r.getStatus()).isEqualTo(400);
		assertThat(api.campos(r)).containsExactly("fin");

		long id = api.json(crear(null, null, INI, FIN)).get("id").asLong();
		MockHttpServletResponse put = api.put(bearer, URL + "/" + id, json(null, null, INI, INI, null));
		assertThat(put.getStatus()).isEqualTo(400);
		assertThat(api.campos(put)).containsExactly("fin");
		assertThat(api.json(api.get(bearer, URL + "/" + id)).get("fin").asText()).isEqualTo(FIN);
	}

	@Test
	void motivoOf255BytesIsOkAnd256IsRejected() throws Exception {
		assertThat(api.post(bearer, URL, json(null, null, INI, FIN, "a".repeat(255))).getStatus()).isEqualTo(201);
		assertThat(api.post(bearer, URL, json(null, null, INI, FIN, "a".repeat(256))).getStatus()).isEqualTo(400);
		// 128 caracteres de 2 bytes = 256 bytes
		assertThat(api.post(bearer, URL, json(null, null, INI, FIN, "ñ".repeat(128))).getStatus()).isEqualTo(400);
	}

	@Test
	void listByRangeReturnsOnlyIntersectingOrderedByInicio() throws Exception {
		long enero = api.json(crear(null, null, "2027-01-10T10:00:00Z", "2027-01-10T12:00:00Z")).get("id").asLong();
		long tardeDic = api.json(crear(null, null, "2026-12-20T10:00:00Z", "2026-12-20T12:00:00Z")).get("id")
				.asLong();
		long tempranoDic = api.json(crear(null, null, "2026-12-05T10:00:00Z", "2026-12-05T12:00:00Z")).get("id")
				.asLong();
		long cruza = api.json(crear(null, null, "2026-11-30T20:00:00Z", "2026-12-01T01:00:00Z")).get("id").asLong();

		List<Long> diciembre = api.ids(
				api.get(bearer, URL + "?desde=2026-12-01T00:00:00Z&hasta=2027-01-01T00:00:00Z"));

		assertThat(diciembre).containsExactly(cruza, tempranoDic, tardeDic);
		assertThat(api.ids(api.get(bearer, URL))).containsExactly(cruza, tempranoDic, tardeDic, enero);
		assertThat(api.ids(api.get(bearer, URL + "?desde=2027-01-01T00:00:00Z"))).containsExactly(enero);
		assertThat(api.ids(api.get(bearer, URL + "?hasta=2026-12-01T00:00:00Z"))).containsExactly(cruza);
	}

	@Test
	void listFiltersBySillonAndProfessional() throws Exception {
		long sillon = sillonId();
		Long prof = profesionalExtra(true);
		long deSillon = api.json(crear(sillon, null, INI, FIN)).get("id").asLong();
		long deProf = api.json(crear(null, prof, INI, FIN)).get("id").asLong();

		assertThat(api.ids(api.get(bearer, URL + "?sillonId=" + sillon))).containsExactly(deSillon);
		assertThat(api.ids(api.get(bearer, URL + "?profesionalId=" + prof))).containsExactly(deProf);
	}

	@Test
	void putReplacesAndDeleteRemoves() throws Exception {
		long id = api.json(crear(null, null, INI, FIN)).get("id").asLong();

		MockHttpServletResponse put = api.put(bearer, URL + "/" + id,
				json(sillonId(), null, "2026-12-25T10:00:00Z", "2026-12-25T11:00:00Z", "Feriado"));

		assertThat(put.getStatus()).isEqualTo(200);
		assertThat(api.json(put).get("motivo").asText()).isEqualTo("Feriado");
		assertThat(api.json(put).get("sillonId").asLong()).isEqualTo(sillonId());
		assertThat(api.delete(bearer, URL + "/" + id).getStatus()).isEqualTo(204);
		assertThat(api.get(bearer, URL + "/" + id).getStatus()).isEqualTo(404);
	}

	@Test
	void unknownIdIs404() throws Exception {
		assertThat(api.get(bearer, URL + "/999999").getStatus()).isEqualTo(404);
		assertThat(api.put(bearer, URL + "/999999", json(null, null, INI, FIN, null)).getStatus()).isEqualTo(404);
		assertThat(api.delete(bearer, URL + "/999999").getStatus()).isEqualTo(404);
	}
}
