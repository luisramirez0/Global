package ar.global.odonto.paciente.ficha;

import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Helpers de los ITs de C-08: pacientes y consentimientos por la API, usuarios extra y lectura de
 * {@code audit_log} con SQL directo (solo tests). Requiere {@link ApiCalls} y {@link TenantFixtures}.
 */
@TestComponent
public class FichaFixtures {

	/** Fila de auditoria relevante para C-08 (sin ip ni fecha). */
	public record Fila(Long usuarioId, String accion, String entidad, Long entidadId, String detalle) {
	}

	@Autowired
	private ApiCalls api;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private UsuarioRepository usuarios;

	@Autowired
	private JdbcTemplate jdbc;

	private int dni = 30_000_000;

	public long crearPaciente(String bearer) throws Exception {
		String body = api.mapper.createObjectNode().put("nombre", "Ana").put("apellido", "Perez")
				.put("dni", String.valueOf(++dni)).toString();
		MockHttpServletResponse r = api.post(bearer, "/api/pacientes", body);
		if (r.getStatus() != 201) {
			throw new IllegalStateException("alta de paciente fallo: " + r.getStatus());
		}
		return api.json(r).get("id").asLong();
	}

	public MockHttpServletResponse consentir(String bearer, long pacienteId, String version) throws Exception {
		String body = api.mapper.createObjectNode().put("versionTexto", version).toString();
		return api.post(bearer, "/api/pacientes/" + pacienteId + "/consentimientos", body);
	}

	public void consentir(String bearer, long pacienteId) throws Exception {
		MockHttpServletResponse r = consentir(bearer, pacienteId, "v1");
		if (r.getStatus() != 201) {
			throw new IllegalStateException("consentimiento fallo: " + r.getStatus());
		}
	}

	public void darDeBaja(String bearer, long pacienteId) throws Exception {
		if (api.delete(bearer, "/api/pacientes/" + pacienteId).getStatus() != 204) {
			throw new IllegalStateException("baja fallo");
		}
	}

	/** Usuario extra del consultorio, sin profesional vinculado. */
	public Long usuarioSinProfesional(Long consultorioId, String email, Rol rol) {
		return fixtures.inTenant(consultorioId, () -> usuarios.save(new Usuario(email, "h", "Sin Prof", rol)).getId());
	}

	/** Filas de auditoria del consultorio para las entidades clinicas de C-08, en orden de alta. */
	public List<Fila> auditoriaClinica(Long consultorioId) {
		return jdbc.query("SELECT usuario_id, accion, entidad, entidad_id, detalle FROM audit_log "
				+ "WHERE consultorio_id = ? AND entidad IN ('FichaClinica', 'NotaClinica', 'ConsentimientoDatos') "
				+ "ORDER BY id", (rs, i) -> new Fila(rs.getObject("usuario_id", Long.class), rs.getString("accion"),
						rs.getString("entidad"), rs.getObject("entidad_id", Long.class), rs.getString("detalle")),
				consultorioId);
	}

	/** Cantidad total de filas de auditoria clinica en toda la base. */
	public int totalAuditoriaClinica() {
		Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM audit_log "
				+ "WHERE entidad IN ('FichaClinica', 'NotaClinica', 'ConsentimientoDatos')", Integer.class);
		return n == null ? 0 : n;
	}

	public Map<String, Object> filaFicha(long pacienteId) {
		return jdbc.queryForMap("SELECT * FROM ficha_clinica WHERE paciente_id = ?", pacienteId);
	}

	public int contar(String tabla, long pacienteId) {
		Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM " + tabla + " WHERE paciente_id = ?", Integer.class,
				pacienteId);
		return n == null ? 0 : n;
	}
}
