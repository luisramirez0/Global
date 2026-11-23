package ar.global.odonto.common.persistence;

import java.util.regex.Pattern;
import org.hibernate.resource.jdbc.spi.StatementInspector;

/**
 * Rechaza todo SQL UPDATE o DELETE cuyo destino sea la tabla {@code audit_log} (design D3): Hibernate 6.6 no
 * rechaza el DELETE HQL masivo sobre una entidad {@code @Immutable}, y esto cubre tambien SQL nativo emitido por
 * Hibernate. INSERT y SELECT pasan. La coincidencia es por identificador exacto (opcionalmente con esquema y
 * comillas), no por subcadena: {@code audit_log_backup} no coincide.
 *
 * <p>
 * Limite: solo ve lo que pasa por Hibernate; JDBC directo no. El guard completo en MySQL es el GRANT (C-16).
 */
public class AuditLogStatementInspector implements StatementInspector {

	private static final Pattern LEADING_COMMENTS = Pattern.compile("^(\\s|/\\*.*?\\*/)*", Pattern.DOTALL);

	private static final Pattern FORBIDDEN = Pattern.compile(
			"^(?:update|delete(?:\\s+from)?)\\s+(?:[`\"\\w]+\\.)?[`\"]?audit_log[`\"]?(?![\\w`\"$])",
			Pattern.CASE_INSENSITIVE);

	@Override
	public String inspect(String sql) {
		if (sql != null) {
			String body = LEADING_COMMENTS.matcher(sql).replaceFirst("");
			if (FORBIDDEN.matcher(body).find()) {
				throw new UnsupportedOperationException("audit_log es insert-only: UPDATE/DELETE no permitidos");
			}
		}
		return sql;
	}
}
