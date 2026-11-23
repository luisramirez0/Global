package ar.global.odonto.common.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.TenantId;

/**
 * Entidad de negocio acotada a un consultorio. Hibernate completa {@code consultorio_id} con el tenant
 * en curso, lo agrega a toda consulta y rechaza un valor distinto (design D1). No hay setter: el
 * código de aplicación nunca asigna el consultorio.
 */
@MappedSuperclass
public abstract class TenantEntity extends AuditableEntity {

	@TenantId
	@Column(name = "consultorio_id", nullable = false, updatable = false)
	private Long consultorioId;

	public Long getConsultorioId() {
		return consultorioId;
	}
}
