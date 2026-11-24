package ar.global.odonto.auditoria.consulta;

import ar.global.odonto.auditoria.AccionAuditoria;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

/**
 * Entrada del log de auditoria para la API (regla 1: nunca la entidad). Solo {@code usuarioId}, sin nombre ni
 * email del usuario; {@code detalle} es un objeto JSON plano o {@code null}.
 */
public record AuditLogResponse(Long id, Instant fecha, Long usuarioId, AccionAuditoria accion, String entidad,
		Long entidadId, JsonNode detalle, String ip) {
}
