package ar.global.odonto.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class MigrationV2IT {

	private static final List<String> ALL_TABLES = List.of("consultorio", "usuario", "profesional", "sillon",
			"prestacion", "horario_atencion", "bloqueo_agenda", "paciente", "ficha_clinica", "nota_clinica",
			"consentimiento_texto", "consentimiento_datos", "turno", "recordatorio", "audit_log");

	@Autowired
	private JdbcTemplate jdbc;

	@AfterEach
	void cleanUp() {
		for (String table : List.of("audit_log", "recordatorio", "nota_clinica", "consentimiento_datos", "turno",
				"ficha_clinica", "paciente", "bloqueo_agenda", "horario_atencion", "profesional", "sillon",
				"prestacion", "usuario", "consultorio")) {
			jdbc.update("DELETE FROM " + table);
		}
	}

	@Test
	void versionTwoWasAppliedSuccessfully() {
		Integer applied = jdbc.queryForObject(
				"SELECT COUNT(*) FROM flyway_schema_history WHERE version = '2' AND success = TRUE", Integer.class);

		assertThat(applied).isEqualTo(1);
	}

	@Test
	void allFifteenTablesExist() {
		List<String> tables = jdbc.queryForList("SELECT LOWER(table_name) FROM information_schema.tables "
				+ "WHERE table_schema = SCHEMA() AND table_type = 'BASE TABLE' AND LOWER(table_name) <> "
				+ "'flyway_schema_history'", String.class);

		assertThat(tables).containsExactlyInAnyOrderElementsOf(ALL_TABLES);
	}

	@Test
	void businessTablesHaveNonNullCommonColumns() {
		for (String table : List.of("paciente", "ficha_clinica", "nota_clinica", "consentimiento_datos", "turno",
				"recordatorio")) {
			assertThat(nonNullColumns(table)).as(table).contains("consultorio_id", "created_at", "updated_at");
		}
	}

	@Test
	void auditLogHasCreatedAtButNoUpdatedAtAndRequiresConsultorio() {
		assertThat(nonNullColumns("audit_log")).contains("consultorio_id", "created_at");
		assertThat(allColumns("audit_log")).doesNotContain("updated_at");
	}

	@Test
	void consentTextV1IsSeededWithContent() {
		String contenido = jdbc.queryForObject("SELECT contenido FROM consentimiento_texto WHERE version = 'v1'",
				String.class);

		assertThat(contenido).isNotBlank().hasSizeGreaterThan(100);
	}

	@Test
	void agendaIndexesArePresent() {
		assertThat(indexColumns("turno")).contains(List.of("sillon_id", "inicio"), List.of("profesional_id", "inicio"),
				List.of("consultorio_id", "inicio"), List.of("paciente_id"));
		assertThat(indexColumns("paciente")).contains(List.of("consultorio_id", "apellido", "nombre"));
	}

	@Test
	void turnoEstadoOutsideTheSetIsRejected() {
		Ids ids = seedTurnoParents();

		assertThatThrownBy(() -> insertTurno(ids, "BORRADO", "2026-11-24 12:00:00", "2026-11-24 12:30:00"))
				.isInstanceOf(DataIntegrityViolationException.class);
		insertTurno(ids, "PROGRAMADO", "2026-11-24 12:00:00", "2026-11-24 12:30:00");
	}

	@Test
	void turnoFinMustBeAfterInicio() {
		Ids ids = seedTurnoParents();

		assertThatThrownBy(() -> insertTurno(ids, "PROGRAMADO", "2026-11-24 12:00:00", "2026-11-24 11:30:00"))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertTurno(ids, "PROGRAMADO", "2026-11-24 12:00:00", "2026-11-24 12:00:00"))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void recordatorioCanalAndEstadoOutsideTheSetAreRejected() {
		Ids ids = seedTurnoParents();
		insertTurno(ids, "PROGRAMADO", "2026-11-24 12:00:00", "2026-11-24 12:30:00");
		long turno = jdbc.queryForObject("SELECT MAX(id) FROM turno", Long.class);

		assertThatThrownBy(() -> insertRecordatorio(ids.consultorio, turno, "SMS", "GENERADO"))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertRecordatorio(ids.consultorio, turno, "EMAIL", "PERDIDO"))
				.isInstanceOf(DataIntegrityViolationException.class);
		insertRecordatorio(ids.consultorio, turno, "WHATSAPP_LINK", "GENERADO");
	}

	@Test
	void auditLogAccionOutsideTheSetIsRejected() {
		long consultorio = insertConsultorio();

		assertThatThrownBy(() -> insertAudit(consultorio, "TRUNCATE"))
				.isInstanceOf(DataIntegrityViolationException.class);
		insertAudit(consultorio, "READ");
	}

	// --- helpers ---------------------------------------------------------------------------------

	private record Ids(long consultorio, long paciente, long profesional, long sillon, long prestacion) {
	}

	private Ids seedTurnoParents() {
		long consultorio = insertConsultorio();
		jdbc.update("INSERT INTO paciente (consultorio_id, nombre, apellido, dni, created_at, updated_at) "
				+ "VALUES (?, 'N', 'A', '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", consultorio);
		jdbc.update("INSERT INTO profesional (consultorio_id, nombre, apellido, created_at, updated_at) "
				+ "VALUES (?, 'N', 'A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", consultorio);
		jdbc.update("INSERT INTO sillon (consultorio_id, nombre, created_at, updated_at) "
				+ "VALUES (?, 'S', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", consultorio);
		jdbc.update("INSERT INTO prestacion (consultorio_id, nombre, duracion_minutos, created_at, updated_at) "
				+ "VALUES (?, 'P', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", consultorio);
		return new Ids(consultorio, max("paciente"), max("profesional"), max("sillon"), max("prestacion"));
	}

	private long max(String table) {
		return jdbc.queryForObject("SELECT MAX(id) FROM " + table, Long.class);
	}

	private long insertConsultorio() {
		jdbc.update("INSERT INTO consultorio (nombre, created_at, updated_at) "
				+ "VALUES ('C', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
		return max("consultorio");
	}

	private void insertTurno(Ids ids, String estado, String inicio, String fin) {
		jdbc.update("INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_id, prestacion_id, "
				+ "inicio, fin, estado, created_at, updated_at) "
				+ "VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", ids.consultorio,
				ids.paciente, ids.profesional, ids.sillon, ids.prestacion, inicio, fin, estado);
	}

	private void insertRecordatorio(long consultorio, long turno, String canal, String estado) {
		jdbc.update("INSERT INTO recordatorio (consultorio_id, turno_id, canal, generado_en, estado, created_at, "
				+ "updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
				consultorio, turno, canal, estado);
	}

	private void insertAudit(long consultorio, String accion) {
		jdbc.update("INSERT INTO audit_log (consultorio_id, accion, entidad, created_at) "
				+ "VALUES (?, ?, 'FichaClinica', CURRENT_TIMESTAMP)", consultorio, accion);
	}

	private List<String> nonNullColumns(String table) {
		return jdbc.queryForList("SELECT LOWER(column_name) FROM information_schema.columns "
				+ "WHERE LOWER(table_name) = ? AND is_nullable = 'NO'", String.class, table);
	}

	private List<String> allColumns(String table) {
		return jdbc.queryForList("SELECT LOWER(column_name) FROM information_schema.columns "
				+ "WHERE LOWER(table_name) = ?", String.class, table);
	}

	/** Columnas de cada indice no unico/unico de la tabla, en orden. */
	private List<List<String>> indexColumns(String table) {
		List<String> names = jdbc.queryForList("SELECT DISTINCT index_name FROM information_schema.index_columns "
				+ "WHERE LOWER(table_name) = ?", String.class, table);
		return names.stream().map(n -> jdbc.queryForList("SELECT LOWER(column_name) FROM "
				+ "information_schema.index_columns WHERE LOWER(table_name) = ? AND index_name = ? "
				+ "ORDER BY ordinal_position", String.class, table, n)).toList();
	}
}
