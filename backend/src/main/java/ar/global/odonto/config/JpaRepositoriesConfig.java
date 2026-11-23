package ar.global.odonto.config;

import ar.global.odonto.OdontoApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Habilita los repositorios con la fabrica que los construye en modo sistema (ver su Javadoc). */
@Configuration(proxyBeanMethods = false)
@EnableJpaRepositories(basePackageClasses = OdontoApplication.class,
		repositoryFactoryBeanClass = TenantAwareJpaRepositoryFactoryBean.class)
public class JpaRepositoriesConfig {
}
