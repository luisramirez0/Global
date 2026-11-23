package ar.global.odonto.testsupport;

import ar.global.odonto.config.JpaAuditingConfig;
import ar.global.odonto.config.JpaRepositoriesConfig;
import ar.global.odonto.config.TenantHibernateConfig;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Meta-anotacion de tests de persistencia: {@code @DataJpaTest} contra H2 modo MySQL con las migraciones
 * Flyway reales (regla 8), mas la configuracion de tenant, auditing y un {@code Clock} controlable.
 *
 * <p>
 * IMPORTANTE: NO es transaccional por test ({@code NOT_SUPPORTED}). Hibernate resuelve el tenant al
 * abrir la sesion, es decir al iniciar la transaccion; con la transaccion del test abierta antes del
 * cuerpo del metodo no habria tenant todavia (fail closed). Cada llamada a repositorio abre su propia
 * transaccion dentro de {@code TenantContext.runAs}; los datos se confirman y {@link TenantFixtures#cleanAll()}
 * los limpia en {@code @AfterEach}.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({ TestClockConfig.class, JpaAuditingConfig.class, TenantHibernateConfig.class, JpaRepositoriesConfig.class,
		TenantFixtures.class, DomainFixtures.class })
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public @interface PersistenceTest {
}
