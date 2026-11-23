package ar.global.odonto.common.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenantIdentifierResolverTest {

	private final TenantIdentifierResolver resolver = new TenantIdentifierResolver();

	@AfterEach
	void cleanUp() {
		TenantContext.clear();
	}

	@Test
	void returnsTheCurrentTenantAndIsNotRoot() {
		Long resolved = TenantContext.runAs(7L, resolver::resolveCurrentTenantIdentifier);

		assertThat(resolved).isEqualTo(7L);
		assertThat(resolver.isRoot(7L)).isFalse();
	}

	@Test
	void returnsTheSystemSentinelInSystemMode() {
		Long resolved = TenantContext.runAsSystem(resolver::resolveCurrentTenantIdentifier);

		assertThat(resolved).isEqualTo(TenantIdentifierResolver.SYSTEM);
		assertThat(resolver.isRoot(resolved)).isTrue();
	}

	@Test
	void systemModeWinsOverACurrentTenant() {
		Long resolved = TenantContext.runAs(7L,
				() -> TenantContext.runAsSystem(resolver::resolveCurrentTenantIdentifier));

		assertThat(resolved).isEqualTo(TenantIdentifierResolver.SYSTEM);
	}

	@Test
	void failsClosedWithoutTenantNorSystemMode() {
		assertThatThrownBy(resolver::resolveCurrentTenantIdentifier).isInstanceOf(TenantNotSetException.class);
	}

	@Test
	void afterSystemBlockTheResolverFailsClosedAgain() {
		TenantContext.runAsSystem(resolver::resolveCurrentTenantIdentifier);

		assertThatThrownBy(resolver::resolveCurrentTenantIdentifier).isInstanceOf(TenantNotSetException.class);
	}
}
