package ar.global.odonto.common.tenant;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;

/**
 * Resolver de tenant para Hibernate ({@code @TenantId}). Falla cerrado: sin tenant ni modo sistema
 * lanza {@link TenantNotSetException}. En modo sistema devuelve {@link #SYSTEM}, que Hibernate trata
 * como sesión root (sin filtro y con {@code consultorio_id} asignable a mano).
 */
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<Long> {

	/** Centinela del modo sistema; no es un id de consultorio válido. */
	public static final Long SYSTEM = -1L;

	@Override
	public Long resolveCurrentTenantIdentifier() {
		if (TenantContext.isSystem()) {
			return SYSTEM;
		}
		return TenantContext.require();
	}

	@Override
	public boolean validateExistingCurrentSessions() {
		return true;
	}

	@Override
	public boolean isRoot(Long tenantId) {
		return SYSTEM.equals(tenantId);
	}
}
