package ar.global.odonto.auditoria.consulta;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditLog;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** Mapeo entidad -> DTO de la consulta de auditoria (design D6). Unitario, sin Spring. */
@ExtendWith(OutputCaptureExtension.class)
class AuditLogMapperTest {

	private final AuditLogMapper mapper = new AuditLogMapper(new ObjectMapper());

	@Test
	void jsonDetailBecomesAnObject() {
		AuditLogResponse r = mapper.aResponse(entrada(5L, "{\"resultado\":\"ok\"}"));

		assertThat(r.detalle().get("resultado").asText()).isEqualTo("ok");
		assertThat(r.id()).isEqualTo(5L);
		assertThat(r.usuarioId()).isEqualTo(7L);
		assertThat(r.accion()).isEqualTo(AccionAuditoria.LOGIN);
		assertThat(r.entidad()).isEqualTo("Usuario");
		assertThat(r.entidadId()).isEqualTo(7L);
		assertThat(r.ip()).isEqualTo("10.0.0.1");
	}

	@Test
	void nestedKeysKeepTheirTypes() {
		AuditLogResponse r = mapper.aResponse(entrada(6L, "{\"turnoId\":31,\"sobreturno\":true}"));

		assertThat(r.detalle().get("turnoId").asLong()).isEqualTo(31L);
		assertThat(r.detalle().get("sobreturno").asBoolean()).isTrue();
	}

	@Test
	void nullDetailStaysNull(CapturedOutput output) {
		assertThat(mapper.aResponse(entrada(8L, null)).detalle()).isNull();
		assertThat(output.getAll()).doesNotContain("WARN");
	}

	@Test
	void legacyPlainTextDetailBecomesNullAndWarnsWithTheIdOnly(CapturedOutput output) {
		AuditLogResponse r = mapper.aResponse(entrada(9L, "ok"));

		assertThat(r.detalle()).isNull();
		assertThat(output.getAll()).contains("WARN").contains("9");
	}

	@Test
	void jsonThatIsNotAnObjectBecomesNull() {
		assertThat(mapper.aResponse(entrada(10L, "[1,2]")).detalle()).isNull();
		assertThat(mapper.aResponse(entrada(11L, "42")).detalle()).isNull();
	}

	private static AuditLog entrada(Long id, String detalle) {
		AuditLog l = new AuditLog(7L, AccionAuditoria.LOGIN, "Usuario", 7L, detalle, "10.0.0.1");
		ReflectionTestUtils.setField(l, "id", id);
		ReflectionTestUtils.setField(l, "createdAt", Instant.parse("2026-11-23T13:00:00Z"));
		return l;
	}
}
