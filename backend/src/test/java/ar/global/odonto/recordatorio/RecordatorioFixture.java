package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.turno.AgendaDeTurnosFixture;
import ar.global.odonto.agenda.turno.AgendaDeTurnosFixture.Agenda;
import ar.global.odonto.testsupport.ApiCalls;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Arma por la API un turno futuro (lunes 2026-12-07 10:00 local) de un paciente con datos de contacto distintivos,
 * para verificar que ni el mensaje ni los errores los filtran (C-09, reglas 5 y 1).
 */
@TestComponent
public class RecordatorioFixture {

	public static final String NOMBRE = "Zoilo";
	public static final String APELLIDO = "Quintanilla";
	public static final String TELEFONO = "+5491155667788";
	public static final String EMAIL = "zoilo.quintanilla@paciente.test";
	public static final String NOTAS = "nota-secreta-del-turno";

	public record TurnoRecordable(long turnoId, long pacienteId, Agenda agenda) {
	}

	@Autowired
	private ApiCalls api;

	@Autowired
	private AgendaDeTurnosFixture agendas;

	/** {@code telefono}/{@code email} {@code null} → paciente sin ese dato. */
	public TurnoRecordable preparar(String bearer, String dni, String telefono, String email) throws Exception {
		Agenda base = agendas.preparar(bearer, "40999888");
		StringBuilder body = new StringBuilder("{\"nombre\":\"" + NOMBRE + "\",\"apellido\":\"" + APELLIDO
				+ "\",\"dni\":\"" + dni + "\"");
		if (telefono != null) {
			body.append(",\"telefono\":\"").append(telefono).append('"');
		}
		if (email != null) {
			body.append(",\"email\":\"").append(email).append('"');
		}
		MockHttpServletResponse paciente = api.post(bearer, "/api/pacientes", body.append('}').toString());
		assertThat(paciente.getStatus()).as(paciente.getContentAsString()).isEqualTo(201);
		long pacienteId = api.json(paciente).get("id").asLong();
		Agenda agenda = new Agenda(base.sillonId(), base.profesionalId(), base.prestacionId(), pacienteId);
		long turnoId = agendas.creado(
				api.post(bearer, "/api/turnos", AgendaDeTurnosFixture.alta(agenda, "10:00", "\"notas\":\"" + NOTAS + "\"")));
		return new TurnoRecordable(turnoId, pacienteId, agenda);
	}
}
