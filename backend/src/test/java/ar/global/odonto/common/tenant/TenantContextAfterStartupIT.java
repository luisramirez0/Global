package ar.global.odonto.common.tenant;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * El modo sistema de la fabrica de repositorios solo vive durante la construccion: tras arrancar el contexto
 * (el hilo que lo construyo y cualquier otro hilo) el TenantContext esta vacio y no es modo sistema.
 */
@SpringBootTest
class TenantContextAfterStartupIT {

	@Test
	void systemModeIsNotLeftActiveOnTheStartupThread() {
		assertThat(TenantContext.isSystem()).isFalse();
		assertThat(TenantContext.get()).isEmpty();
	}

	@Test
	void systemModeIsNotActiveOnAnotherThread() throws InterruptedException {
		AtomicBoolean system = new AtomicBoolean(true);
		AtomicReference<Optional<Long>> tenant = new AtomicReference<>();
		Thread t = new Thread(() -> {
			system.set(TenantContext.isSystem());
			tenant.set(TenantContext.get());
		});
		t.start();
		t.join();

		assertThat(system.get()).isFalse();
		assertThat(tenant.get()).isEmpty();
	}

	@Test
	void requireStillFailsClosedAfterStartup() {
		org.assertj.core.api.Assertions.assertThatThrownBy(TenantContext::require)
				.isInstanceOf(TenantNotSetException.class);
	}
}
