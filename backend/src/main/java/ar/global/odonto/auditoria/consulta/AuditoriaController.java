package ar.global.odonto.auditoria.consulta;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.common.web.Pagina;
import java.time.Instant;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * ZONA DE RIESGO (regla 12). {@code GET /api/auditoria} (design D6). Permisos y tenant los aplica
 * {@link AuditoriaConsultaService}; aca solo HTTP y DTOs (regla 1). {@code desde} inclusivo y {@code hasta}
 * exclusivo, ambos {@code Instant} ISO-8601 en UTC.
 */
@RestController
@RequestMapping("/api/auditoria")
public class AuditoriaController {

	private final AuditoriaConsultaService service;

	public AuditoriaController(AuditoriaConsultaService service) {
		this.service = service;
	}

	@GetMapping
	public Pagina<AuditLogResponse> listar(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant desde,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant hasta,
			@RequestParam(required = false) AccionAuditoria accion, @RequestParam(required = false) String entidad,
			@RequestParam(required = false) Long entidadId, @RequestParam(required = false) Long usuarioId,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "" + AuditoriaConsultaService.TAMANIO_POR_DEFECTO) int size) {
		return service.buscar(desde, hasta, accion, entidad, entidadId, usuarioId, page, size);
	}
}
