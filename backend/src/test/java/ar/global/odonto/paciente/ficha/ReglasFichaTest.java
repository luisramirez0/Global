package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** Spec clinical-record "Edición concurrente de la ficha" (design D6), dominio puro sin Spring. */
class ReglasFichaTest {

	@Test
	void withoutStoredFichaAndNullVersionItCreates() {
		assertThat(ReglasFicha.decidir(null, null)).isEqualTo(OperacionFicha.CREAR);
	}

	@Test
	void withMatchingVersionItUpdates() {
		assertThat(ReglasFicha.decidir(3L, 3L)).isEqualTo(OperacionFicha.ACTUALIZAR);
		assertThat(ReglasFicha.decidir(0L, 0L)).isEqualTo(OperacionFicha.ACTUALIZAR);
	}

	@Test
	void versionGivenWithoutStoredFichaIsAConflict() {
		assertThatThrownBy(() -> ReglasFicha.decidir(null, 0L)).isInstanceOf(FichaDesactualizadaException.class);
	}

	@Test
	void nullVersionWithStoredFichaIsAConflict() {
		assertThatThrownBy(() -> ReglasFicha.decidir(3L, null)).isInstanceOf(FichaDesactualizadaException.class);
	}

	@Test
	void staleOrFutureVersionIsAConflict() {
		assertThatThrownBy(() -> ReglasFicha.decidir(3L, 2L)).isInstanceOf(FichaDesactualizadaException.class);
		assertThatThrownBy(() -> ReglasFicha.decidir(3L, 4L)).isInstanceOf(FichaDesactualizadaException.class);
	}

	@Test
	void conflictCarriesItsBusinessCode() {
		assertThatThrownBy(() -> ReglasFicha.decidir(3L, 2L)).isInstanceOfSatisfying(
				FichaDesactualizadaException.class, ex -> assertThat(ex.getCodigo()).isEqualTo("FICHA_DESACTUALIZADA"));
	}
}
