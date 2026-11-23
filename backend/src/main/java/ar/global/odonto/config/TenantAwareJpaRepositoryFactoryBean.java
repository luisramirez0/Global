package ar.global.odonto.config;

import ar.global.odonto.common.tenant.TenantContext;
import java.io.Serializable;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactoryBean;
import org.springframework.data.repository.Repository;

/**
 * Fabrica de repositorios que crea cada repositorio en modo sistema.
 *
 * <p>
 * Spring Data valida las consultas derivadas ({@code findByEmail}, ...) al arrancar, y para eso abre un
 * {@code EntityManager} temporal: Hibernate resuelve el tenant en ese momento y el resolver fail-closed
 * lanzaria {@code TenantNotSetException}, abortando el arranque. El modo sistema se limita a esta fase de
 * construccion (no ejecuta consultas de datos) y se restablece al terminar cada repositorio.
 */
public class TenantAwareJpaRepositoryFactoryBean<T extends Repository<S, ID>, S, ID extends Serializable>
		extends JpaRepositoryFactoryBean<T, S, ID> {

	public TenantAwareJpaRepositoryFactoryBean(Class<? extends T> repositoryInterface) {
		super(repositoryInterface);
	}

	@Override
	public void afterPropertiesSet() {
		TenantContext.runAsSystem(() -> {
			super.afterPropertiesSet();
			return null;
		});
	}
}
