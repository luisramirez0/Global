package ar.global.odonto.common.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

class AuditLogStatementInspectorTest {

	private final AuditLogStatementInspector inspector = new AuditLogStatementInspector();

	@ParameterizedTest
	@ValueSource(strings = { "delete from audit_log", "DELETE FROM audit_log where id=?", "update audit_log set accion=?",
			"  UPDATE   AUDIT_LOG set x=1", "delete from `audit_log`", "update public.audit_log set x=1",
			"/* c */ delete from audit_log", "delete from \"audit_log\" a where a.id=?", "delete audit_log" })
	void updatesAndDeletesOnAuditLogAreRejected(String sql) {
		assertThatThrownBy(() -> inspector.inspect(sql)).isInstanceOf(UnsupportedOperationException.class);
	}

	@ParameterizedTest
	@ValueSource(strings = { "insert into audit_log (id) values (?)", "select * from audit_log", "select a from audit_log a",
			"delete from sillon", "update paciente set x=1", "delete from audit_log_backup", "update xaudit_log set a=1",
			"delete from my_audit_log", "update audit_logs set a=1", "select * from sillon where nombre = 'update audit_log'" })
	void otherStatementsAreUntouched(String sql) {
		assertThat(inspector.inspect(sql)).isEqualTo(sql);
	}

	@Test
	void nullSqlIsReturnedAsIs() {
		assertThat(inspector.inspect(null)).isNull();
	}
}
