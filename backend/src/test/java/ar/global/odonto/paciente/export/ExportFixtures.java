package ar.global.odonto.paciente.export;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

import ar.global.odonto.testsupport.ApiCalls;

/**
 * Helpers de los ITs de C-15: arma por la API un paciente con consentimiento, ficha, notas y turnos, y lee las
 * filas {@code EXPORT} de {@code audit_log} con SQL directo (solo tests). Usa la cuenta registrada: profesional
 * vinculado al usuario y "Sillón 1".
 */
@TestComponent
public class ExportFixtures {

	public static final String APELLIDO = "Apellidosecreto";

	public static final String DNI = "30111222";

	public static final String ALERGIA = "ALERGIA-SECRETA-PENICILINA";

	public static final String NOTA_1 = "NOTA-SECRETA-UNO";

	public static final String NOTA_2 = "NOTA-SECRETA-DOS";

	/** Fila {@code EXPORT} (sin ip ni fecha). */
	public record Fila(Long consultorioId, Long usuarioId, String entidad, Long entidadId, String detalle) {
	}

	@Autowired
	private ApiCalls api;

	@Autowired
	private JdbcTemplate jdbc;

	private int dni = 31_000_000;

	private long id(MockHttpServletResponse r) throws Exception {
		if (r.getStatus() != 201) {
			throw new IllegalStateException("alta fallo: " + r.getStatus() + " " + r.getContentAsString());
		}
		return api.json(r).get("id").asLong();
	}

	/** Paciente sin nada mas (sin consentimiento, ficha, notas ni turnos). */
	public long paciente(String bearer, String apellido, String dniPaciente) throws Exception {
		String body = api.mapper.createObjectNode().put("nombre", "Ana").put("apellido", apellido)
				.put("dni", dniPaciente).toString();
		return id(api.post(bearer, "/api/pacientes", body));
	}

	public long pacienteVacio(String bearer) throws Exception {
		return paciente(bearer, "Vacio", String.valueOf(++dni));
	}

	public void consentir(String bearer, long pacienteId) throws Exception {
		id(api.post(bearer, "/api/pacientes/" + pacienteId + "/consentimientos", "{\"versionTexto\":\"v1\"}"));
	}

	public void ficha(String bearer, long pacienteId) throws Exception {
		MockHttpServletResponse r = api.put(bearer, "/api/pacientes/" + pacienteId + "/ficha",
				"{\"alergias\":\"" + ALERGIA + "\",\"embarazo\":false,\"version\":null}");
		if (r.getStatus() != 200) {
			throw new IllegalStateException("ficha fallo: " + r.getStatus());
		}
	}

	public long nota(String bearer, long pacienteId, String texto) throws Exception {
		return id(api.post(bearer, "/api/pacientes/" + pacienteId + "/notas", "{\"texto\":\"" + texto + "\"}"));
	}

	/** Prestacion de 30 min y franja lunes 09-13 local; devuelve {prestacionId, sillonId}. */
	public long[] agenda(String bearer) throws Exception {
		long sillonId = api.ids(api.get(bearer, "/api/sillones")).get(0);
		long prestacionId = id(api.post(bearer, "/api/prestaciones", "{\"nombre\":\"Consulta\",\"duracionMinutos\":30}"));
		MockHttpServletResponse horario = api.post(bearer, "/api/horarios-atencion",
				"{\"diaSemana\":1,\"horaDesde\":\"09:00\",\"horaHasta\":\"13:00\"}");
		if (horario.getStatus() != 201) {
			throw new IllegalStateException("horario fallo: " + horario.getStatus());
		}
		return new long[] { prestacionId, sillonId };
	}

	/** Turno del lunes 2026-12-07 a la hora UTC indicada (10:00 local = 13:00Z). */
	public long turno(String bearer, long pacienteId, long[] agenda, String horaUtc) throws Exception {
		String body = "{\"pacienteId\":" + pacienteId + ",\"prestacionId\":" + agenda[0] + ",\"sillonId\":" + agenda[1]
				+ ",\"inicio\":\"2026-12-07T" + horaUtc + ":00Z\"}";
		return id(api.post(bearer, "/api/turnos", body));
	}

	/** Filas {@code EXPORT} de toda la base, en orden de alta. */
	public List<Fila> exports() {
		return jdbc.query("SELECT consultorio_id, usuario_id, entidad, entidad_id, detalle FROM audit_log "
				+ "WHERE accion = 'EXPORT' ORDER BY id", (rs, i) -> new Fila(rs.getObject("consultorio_id", Long.class),
						rs.getObject("usuario_id", Long.class), rs.getString("entidad"),
						rs.getObject("entidad_id", Long.class), rs.getString("detalle")));
	}
}
