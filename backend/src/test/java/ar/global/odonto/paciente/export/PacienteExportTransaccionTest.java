package ar.global.odonto.paciente.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;

/**
 * Regla 5 de C-06 (MySQL 8.4) sobre la transaccion programatica del export (design D3): H2 no rechaza un INSERT en
 * una transaccion de solo lectura, asi que se verifica la definicion que pide el servicio. Test puro, sin Spring:
 * el gestor de transacciones de prueba registra la definicion y corta antes de tocar la base.
 */
class PacienteExportTransaccionTest {

	/** Registra cada definicion pedida y aborta (no hay base en este test). */
	static final class GestorQueRegistra implements PlatformTransactionManager {

		final List<TransactionDefinition> pedidas = new ArrayList<>();

		@Override
		public TransactionStatus getTransaction(TransactionDefinition definition) {
			pedidas.add(definition);
			throw new IllegalStateException("corte del test");
		}

		@Override
		public void commit(TransactionStatus status) {
		}

		@Override
		public void rollback(TransactionStatus status) {
		}
	}

	private static PacienteExportService servicio(GestorQueRegistra gestor) {
		return new PacienteExportService(null, null, null, null, null, gestor, Clock.systemUTC());
	}

	@Test
	void theExportRunsInAReadWriteRequiredTransaction() {
		GestorQueRegistra gestor = new GestorQueRegistra();

		assertThatThrownBy(() -> servicio(gestor).exportar(7L)).hasMessage("corte del test");

		assertThat(gestor.pedidas).hasSize(1);
		assertThat(gestor.pedidas.get(0).isReadOnly()).isFalse();
		assertThat(gestor.pedidas.get(0).getPropagationBehavior())
				.isEqualTo(TransactionDefinition.PROPAGATION_REQUIRED);
	}

	@Test
	void everyExportOpensItsOwnTransactionDefinitionWithTheSameSettings() {
		GestorQueRegistra gestor = new GestorQueRegistra();
		PacienteExportService service = servicio(gestor);

		assertThatThrownBy(() -> service.exportar(7L)).isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(() -> service.exportar(8L)).isInstanceOf(IllegalStateException.class);

		assertThat(gestor.pedidas).hasSize(2).allSatisfy(d -> assertThat(d.isReadOnly()).isFalse());
	}
}
