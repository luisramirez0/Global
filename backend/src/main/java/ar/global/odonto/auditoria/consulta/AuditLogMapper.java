package ar.global.odonto.auditoria.consulta;

import ar.global.odonto.auditoria.AuditLog;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Entidad -> DTO. El {@code detalle} se parsea a objeto JSON; texto que no es un objeto JSON (filas previas a
 * C-06 en bases de desarrollo, p. ej. {@code ok}) se expone como {@code null} y se loguea {@code WARN} solo con
 * el id (regla 5).
 */
@Component
public class AuditLogMapper {

	private static final Logger log = LoggerFactory.getLogger(AuditLogMapper.class);

	private final ObjectMapper json;

	public AuditLogMapper(ObjectMapper json) {
		this.json = json;
	}

	public AuditLogResponse aResponse(AuditLog l) {
		return new AuditLogResponse(l.getId(), l.getCreatedAt(), l.getUsuarioId(), l.getAccion(), l.getEntidad(),
				l.getEntidadId(), detalle(l), l.getIp());
	}

	private JsonNode detalle(AuditLog l) {
		if (l.getDetalle() == null) {
			return null;
		}
		try {
			JsonNode nodo = json.readTree(l.getDetalle());
			if (nodo != null && nodo.isObject()) {
				return nodo;
			}
		}
		catch (JsonProcessingException e) {
			// cae al WARN de abajo, sin el contenido
		}
		log.warn("Detalle de auditoria no es un objeto JSON auditLogId={}", l.getId());
		return null;
	}
}
