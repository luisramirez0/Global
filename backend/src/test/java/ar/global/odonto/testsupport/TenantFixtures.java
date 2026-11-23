package ar.global.odonto.testsupport;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Helper de tests de persistencia: crea los consultorios A y B en modo sistema, ejecuta bloques con un
 * tenant (una transaccion por bloque) y limpia todas las tablas con SQL directo (solo tests).
 */
@TestComponent
public class TenantFixtures {

	/** Tablas en orden hijo -> padre; las que aun no existen se saltean. */
	private static final List<String> TABLES_CHILD_FIRST = List.of("audit_log", "recordatorio", "nota_clinica",
			"consentimiento_datos", "turno", "ficha_clinica", "paciente", "bloqueo_agenda", "horario_atencion",
			"profesional", "sillon", "prestacion", "usuario", "consultorio");

	public record Tenants(Long a, Long b) {
	}

	@Autowired
	private ConsultorioRepository consultorios;

	@Autowired
	private TransactionTemplate tx;

	@Autowired
	private JdbcTemplate jdbc;

	/** Crea los consultorios A y B (alta en modo sistema). */
	public Tenants createTenants() {
		Long a = createConsultorio("Consultorio A");
		Long b = createConsultorio("Consultorio B");
		return new Tenants(a, b);
	}

	public Long createConsultorio(String nombre) {
		return TenantContext.runAsSystem(() -> consultorios.save(new Consultorio(nombre)).getId());
	}

	/** Ejecuta el bloque con el tenant fijado, todo dentro de una unica transaccion/sesion. */
	public <T> T inTenant(Long consultorioId, Supplier<T> block) {
		return TenantContext.runAs(consultorioId, () -> tx.execute(status -> block.get()));
	}

	/** Igual que {@link #inTenant} pero en modo sistema (sin filtro). */
	public <T> T inSystem(Supplier<T> block) {
		return TenantContext.runAsSystem(() -> tx.execute(status -> block.get()));
	}

	public void cleanAll() {
		TenantContext.clear();
		for (String table : TABLES_CHILD_FIRST) {
			Integer exists = jdbc.queryForObject(
					"SELECT COUNT(*) FROM information_schema.tables WHERE LOWER(table_name) = ? "
							+ "AND table_schema = SCHEMA()",
					Integer.class, table);
			if (exists != null && exists > 0) {
				jdbc.update("DELETE FROM " + table);
			}
		}
	}
}
