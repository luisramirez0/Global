package ar.global.odonto.auditoria;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.EstadoTurno;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Spec audit-log "Detalle estructurado y sin datos personales" (design D4). Dominio puro, sin Spring. */
class DetalleAuditoriaTest {

	@Test
	void numericAndBooleanValuesSerializeInInsertionOrder() {
		DetalleAuditoria d = DetalleAuditoria.vacio().con("turnoId", 31L).con("sobreturno", true);

		assertThat(d.json()).isEqualTo("{\"turnoId\":31,\"sobreturno\":true}");
	}

	@Test
	void keyOrderFollowsInsertionNotAlphabet() {
		assertThat(DetalleAuditoria.vacio().con("zeta", 1L).con("alfa", 2L).json())
				.isEqualTo("{\"zeta\":1,\"alfa\":2}");
	}

	@Test
	void enumValuesSerializeAsTheirName() {
		assertThat(DetalleAuditoria.vacio().con("estado", EstadoTurno.CANCELADO).json())
				.isEqualTo("{\"estado\":\"CANCELADO\"}");
	}

	@Test
	void shortCodesAreAccepted() {
		assertThat(DetalleAuditoria.codigo("resultado", "ok").json()).isEqualTo("{\"resultado\":\"ok\"}");
		assertThat(DetalleAuditoria.codigo("resultado", "fallido_2:x.y-z").json())
				.isEqualTo("{\"resultado\":\"fallido_2:x.y-z\"}");
	}

	@Test
	void emptyDetailIsNullJson() {
		assertThat(DetalleAuditoria.vacio().json()).isNull();
	}

	@ParameterizedTest
	@ValueSource(strings = { "Nombre", "1x", "", "a-b", "ñandu", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" })
	void invalidKeysAreRejectedWithoutEchoingTheValue(String clave) {
		assertThatThrownBy(() -> DetalleAuditoria.vacio().con(clave, 1L))
				.isInstanceOf(DetalleAuditoriaInvalidoException.class)
				.satisfies(e -> {
					if (!clave.isEmpty()) {
						assertThat(e.getMessage()).doesNotContain(clave);
					}
				});
	}

	@ParameterizedTest
	@ValueSource(strings = { "Ana Pérez", "", "con espacio", "acentó", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" })
	void invalidCodesAreRejectedWithoutEchoingTheValue(String codigo) {
		assertThatThrownBy(() -> DetalleAuditoria.codigo("resultado", codigo))
				.isInstanceOf(DetalleAuditoriaInvalidoException.class)
				.satisfies(e -> {
					if (!codigo.isEmpty()) {
						assertThat(e.getMessage()).doesNotContain(codigo);
					}
				});
	}

	@Test
	void nullValuesAreRejected() {
		assertThatThrownBy(() -> DetalleAuditoria.codigo("resultado", null))
				.isInstanceOf(DetalleAuditoriaInvalidoException.class);
		assertThatThrownBy(() -> DetalleAuditoria.vacio().con("estado", (Enum<?>) null))
				.isInstanceOf(DetalleAuditoriaInvalidoException.class);
	}

	@Test
	void moreThanTenKeysAreRejected() {
		DetalleAuditoria d = DetalleAuditoria.vacio();
		for (int i = 0; i < 10; i++) {
			d = d.con("k" + i, i);
		}
		DetalleAuditoria lleno = d;

		assertThat(lleno.json()).contains("\"k9\":9");
		assertThatThrownBy(() -> lleno.con("k10", 10L)).isInstanceOf(DetalleAuditoriaInvalidoException.class);
	}

	@Test
	void duplicatedKeyIsRejected() {
		assertThatThrownBy(() -> DetalleAuditoria.vacio().con("a", 1L).con("a", 2L))
				.isInstanceOf(DetalleAuditoriaInvalidoException.class);
	}

	@Test
	void maximumReachableJsonStaysWithinTheLimit() {
		DetalleAuditoria d = DetalleAuditoria.vacio();
		for (int i = 0; i < 10; i++) {
			d = d.conCodigo("a".repeat(39) + i, "b".repeat(40));
		}

		assertThat(d.json()).hasSizeLessThanOrEqualTo(DetalleAuditoria.MAX_JSON);
	}

	@Test
	void sizeGuardRejectsJsonOverTheLimit() {
		// Con las reglas de clave/codigo el limite es inalcanzable por la API tipada (maximo 862): guarda defensiva.
		DetalleAuditoria.verificarTamanio("x".repeat(DetalleAuditoria.MAX_JSON));
		assertThatThrownBy(() -> DetalleAuditoria.verificarTamanio("x".repeat(DetalleAuditoria.MAX_JSON + 1)))
				.isInstanceOf(DetalleAuditoriaInvalidoException.class);
	}

	@Test
	void detailIsImmutable() {
		DetalleAuditoria base = DetalleAuditoria.vacio().con("a", 1L);
		base.con("b", 2L);

		assertThat(base.json()).isEqualTo("{\"a\":1}");
	}
}
