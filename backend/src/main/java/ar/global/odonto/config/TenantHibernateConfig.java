package ar.global.odonto.config;

import ar.global.odonto.common.persistence.AuditLogStatementInspector;
import ar.global.odonto.common.tenant.TenantIdentifierResolver;
import org.hibernate.cfg.AvailableSettings;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Registra el resolver de tenant fail-closed en Hibernate (design D1). */
@Configuration(proxyBeanMethods = false)
public class TenantHibernateConfig {

	@Bean
	public TenantIdentifierResolver tenantIdentifierResolver() {
		return new TenantIdentifierResolver();
	}

	@Bean
	public HibernatePropertiesCustomizer tenantResolverCustomizer(TenantIdentifierResolver resolver) {
		return properties -> {
			properties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, resolver);
			// audit_log insert-only: rechaza UPDATE/DELETE sobre la tabla (design D3).
			properties.put(AvailableSettings.STATEMENT_INSPECTOR, new AuditLogStatementInspector());
		};
	}
}
