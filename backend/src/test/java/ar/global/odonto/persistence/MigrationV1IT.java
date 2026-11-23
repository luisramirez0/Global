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
class MigrationV1IT {

	private static final List<String> TENANT_TABLES = List.of("usuario", "profesional", "sillon", "prestacion",
			"horario_atencion", "bloqueo_agenda");

	@Autowired
	private JdbcTemplate jdbc;

	@AfterEach
	void cleanUp() {
		jdbc.update("DELETE FROM bloqueo_agenda");
		jdbc.update("DELETE FROM horario_atencion");
		jdbc.update("DELETE FROM profesional");
		jdbc.update("DELETE FROM sillon");
		jdbc.update("DELETE FROM prestacion");
		jdbc.update("DELETE FROM usuario");
		jdbc.update("DELETE FROM consultorio");
	}

	@Test
	void flywayAppliedVersionOneSuccessfully() {
		Integer applied = jdbc.queryForObject(
				"SELECT COUNT(*) FROM flyway_schema_history WHERE version = '1' AND success = TRUE", Integer.class);
		Integer failed = jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success = FALSE",
				Integer.class);

		assertThat(applied).isEqualTo(1);
		assertThat(failed).isZero();
	}

	@Test
	void everyTableExists() {
		List<String> tables = jdbc.queryForList("SELECT LOWER(table_name) FROM information_schema.tables "
				+ "WHERE table_schema = SCHEMA()", String.class);

		assertThat(tables).contains("consultorio", "usuario", "profesional", "sillon", "prestacion",
				"horario_atencion", "bloqueo_agenda");
	}

	@Test
	void tenantTablesHaveNonNullCommonColumns() {
		for (String table : TENANT_TABLES) {
			assertThat(nonNullColumns(table)).as(table).contains("consultorio_id", "created_at", "updated_at");
		}
		assertThat(nonNullColumns("consultorio")).contains("created_at", "updated_at");
	}

	@Test
	void parentTablesHaveUniqueConsultorioIdAndId() {
		for (String table : List.of("usuario", "profesional", "sillon", "prestacion", "horario_atencion",
				"bloqueo_agenda")) {
			Integer count = jdbc.queryForObject("""
					SELECT COUNT(*) FROM (
					  SELECT constraint_name FROM information_schema.key_column_usage
					  WHERE LOWER(table_name) = ? AND LOWER(column_name) IN ('consultorio_id','id')
					  GROUP BY constraint_name HAVING COUNT(*) = 2) t
					""", Integer.class, table);
			assertThat(count).as(table).isGreaterThanOrEqualTo(1);
		}
	}

	@Test
	void activoDefaultsToTrue() {
		long consultorio = insertConsultorio();
		jdbc.update("INSERT INTO sillon (consultorio_id, nombre, created_at, updated_at) "
				+ "VALUES (?, 'S1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", consultorio);

		Boolean activo = jdbc.queryForObject("SELECT activo FROM sillon", Boolean.class);
		Boolean consultorioActivo = jdbc.queryForObject("SELECT activo FROM consultorio", Boolean.class);

		assertThat(activo).isTrue();
		assertThat(consultorioActivo).isTrue();
	}

	@Test
	void rolOutsideTheSetIsRejected() {
		long consultorio = insertConsultorio();

		assertThatThrownBy(() -> insertUsuario(consultorio, "x@a.test", "SUPERUSER"))
				.isInstanceOf(DataIntegrityViolationException.class);
		insertUsuario(consultorio, "ok@a.test", "RECEPCION");
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuario", Integer.class)).isEqualTo(1);
	}

	@Test
	void diaSemanaOutsideOneToSevenIsRejected() {
		long consultorio = insertConsultorio();
		long profesional = insertProfesional(consultorio);

		assertThatThrownBy(() -> insertHorario(consultorio, profesional, 8, "09:00", "12:00"))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertHorario(consultorio, profesional, 0, "09:00", "12:00"))
				.isInstanceOf(DataIntegrityViolationException.class);
		insertHorario(consultorio, profesional, 7, "09:00", "12:00");
	}

	@Test
	void horaHastaMustBeAfterHoraDesde() {
		long consultorio = insertConsultorio();
		long profesional = insertProfesional(consultorio);

		assertThatThrownBy(() -> insertHorario(consultorio, profesional, 1, "12:00", "12:00"))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertHorario(consultorio, profesional, 1, "12:00", "09:00"))
				.isInstanceOf(DataIntegrityViolationException.class);
		insertHorario(consultorio, profesional, 1, "09:00", "09:30");
	}

	@Test
	void duracionMinutosMustBePositive() {
		long consultorio = insertConsultorio();

		assertThatThrownBy(() -> insertPrestacion(consultorio, 0)).isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertPrestacion(consultorio, -15))
				.isInstanceOf(DataIntegrityViolationException.class);
		insertPrestacion(consultorio, 15);
	}

	@Test
	void bloqueoFinMustBeAfterInicio() {
		long consultorio = insertConsultorio();

		assertThatThrownBy(() -> insertBloqueo(consultorio, "2026-11-24 12:00:00", "2026-11-24 12:00:00"))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertBloqueo(consultorio, "2026-11-24 12:00:00", "2026-11-24 11:00:00"))
				.isInstanceOf(DataIntegrityViolationException.class);
		insertBloqueo(consultorio, "2026-11-24 12:00:00", "2026-11-24 13:00:00");
	}

	private List<String> nonNullColumns(String table) {
		return jdbc.queryForList("SELECT LOWER(column_name) FROM information_schema.columns "
				+ "WHERE LOWER(table_name) = ? AND is_nullable = 'NO'", String.class, table);
	}

	private long insertConsultorio() {
		jdbc.update("INSERT INTO consultorio (nombre, created_at, updated_at) "
				+ "VALUES ('C', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
		return jdbc.queryForObject("SELECT MAX(id) FROM consultorio", Long.class);
	}

	private void insertUsuario(long consultorio, String email, String rol) {
		jdbc.update("INSERT INTO usuario (consultorio_id, email, password_hash, nombre, rol, created_at, updated_at) "
				+ "VALUES (?, ?, 'h', 'N', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", consultorio, email, rol);
	}

	private long insertProfesional(long consultorio) {
		jdbc.update("INSERT INTO profesional (consultorio_id, nombre, apellido, created_at, updated_at) "
				+ "VALUES (?, 'N', 'A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", consultorio);
		return jdbc.queryForObject("SELECT MAX(id) FROM profesional", Long.class);
	}

	private void insertHorario(long consultorio, long profesional, int dia, String desde, String hasta) {
		jdbc.update("INSERT INTO horario_atencion (consultorio_id, profesional_id, dia_semana, hora_desde, "
				+ "hora_hasta, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
				consultorio, profesional, dia, desde + ":00", hasta + ":00");
	}

	private void insertPrestacion(long consultorio, int minutos) {
		jdbc.update("INSERT INTO prestacion (consultorio_id, nombre, duracion_minutos, created_at, updated_at) "
				+ "VALUES (?, 'P', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", consultorio, minutos);
	}

	private void insertBloqueo(long consultorio, String inicio, String fin) {
		jdbc.update("INSERT INTO bloqueo_agenda (consultorio_id, inicio, fin, created_at, updated_at) "
				+ "VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", consultorio, inicio, fin);
	}
}
