package ar.global.odonto.agenda.turno;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.testsupport.ApiCalls;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Arma por la API lo que un consultorio recien registrado necesita para dar turnos: una prestacion de 30 min, una
 * franja lunes 09-13 local y un paciente (el registro ya da un profesional y "Sillon 1"). Lunes 2026-12-07: hora de
 * Buenos Aires + 3 = UTC.
 */
@TestComponent
public class AgendaDeTurnosFixture {

	public record Agenda(long sillonId, long profesionalId, long prestacionId, long pacienteId) {
	}

	@Autowired
	private ApiCalls api;

	public Agenda preparar(String bearer, String dni) throws Exception {
		long sillonId = api.ids(api.get(bearer, "/api/sillones")).get(0);
		long prestacionId = creado(api.post(bearer, "/api/prestaciones",
				"{\"nombre\":\"Consulta\",\"duracionMinutos\":30}"));
		MockHttpServletResponse horario = api.post(bearer, "/api/horarios-atencion",
				"{\"diaSemana\":1,\"horaDesde\":\"09:00\",\"horaHasta\":\"13:00\"}");
		assertThat(horario.getStatus()).isEqualTo(201);
		long profesionalId = api.json(horario).get("profesionalId").asLong();
		long pacienteId = creado(api.post(bearer, "/api/pacientes",
				"{\"nombre\":\"Ana\",\"apellido\":\"Prueba\",\"dni\":\"" + dni + "\"}"));
		return new Agenda(sillonId, profesionalId, prestacionId, pacienteId);
	}

	/** Hora local de Buenos Aires (UTC-3) del lunes 2026-12-07 como instante UTC. */
	public static String lunes(String horaLocal) {
		int h = Integer.parseInt(horaLocal.substring(0, 2)) + 3;
		return "2026-12-07T" + String.format("%02d", h) + horaLocal.substring(2) + ":00Z";
	}

	public static String alta(Agenda a, String horaLocal, String extra) {
		return "{\"pacienteId\":" + a.pacienteId() + ",\"prestacionId\":" + a.prestacionId() + ",\"sillonId\":"
				+ a.sillonId() + ",\"inicio\":\"" + lunes(horaLocal) + "\"" + (extra == null ? "" : "," + extra) + "}";
	}

	public long creado(MockHttpServletResponse r) throws Exception {
		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(201);
		return api.json(r).get("id").asLong();
	}
}
