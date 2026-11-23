package ar.global.odonto.common.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.atomic.AtomicReference;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenantContextTest {

	@AfterEach
	void cleanUp() {
		TenantContext.clear();
	}

	@Test
	void setAndGetReturnTheTenant() {
		TenantContext.set(7L);

		assertThat(TenantContext.get()).contains(7L);
		assertThat(TenantContext.require()).isEqualTo(7L);
	}

	@Test
	void anotherTenantReplacesThePreviousOne() {
		TenantContext.set(7L);
		TenantContext.set(9L);

		assertThat(TenantContext.require()).isEqualTo(9L);
	}

	@Test
	void clearEmptiesTheContext() {
		TenantContext.set(7L);

		TenantContext.clear();

		assertThat(TenantContext.get()).isEmpty();
		assertThat(TenantContext.isSystem()).isFalse();
	}

	@Test
	void requireWithEmptyContextFailsClosed() {
		assertThatThrownBy(TenantContext::require).isInstanceOf(TenantNotSetException.class);
	}

	@Test
	void runAsSetsTheTenantAndRestoresTheEmptyStateAfterwards() {
		Long inside = TenantContext.runAs(7L, TenantContext::require);

		assertThat(inside).isEqualTo(7L);
		assertThat(TenantContext.get()).isEmpty();
	}

	@Test
	void runAsRestoresThePreviousTenantWhenNested() {
		TenantContext.set(1L);

		Long inside = TenantContext.runAs(2L, TenantContext::require);

		assertThat(inside).isEqualTo(2L);
		assertThat(TenantContext.require()).isEqualTo(1L);
	}

	@Test
	void runAsRestoresTheStateEvenIfTheBlockThrows() {
		TenantContext.set(1L);

		assertThatThrownBy(() -> TenantContext.runAs(2L, () -> {
			throw new IllegalArgumentException("boom");
		})).isInstanceOf(IllegalArgumentException.class);

		assertThat(TenantContext.require()).isEqualTo(1L);
	}

	@Test
	void runAsSystemEnablesSystemModeOnlyInsideTheBlock() {
		Boolean inside = TenantContext.runAsSystem(TenantContext::isSystem);

		assertThat(inside).isTrue();
		assertThat(TenantContext.isSystem()).isFalse();
	}

	@Test
	void runAsSystemRestoresPreviousStateEvenIfTheBlockThrows() {
		TenantContext.set(3L);

		assertThatThrownBy(() -> TenantContext.runAsSystem(() -> {
			throw new IllegalStateException("boom");
		})).isInstanceOf(IllegalStateException.class);

		assertThat(TenantContext.isSystem()).isFalse();
		assertThat(TenantContext.require()).isEqualTo(3L);
	}

	@Test
	void runAsInsideSystemModeLeavesSystemModeOnExit() {
		Boolean afterNested = TenantContext.runAsSystem(() -> {
			TenantContext.runAs(5L, TenantContext::require);
			return TenantContext.isSystem();
		});

		assertThat(afterNested).isTrue();
	}

	@Test
	void tenantIsNotVisibleFromAnotherThread() throws InterruptedException {
		TenantContext.set(7L);
		AtomicReference<Optional<Long>> seen = new AtomicReference<>();

		Thread t = new Thread(() -> seen.set(TenantContext.get()));
		t.start();
		t.join();

		assertThat(seen.get()).isEmpty();
	}
}
