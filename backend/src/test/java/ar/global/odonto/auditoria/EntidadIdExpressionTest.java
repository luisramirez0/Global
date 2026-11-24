package ar.global.odonto.auditoria;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

/** Evaluacion de {@code @Audited.entidadId} (design D3, regla 3). Unitario, sin Spring. */
class EntidadIdExpressionTest {

	public record Creado(Long id, String nombre) {
	}

	@SuppressWarnings("unused")
	public Creado alta(String nombre) {
		return null;
	}

	@SuppressWarnings("unused")
	public void leer(Long id, String otro) {
	}

	@SuppressWarnings("unused")
	public void leerInt(int pacienteId) {
	}

	private static Method metodo(String nombre) {
		for (Method m : EntidadIdExpressionTest.class.getDeclaredMethods()) {
			if (m.getName().equals(nombre)) {
				return m;
			}
		}
		throw new IllegalStateException();
	}

	@Test
	void argumentByNameAndByPosition() {
		Method leer = metodo("leer");

		assertThat(EntidadIdExpression.evaluar("#id", leer, new Object[] { 12L, "x" }, null)).isEqualTo(12L);
		assertThat(EntidadIdExpression.evaluar("#p0", leer, new Object[] { 7L, "x" }, null)).isEqualTo(7L);
	}

	@Test
	void resultExpressionOnARecord() {
		assertThat(EntidadIdExpression.evaluar("#result.id()", metodo("alta"), new Object[] { "x" },
				new Creado(40L, "x"))).isEqualTo(40L);
		assertThat(EntidadIdExpression.evaluar("#result.id()", metodo("alta"), new Object[] { "x" },
				new Creado(41L, "y"))).isEqualTo(41L);
	}

	@Test
	void blankExpressionMeansNoId() {
		assertThat(EntidadIdExpression.evaluar("", metodo("leer"), new Object[] { 1L, "x" }, null)).isNull();
		assertThat(EntidadIdExpression.evaluar(null, metodo("leer"), new Object[] { 1L, "x" }, null)).isNull();
	}

	@Test
	void integerIsWidenedToLong() {
		assertThat(EntidadIdExpression.evaluar("#pacienteId", metodo("leerInt"), new Object[] { 5 }, null))
				.isEqualTo(5L);
	}

	@Test
	void nullValueGivesNullId() {
		assertThat(EntidadIdExpression.evaluar("#id", metodo("leer"), new Object[] { null, "x" }, null)).isNull();
	}

	@Test
	void stringResultIsAProgrammingError() {
		assertThatThrownBy(() -> EntidadIdExpression.evaluar("#otro", metodo("leer"), new Object[] { 1L, "Ana" },
				null)).isInstanceOf(IllegalStateException.class).hasMessageNotContaining("Ana");
	}

	@Test
	void invalidExpressionIsAProgrammingError() {
		assertThatThrownBy(() -> EntidadIdExpression.evaluar("#id.noExiste()", metodo("leer"),
				new Object[] { 1L, "x" }, null)).isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(() -> EntidadIdExpression.evaluar("((", metodo("leer"), new Object[] { 1L, "x" }, null))
				.isInstanceOf(IllegalStateException.class);
	}
}
